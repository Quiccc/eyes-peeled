import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Daily, DailyWord, Submission } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { FlameIcon, NextIcon, ShareIcon } from '@/components/hunt-icons';
import { Icon } from '@/components/icon';
import { DizzyBadge, LookoutMascot, PuzzledBadge, ThumbsUpBadge } from '@/components/illustrations/hunt-art';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import {
  HuntActions,
  HuntScreenShell,
  HuntStatus,
  huntStyles,
  HuntTopBar,
  PhotoFrame,
  ScanBand,
} from '@/features/hunt/hunt-layout';
import { ScoreCard } from '@/features/hunt/score-card';
import type { HuntPhase } from '@/features/hunt/use-hunt-session';
import { useTheme } from '@/hooks/use-theme';
import { displayWord } from '@/lib/format';

type Props = {
  word: DailyWord;
  daily: Daily;
  phase: Exclude<HuntPhase, { kind: 'camera' }>;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
  /** Hunt the next word still to find (after a valid find). */
  onNext: (word: DailyWord) => void;
  /** Share a valid find; omitted when there's no photo to share. */
  onShare: (submission: Submission, previewUri: string) => void;
};

/** The photo with its verdict: checking, a valid find (score card), a miss, or an upload failure. */
export function HuntResult({ word, daily, phase, retrying, onRetry, onClose, onNext, onShare }: Props) {
  const theme = useTheme();
  const { user } = useAuth();
  const previewUri = phase.previewUri;
  const submission = phase.kind === 'result' ? phase.submission : null;
  const valid = submission?.status === 'valid';
  const rejected = submission !== null && !valid;
  const failed = phase.kind === 'error';
  const checking = phase.kind === 'analyzing';
  const frameColor = valid ? theme.success : rejected || failed ? theme.hard : theme.border;

  // This word was just found, so "next" is any other word still open; none left means today is done.
  const next = daily.words.find((w) => w.id !== word.id && w.status !== 'found') ?? null;

  const badge = valid ? <ThumbsUpBadge /> : rejected ? <PuzzledBadge /> : failed ? <DizzyBadge /> : null;

  return (
    <HuntScreenShell>
      <HuntTopBar word={word} />

      <PhotoFrame borderColor={frameColor} badge={badge} overlay={checking ? <ScanBand /> : null}>
        {previewUri ? (
          <Image source={previewUri} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your photo" />
        ) : (
          <Icon name="camera" size={64} color={theme.textSecondary} />
        )}
      </PhotoFrame>

      {checking && (
        <>
          <HuntStatus>
            <LookoutMascot width={120} />
            <ThemedText type="subtitle" style={huntStyles.centerText} accessibilityRole="text" accessibilityLiveRegion="polite">
              Looking for the {word.word}…
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
              Hang tight, our eye is on it.
            </ThemedText>
          </HuntStatus>
          <HuntActions>
            <Button title="Check back later" variant="ghost" onPress={onClose} />
            <ThemedText type="small" themeColor="textSecondary" style={huntStyles.caption}>
              We keep checking and show the result on Today.
            </ThemedText>
          </HuntActions>
        </>
      )}

      {submission && valid && (
        <>
          <HuntStatus>
            <ScoreCard
              title={next ? 'Nice find!' : `That's all ${daily.words.length} today!`}
              points={submission.points}
              comboPoints={submission.comboPoints}
              rank={submission.rank}
              footer={
                next ? null : (
                  <View style={styles.footer}>
                    <FlameIcon size={16} />
                    <ThemedText type="small" themeColor="textSecondary">
                      New words in{' '}
                    </ThemedText>
                    <Countdown target={daily.nextResetAt} type="small" themeColor="textSecondary" style={styles.tabular} />
                  </View>
                )
              }
            />
          </HuntStatus>
          <HuntActions>
            {next ? (
              <>
                <Button
                  title={`Next word: ${displayWord(next.word)}`}
                  iconNode={<NextIcon />}
                  iconAfter
                  onPress={() => onNext(next)}
                />
                <View style={styles.row}>
                  {previewUri ? (
                    <Button
                      title="Share"
                      variant="secondary"
                      iconNode={<ShareIcon />}
                      style={styles.shareInRow}
                      onPress={() => onShare(submission, previewUri)}
                    />
                  ) : null}
                  <Button title="Done" variant="ghost" style={styles.doneInRow} onPress={onClose} />
                </View>
              </>
            ) : (
              <>
                {previewUri ? (
                  <Button
                    title="Share your find"
                    variant="secondary"
                    iconNode={<ShareIcon />}
                    onPress={() => onShare(submission, previewUri)}
                  />
                ) : null}
                <Button title="Done" onPress={onClose} />
              </>
            )}
          </HuntActions>
        </>
      )}

      {(rejected || failed) && (
        <>
          <HuntStatus>
            <ThemedText type="title" style={[huntStyles.centerText, { color: theme.dangerText }]}>
              {failed ? 'Upload failed' : 'Not quite'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
              {phase.kind === 'error'
                ? phase.message
                : (submission?.message ??
                  `We couldn't spot a ${word.word} in this photo. Get closer and make sure it's in focus.`)}
            </ThemedText>
          </HuntStatus>
          <HuntActions>
            <Button title="Try again" iconNode={<HuntCameraIcon size={20} />} loading={retrying} onPress={onRetry} />
            {user?.isPremium ? null : (
              <ThemedText type="small" themeColor="textSecondary" style={huntStyles.caption}>
                A short ad plays first
              </ThemedText>
            )}
            <Button title="Give up for now" variant="ghost" onPress={onClose} />
          </HuntActions>
        </>
      )}
    </HuntScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  shareInRow: {
    flex: 1.4,
  },
  doneInRow: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
