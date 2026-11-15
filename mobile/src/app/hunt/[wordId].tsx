import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useDaily } from '@/api/queries';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CameraCapture } from '@/features/hunt/camera-capture';
import { CameraPermissionPrompt } from '@/features/hunt/camera-permission-prompt';
import { HuntCentered, huntStyles } from '@/features/hunt/hunt-layout';
import { HuntResult } from '@/features/hunt/hunt-result';
import { useHuntSession } from '@/features/hunt/use-hunt-session';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromSubmission } from '@/features/share/types';

export default function HuntScreen() {
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const router = useRouter();
  const { data: daily } = useDaily();
  const word = daily?.words.find((w) => w.id === wordId);
  const [permission, requestPermission] = useCameraPermissions();
  const session = useHuntSession(word);
  const { share, sheet: shareSheet } = useShareFind();
  const close = () => router.back();

  if (!word) {
    return (
      <HuntCentered>
        {daily ? (
          <View style={styles.stretch}>
            <ThemedText type="subtitle" style={huntStyles.centerText}>
              This word isn&apos;t active anymore
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
              New words arrive every day. Head back to see today&apos;s hunt.
            </ThemedText>
            <Button title="Back to today" onPress={close} style={styles.stretchButton} />
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </HuntCentered>
    );
  }

  const { phase } = session;
  if (phase.kind === 'camera') {
    if (!permission) {
      return (
        <HuntCentered>
          <ActivityIndicator />
        </HuntCentered>
      );
    }
    if (!permission.granted) {
      return (
        <CameraPermissionPrompt word={word} permission={permission} requestPermission={requestPermission} onClose={close} />
      );
    }
    return (
      <CameraCapture
        word={word}
        cameraRef={session.cameraRef}
        ready={session.cameraReady}
        onReady={session.onCameraReady}
        onError={session.onCameraError}
        onCapture={session.capture}
        onClose={close}
      />
    );
  }

  return (
    <>
      <HuntResult
        word={word}
        phase={phase}
        retrying={session.retrying}
        onRetry={session.retry}
        onClose={close}
        onShare={(submission, previewUri) => share(fromSubmission(word, submission, previewUri))}
      />
      {shareSheet}
    </>
  );
}

const styles = StyleSheet.create({
  stretch: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  stretchButton: {
    marginTop: Spacing.three,
  },
});
