import { useQueryClient } from '@tanstack/react-query';
import type { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';

import { showInterstitial } from '@/ads/ads';
import { invalidateAfterVerdict } from '@/api/queries';
import type { DailyWord, Submission } from '@/api/types';
import { preparePhoto } from '@/features/hunt/prepare-photo';
import { submitAndWait, waitForVerdict } from '@/features/hunt/submit';
import { errorMessage } from '@/lib/format';

/** Where a hunt is: aiming the camera, waiting for the verdict, showing it, or showing a failure. */
export type HuntPhase =
  | { kind: 'camera' }
  | { kind: 'analyzing'; previewUri: string }
  | { kind: 'result'; previewUri: string; submission: Submission }
  | { kind: 'error'; previewUri: string | null; message: string };

/** The hunt screen's state machine: camera → analyzing → result/error → (retry) camera. */
export function useHuntSession(word: DailyWord | undefined) {
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<HuntPhase>({ kind: 'camera' });
  const [retrying, setRetrying] = useState(false);

  const showVerdict = (previewUri: string, submission: Submission) => {
    setPhase({ kind: 'result', previewUri, submission });
    invalidateAfterVerdict(queryClient, submission);
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
        invalidateAfterVerdict(queryClient, s);
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

  return {
    phase,
    retrying,
    capture,
    retry,
    cameraRef,
    cameraReady,
    onCameraReady: () => setCameraReady(true),
    onCameraError: (message: string) => setPhase({ kind: 'error', previewUri: null, message }),
  };
}
