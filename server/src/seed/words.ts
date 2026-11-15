import type { Db } from '../db/client';
import { words } from '../db/schema';

/**
 * Word pool by difficulty. Every label must be a class your YOLO model detects.
 * These are COCO classes, which the stock Ultralytics models (yolo11n.pt etc.) know.
 */
export const WORD_POOL = {
  easy: ['chair', 'cup', 'bottle', 'book', 'clock', 'car', 'potted plant', 'laptop', 'cell phone', 'bowl', 'couch', 'bed'],
  medium: ['umbrella', 'bicycle', 'backpack', 'scissors', 'teddy bear', 'toaster', 'vase', 'handbag', 'tie', 'remote', 'keyboard', 'bench'],
  hard: ['fire hydrant', 'stop sign', 'parking meter', 'skateboard', 'tennis racket', 'hair drier', 'toothbrush', 'wine glass', 'motorcycle', 'suitcase'],
  expert: ['traffic light', 'frisbee', 'baseball glove', 'snowboard', 'microwave', 'kite', 'surfboard', 'horse', 'bus', 'boat'],
} as const;

export async function seedWords(db: Db) {
  const rows = Object.entries(WORD_POOL).flatMap(([difficulty, labels]) =>
    labels.map((label) => ({ label, difficulty: difficulty as keyof typeof WORD_POOL })),
  );
  await db.insert(words).values(rows).onConflictDoNothing();
}
