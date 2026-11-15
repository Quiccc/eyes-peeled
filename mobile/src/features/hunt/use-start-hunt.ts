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

  const startHunt = async (word: DailyWord) => {
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
    router.push({ pathname: '/hunt/[wordId]', params: { wordId: word.id } });
  };

  return { openingId, startHunt };
}
