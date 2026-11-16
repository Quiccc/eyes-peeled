import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { DailyWord, Submission } from '@/api/types';
import { Button } from '@/components/button';
import { Confetti, CountUp } from '@/components/celebration';
import { Icon } from '@/components/icon';
import { Spinner } from '@/components/spinner';
import { ThemedText } from '@/components/themed-text';
import { HuntActions, HuntScreenShell, HuntStatus, huntStyles, HuntTarget, PhotoFrame } from '@/features/hunt/hunt-layout';
import type { HuntPhase } from '@/features/hunt/use-hunt-session';
import { useTheme } from '@/hooks/use-theme';
import { ordinal } from '@/lib/format';

type Props = {
  word: DailyWord;
  phase: Exclude<HuntPhase, { kind: 'camera' }>;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
  /** Share a valid find; omitted when there's no photo to share. */
  onShare: (submission: Submission, previewUri: string) => void;
};

/** The photo with its verdict: checking, a valid find (points, confetti), a miss, or an upload failure. */
export function HuntResult({ word, phase, retrying, onRetry, onClose, onShare }: Props) {
  const theme = useTheme();
  const previewUri = phase.previewUri;
  const submission = phase.kind === 'result' ? phase.submission : null;
  const valid = submission?.status === 'valid';
  const failed = phase.kind === 'error' || (submission !== null && !valid);
  const frameColor = valid ? theme.success : failed ? theme.hard : theme.border;

  const badge = valid ? (
    <View style={[styles.badge, { backgroundColor: theme.successEdge }]}>
      <View style={[styles.badgeFace, { backgroundColor: theme.success }]}>
        <Icon name="check" size={30} color="#FFFFFF" />
      </View>
    </View>
  ) : null;

  return (
    <HuntScreenShell after={valid && <Confetti />}>
      <HuntTarget word={word} />

      <PhotoFrame borderColor={frameColor} badge={badge}>
        {previewUri ? (
          <Image source={previewUri} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon name="camera" size={72} color={theme.textSecondary} />
        )}
      </PhotoFrame>

      {phase.kind === 'analyzing' && (
        <HuntStatus style={styles.checking}>
          <Spinner color={theme[word.difficulty]} accessibilityLabel="Checking your photo" />
          <ThemedText themeColor="textSecondary">Checking your photo…</ThemedText>
        </HuntStatus>
      )}

      {submission && valid && (
        <HuntStatus>
          <CountUp value={submission.points} prefix="+" suffix=" pts" style={[styles.points, { color: theme.successText }]} />
          {submission.comboPoints > 0 && (
            <View
              style={[styles.combo, { backgroundColor: theme.tint, borderColor: theme.tintEdge }]}
              accessible
              accessibilityLabel={`Combo! Plus ${submission.comboPoints} bonus points for linking neighbouring words`}>
              <Icon name="link" size={18} color={theme.onTint} />
              <ThemedText type="smallBold" style={{ color: theme.onTint }}>
                Combo! +{submission.comboPoints} pts
              </ThemedText>
            </View>
          )}
          <ThemedText type="subtitle">Nice find!</ThemedText>
          {submission.rank ? (
            <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
              You were the {ordinal(submission.rank)} hunter to find it today.
            </ThemedText>
          ) : null}
        </HuntStatus>
      )}

      {submission && !valid && (
        <Failure
          title="Not quite"
          message={submission.message ?? `We couldn't spot a ${word.word}. Get closer and make sure it's in focus.`}
        />
      )}

      {phase.kind === 'error' && <Failure title="Upload failed" message={phase.message} />}

      {phase.kind !== 'analyzing' && (
        <HuntActions>
          {valid && submission ? (
            <>
              {previewUri ? (
                <Button
                  title="Share your find"
                  variant="secondary"
                  icon="share"
                  onPress={() => onShare(submission, previewUri)}
                />
              ) : null}
              <Button title="Done" onPress={onClose} />
            </>
          ) : (
            <>
              <Button title="Try again" icon="camera" loading={retrying} onPress={onRetry} />
              <Button title="Give up for now" variant="ghost" onPress={onClose} />
            </>
          )}
        </HuntActions>
      )}
    </HuntScreenShell>
  );
}

function Failure({ title, message }: { title: string; message: string }) {
  const theme = useTheme();
  return (
    <HuntStatus>
      <ThemedText type="title" style={{ color: theme.dangerText }}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
        {message}
      </ThemedText>
    </HuntStatus>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -10,
    top: -14,
    width: 56,
    height: 60,
    borderRadius: 28,
    transform: [{ rotate: '8deg' }],
  },
  /** 56px circle; the darker 4px under it is the badge's own background. */
  badgeFace: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checking: {
    gap: 14,
  },
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  points: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
});
