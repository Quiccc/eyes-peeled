import { useRouter } from 'expo-router';
import { useState } from 'react';

import { showInterstitial } from '@/ads/ads';
import type { DailyWord } from '@/api/types';

/**
 * Open the hunt for a word, showing an interstitial first (ad on difficulty selection).
 * `openingId` is the word whose ad is showing, so its card can spin and others stay inert.
 */
export function useStartHunt() {
  const router = useRouter();
  const [openingId, setOpeningId] = useState<string | null>(null);

  /** `replace`: swap the current hunt screen for this word's (the "Next word" button), instead of stacking it. */
  const startHunt = async (word: DailyWord, { replace = false }: { replace?: boolean } = {}) => {
    if (openingId) return;
    // A pending word reopens its in-flight result, so it isn't a new attempt and gets no ad.
    if (word.status !== 'pending') {
      setOpeningId(word.id);
      try {
        await showInterstitial();
      } finally {
        setOpeningId(null);
      }
    }
    const route = { pathname: '/hunt/[wordId]', params: { wordId: word.id } } as const;
    if (replace) router.replace(route);
    else router.push(route);
  };

  return { openingId, startHunt };
}
