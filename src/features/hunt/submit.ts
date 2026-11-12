import { api, type PhotoFile } from '@/api/endpoints';
import type { Submission } from '@/api/types';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 45_000;

/**
 * Upload a photo and wait for the YOLO verdict. The backend may answer
 * synchronously (valid/invalid) or with status 'pending' — in that case poll.
 */
export async function submitAndWait(wordId: string, photo: PhotoFile): Promise<Submission> {
  let submission = await api.submitPhoto(wordId, photo);
  const started = Date.now();
  while (submission.status === 'pending') {
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      throw new Error('Analysis is taking longer than usual. Check back on the Today tab in a minute.');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    submission = await api.getSubmission(submission.id);
  }
  return submission;
}
