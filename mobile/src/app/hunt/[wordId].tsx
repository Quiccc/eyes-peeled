import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useDaily } from '@/api/queries';
import type { Daily, DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { SleepyClockArt } from '@/components/illustrations/hunt-art';
import { ThemedText } from '@/components/themed-text';
import { CameraCapture } from '@/features/hunt/camera-capture';
import { CameraPermissionPrompt } from '@/features/hunt/camera-permission-prompt';
import { HuntActions, HuntLoading, HuntScreenShell, HuntStatus, huntStyles, HuntTopBar } from '@/features/hunt/hunt-layout';
import { HuntResult } from '@/features/hunt/hunt-result';
import { useHuntSession } from '@/features/hunt/use-hunt-session';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromSubmission } from '@/features/share/types';

export default function HuntScreen() {
  const { t } = useTranslation();
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const router = useRouter();
  const { data: daily } = useDaily();
  const word = daily?.words.find((w) => w.id === wordId);
  const close = () => router.back();

  if (!daily) return <HuntLoading />;

  if (!word) {
    return (
      <HuntScreenShell>
        <HuntTopBar />
        <HuntStatus>
          <SleepyClockArt />
          <ThemedText type="subtitle" style={huntStyles.centerText}>
            {t('hunt.expiredTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
            {t('hunt.expiredHint')}
          </ThemedText>
        </HuntStatus>
        <HuntActions>
          <Button title={t('hunt.backToToday')} onPress={close} />
        </HuntActions>
      </HuntScreenShell>
    );
  }

  // Keyed by word: "Next word" swaps in a fresh session even if the router reuses this screen.
  return <Hunt key={word.id} word={word} daily={daily} onClose={close} />;
}

function Hunt({ word, daily, onClose }: { word: DailyWord; daily: Daily; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const session = useHuntSession(word);
  const { share, sheet: shareSheet } = useShareFind();
  const { startHunt } = useStartHunt();

  const { phase } = session;
  if (phase.kind === 'camera') {
    if (!permission) return <HuntLoading />;
    if (!permission.granted) {
      return (
        <CameraPermissionPrompt word={word} permission={permission} requestPermission={requestPermission} onClose={onClose} />
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
        onClose={onClose}
      />
    );
  }

  return (
    <>
      <HuntResult
        word={word}
        daily={daily}
        phase={phase}
        retrying={session.retrying}
        onRetry={session.retry}
        onClose={onClose}
        onNext={(next) => startHunt(next, { replace: true })}
        onShare={(submission, previewUri) => share(fromSubmission(word, submission, previewUri))}
      />
      {shareSheet}
    </>
  );
}
