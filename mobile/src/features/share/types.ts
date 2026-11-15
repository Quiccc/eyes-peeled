import type { DailyWord, Difficulty, FeedItem, Submission } from '@/api/types';

/** Everything the share card shows. Only ever built from the player's OWN valid finds. */
export type ShareFind = {
  imageUri: string;
  word: string;
  difficulty: Difficulty;
  points: number;
  rank: number | null;
};

/** Hunt result screen: the local preview photo is used, so sharing works instantly and offline. */
export function fromSubmission(
  word: Pick<DailyWord, 'word' | 'difficulty'>,
  submission: Submission,
  previewUri: string,
): ShareFind {
  return {
    imageUri: previewUri,
    word: word.word,
    difficulty: word.difficulty,
    points: submission.points,
    rank: submission.rank,
  };
}

/** Profile → "Your finds today". */
export function fromFeedItem(item: FeedItem): ShareFind {
  return {
    imageUri: item.imageUrl,
    word: item.word,
    difficulty: item.difficulty,
    points: item.points,
    rank: item.rank,
  };
}

/** Today → a found word card. null when there's nothing shareable yet. */
export function fromDailyWord(word: DailyWord): ShareFind | null {
  const sub = word.submission;
  if (word.status !== 'found' || !sub || sub.status !== 'valid' || !sub.imageUrl) return null;
  return {
    imageUri: sub.imageUrl,
    word: word.word,
    difficulty: word.difficulty,
    points: sub.points,
    rank: sub.rank,
  };
}
