import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showInterstitial } from '@/ads/ads';
import { api } from '@/api/endpoints';
import type { Submission } from '@/api/types';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { preparePhoto } from '@/features/hunt/prepare-photo';
import { submitAndWait } from '@/features/hunt/submit';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL, errorMessage, ordinal } from '@/lib/format';
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

  const close = () => router.back();

  const capture = async () => {
    if (!cameraRef.current || !cameraReady || !word) return;
    let previewUri: string | null = null;
    try {
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      const photo = await preparePhoto(raw);
      previewUri = photo.uri;
      setPhase({ kind: 'analyzing', previewUri });
      const submission = await submitAndWait(word.id, photo);
      setPhase({ kind: 'result', previewUri, submission });
      if (submission.status === 'valid') {
        queryClient.invalidateQueries({ queryKey: queryKeys.daily });
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      }
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
          <>
            <ThemedText>This word isn&apos;t active anymore.</ThemedText>
            <Button title="Back to today" onPress={close} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </Centered>
    );
  }

  const accent = theme[word.difficulty];
  const target = (
    <View style={styles.target}>
      <ThemedText type="smallBold" style={{ color: accent }}>
        {DIFFICULTY_LABEL[word.difficulty].toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.targetWord}>{word.word.toUpperCase()}</ThemedText>
    </View>
  );

  // ---- camera -------------------------------------------------------------
  if (phase.kind === 'camera') {
    if (!permission) return <Centered><ActivityIndicator /></Centered>;
    if (!permission.granted) {
      return (
        <Centered>
          {target}
          <ThemedText style={styles.centerText}>Word Hunt needs your camera to snap your find.</ThemedText>
          <Button
            title={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          />
          <Button title="Cancel" variant="ghost" onPress={close} />
        </Centered>
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
            <Pressable onPress={close} hitSlop={16} accessibilityLabel="Close" style={styles.closeBtn}>
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </Pressable>
            <View style={styles.cameraBadge}>
              <ThemedText type="smallBold" style={{ color: accent }}>
                Find: {word.word.toUpperCase()}
              </ThemedText>
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

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.resultRoot}>
        {target}
        {previewUri ? <Image source={previewUri} style={styles.preview} contentFit="cover" /> : null}

        {phase.kind === 'analyzing' && (
          <View style={styles.status}>
            <ActivityIndicator size="large" color={accent} />
            <ThemedText themeColor="textSecondary">Checking your photo…</ThemedText>
          </View>
        )}

        {submission && valid && (
          <View style={styles.status}>
            <ThemedText style={[styles.big, { color: theme.success }]}>+{submission.points} pts</ThemedText>
            <ThemedText style={styles.centerText}>
              {submission.rank ? `You were the ${ordinal(submission.rank)} hunter to find it!` : 'Nice find!'}
            </ThemedText>
          </View>
        )}

        {submission && !valid && (
          <View style={styles.status}>
            <ThemedText style={[styles.big, { color: theme.danger }]}>Not quite</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {submission.message ?? `We couldn't find a ${word.word} in this photo.`}
            </ThemedText>
          </View>
        )}

        {phase.kind === 'error' && (
          <View style={styles.status}>
            <ThemedText style={[styles.big, { color: theme.danger }]}>Upload failed</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {phase.message}
            </ThemedText>
          </View>
        )}

        {phase.kind !== 'analyzing' && (
          <View style={styles.actions}>
            {valid ? (
              <Button title="Done" onPress={close} />
            ) : (
              <>
                <Button title="Try again" loading={retrying} onPress={retry} />
                <Button title="Give up for now" variant="ghost" onPress={close} />
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
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
  target: {
    alignItems: 'center',
  },
  targetWord: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 800,
    letterSpacing: 2,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
  },
  cameraBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
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
    padding: Spacing.four,
    gap: Spacing.four,
  },
  preview: {
    flex: 1,
    borderRadius: 20,
  },
  status: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  big: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 800,
  },
  actions: {
    gap: Spacing.two,
  },
});
