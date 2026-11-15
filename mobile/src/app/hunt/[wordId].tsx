import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showInterstitial } from '@/ads/ads';
import { api } from '@/api/endpoints';
import type { Submission } from '@/api/types';
import { Button } from '@/components/button';
import { Confetti, CountUp } from '@/components/celebration';
import { Icon } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { difficultyColors, Edge, Radius, Spacing } from '@/constants/theme';
import { preparePhoto } from '@/features/hunt/prepare-photo';
import { submitAndWait, waitForVerdict } from '@/features/hunt/submit';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromSubmission } from '@/features/share/types';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, ordinal } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

type Phase =
  | { kind: 'camera' }
  | { kind: 'analyzing'; previewUri: string }
  | { kind: 'result'; previewUri: string; submission: Submission }
  | { kind: 'error'; previewUri: string | null; message: string };

export default function HuntScreen() {
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: daily } = useQuery({ queryKey: queryKeys.daily, queryFn: api.getDaily });
  const word = daily?.words.find((w) => w.id === wordId);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [retrying, setRetrying] = useState(false);
  const { share, sheet: shareSheet } = useShareFind();

  const close = () => router.back();

  const showVerdict = (previewUri: string, submission: Submission) => {
    setPhase({ kind: 'result', previewUri, submission });
    refreshAfterVerdict(queryClient, submission);
  };

  // A photo from an earlier session is still being checked (the app was closed mid-analysis):
  // skip the camera and pick the wait back up.
  const resumed = useRef(false);
  const pendingSubmission = word?.status === 'pending' ? word.submission : null;
  useEffect(() => {
    if (!pendingSubmission || resumed.current) return;
    resumed.current = true;
    const previewUri = pendingSubmission.imageUrl ?? '';
    setPhase({ kind: 'analyzing', previewUri });
    waitForVerdict(pendingSubmission)
      .then((s) => {
        setPhase({ kind: 'result', previewUri, submission: s });
        refreshAfterVerdict(queryClient, s);
      })
      .catch((e) => setPhase({ kind: 'error', previewUri, message: errorMessage(e) }));
  }, [pendingSubmission, queryClient]);

  const capture = async () => {
    if (!cameraRef.current || !cameraReady || !word) return;
    let previewUri: string | null = null;
    try {
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      const photo = await preparePhoto(raw);
      previewUri = photo.uri;
      setPhase({ kind: 'analyzing', previewUri });
      showVerdict(previewUri, await submitAndWait(word.id, photo));
    } catch (e) {
      setPhase({ kind: 'error', previewUri, message: errorMessage(e) });
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await showInterstitial(); // ad before another attempt
    } finally {
      setRetrying(false);
    }
    setCameraReady(false);
    setPhase({ kind: 'camera' });
  };

  if (!word) {
    return (
      <Centered>
        {daily ? (
          <View style={styles.stretch}>
            <ThemedText type="subtitle" style={styles.centerText}>
              This word isn&apos;t active anymore
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              New words arrive every day. Head back to see today&apos;s hunt.
            </ThemedText>
            <Button title="Back to today" onPress={close} style={styles.stretchButton} />
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </Centered>
    );
  }

  const accent = theme[word.difficulty];
  const pillColors = difficultyColors(theme, word.difficulty);
  const target = (
    <View style={styles.target}>
      <DifficultyPill difficulty={word.difficulty} style={styles.centerSelf} />
      <ThemedText type="title" style={styles.targetWord} accessibilityRole="header">
        {word.word.toUpperCase()}
      </ThemedText>
    </View>
  );

  // ---- camera -------------------------------------------------------------
  if (phase.kind === 'camera') {
    if (!permission) return <Centered><ActivityIndicator /></Centered>;
    if (!permission.granted) {
      const canAsk = permission.canAskAgain;
      return (
        <ThemedView style={styles.flex}>
          <SafeAreaView style={styles.resultRoot}>
            {target}
            <View style={[styles.frame, styles.permissionFrame, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
              <View style={styles.frameInner}>
                <Icon name="camera" size={72} color={theme.textSecondary} />
              </View>
            </View>
            <View style={[styles.status, styles.permissionStatus]}>
              <ThemedText type="subtitle" style={styles.centerText}>
                {canAsk ? 'Allow the camera' : 'Camera is off'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {canAsk
                  ? 'Word Hunt needs your camera to snap your find.'
                  : 'Turn on camera access for Word Hunt in Settings to snap your find.'}
              </ThemedText>
            </View>
            <View style={styles.actions}>
              <Button
                title={canAsk ? 'Allow camera' : 'Open settings'}
                icon={canAsk ? 'camera' : undefined}
                onPress={() => (canAsk ? requestPermission() : Linking.openSettings())}
              />
              <Button title="Not now" variant="ghost" onPress={close} />
            </View>
          </SafeAreaView>
        </ThemedView>
      );
    }

    return (
      <View style={styles.cameraRoot}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => setPhase({ kind: 'error', previewUri: null, message: e.message })}
        />
        <SafeAreaView style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={styles.cameraTop}>
            <Pressable
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}>
              <Icon name="close" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={[styles.cameraBadge, { backgroundColor: pillColors.bg, borderColor: accent }]}>
              <ThemedText type="smallBold" style={{ color: pillColors.text }}>
                FIND
              </ThemedText>
              <ThemedText style={[styles.badgeWord, { color: theme.text }]}>{word.word.toUpperCase()}</ThemedText>
            </View>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.cameraBottom}>
            <ThemedText type="small" style={styles.cameraHint}>
              Fill the frame with the real {word.word}
            </ThemedText>
            <Pressable
              accessibilityLabel="Take photo"
              onPress={capture}
              disabled={!cameraReady}
              style={({ pressed }) => [styles.shutter, { opacity: !cameraReady ? 0.4 : pressed ? 0.7 : 1 }]}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---- analyzing / result / error ----------------------------------------
  const previewUri = phase.previewUri;
  const submission = phase.kind === 'result' ? phase.submission : null;
  const valid = submission?.status === 'valid';
  const failed = phase.kind === 'error' || (submission !== null && !valid);
  const frameColor = valid ? theme.success : failed ? theme.hard : theme.border;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.resultRoot}>
        {target}

        <View
          style={[
            styles.frame,
            { borderColor: frameColor, backgroundColor: theme.backgroundSelected },
          ]}>
          <View style={styles.frameInner}>
            {previewUri ? (
              <Image source={previewUri} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Icon name="camera" size={72} color={theme.textSecondary} />
            )}
          </View>
          {valid && (
            <View style={[styles.badge, { backgroundColor: theme.success, borderBottomColor: theme.successEdge }]}>
              <Icon name="check" size={30} color="#FFFFFF" />
            </View>
          )}
        </View>

        {phase.kind === 'analyzing' && (
          <View style={styles.status}>
            <ActivityIndicator size="large" color={accent} />
            <ThemedText themeColor="textSecondary">Checking your photo…</ThemedText>
          </View>
        )}

        {submission && valid && (
          <View style={styles.status}>
            <CountUp value={submission.points} prefix="+" suffix=" pts" style={[styles.points, { color: theme.successText }]} />
            <ThemedText type="subtitle">Nice find!</ThemedText>
            {submission.rank ? (
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                You were the {ordinal(submission.rank)} hunter to find it today.
              </ThemedText>
            ) : null}
          </View>
        )}

        {submission && !valid && (
          <View style={styles.status}>
            <ThemedText type="title" style={{ color: theme.dangerText }}>
              Not quite
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {submission.message ?? `We couldn't spot a ${word.word}. Get closer and make sure it's in focus.`}
            </ThemedText>
          </View>
        )}

        {phase.kind === 'error' && (
          <View style={styles.status}>
            <ThemedText type="title" style={{ color: theme.dangerText }}>
              Upload failed
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {phase.message}
            </ThemedText>
          </View>
        )}

        {phase.kind !== 'analyzing' && (
          <View style={styles.actions}>
            {valid && submission ? (
              <>
                {previewUri ? (
                  <Button
                    title="Share your find"
                    variant="secondary"
                    icon="share"
                    onPress={() => share(fromSubmission(word, submission, previewUri))}
                  />
                ) : null}
                <Button title="Done" onPress={close} />
              </>
            ) : (
              <>
                <Button title="Try again" icon="camera" loading={retrying} onPress={retry} />
                <Button title="Give up for now" variant="ghost" onPress={close} />
              </>
            )}
          </View>
        )}
      </SafeAreaView>
      {valid && <Confetti />}
      {shareSheet}
    </ThemedView>
  );
}

/** Refresh what a verdict changes: the word's status always, scores only for a valid find. */
function refreshAfterVerdict(queryClient: QueryClient, submission: Submission) {
  queryClient.invalidateQueries({ queryKey: queryKeys.daily });
  if (submission.status === 'valid') {
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.centered}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  centerSelf: {
    alignSelf: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  stretchButton: {
    marginTop: Spacing.three,
  },
  permissionFrame: {
    maxHeight: 320,
  },
  permissionStatus: {
    flex: 1,
    justifyContent: 'center',
  },
  target: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  targetWord: {
    lineHeight: 36,
    letterSpacing: 1,
    textAlign: 'center',
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraBadge: {
    flexShrink: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  badgeWord: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 900,
    letterSpacing: 1,
  },
  cameraBottom: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  cameraHint: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  resultRoot: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  frame: {
    flex: 1,
    minHeight: 220,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
  },
  frameInner: {
    flex: 1,
    borderRadius: Radius.lg - 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -10,
    top: -14,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '8deg' }],
  },
  status: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  points: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    gap: Spacing.three,
  },
});
