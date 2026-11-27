import { api, type PhotoFile } from '@/api/endpoints';
import type { Submission } from '@/api/types';
import { t } from '@/i18n';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 45_000;

/**
 * Upload a photo and wait for the AI verdict. The backend may answer
 * synchronously (valid/invalid) or with status 'pending' — in that case poll.
 */
export async function submitAndWait(wordId: string, photo: PhotoFile): Promise<Submission> {
  return waitForVerdict(await api.submitPhoto(wordId, photo));
}

/** Poll a pending submission until the server decides. Also used to resume one after an app restart. */
export async function waitForVerdict(submission: Submission): Promise<Submission> {
  const started = Date.now();
  while (submission.status === 'pending') {
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      throw new Error(t('hunt.slowAnalysis'));
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    submission = await api.getSubmission(submission.id);
  }
  return submission;
}
