import { type RequestHandler, Router } from 'express';
import { z } from 'zod';

import type { Ctx } from '../../context';
import { difficulties } from '../../domain/enums';
import type { AdminWord, MonthSchedule, TranslateResult, WordDayStats } from '../../dto/admin';
import { zIsoDate, zMonth } from '../../lib/validation';
import { wordStats } from '../../services/admin-stats';
import { fillMonth, getSchedule, setDay } from '../../services/schedule';
import { addWord, listWords, translateWords, updateWord } from '../../services/words';

const monthQuery = z.object({ month: zMonth });
const difficulty = z.enum(difficulties);

/** The admin panel's API: the schedule, the word list and per-word stats. */
export function panelRoutes(ctx: Ctx, admin: RequestHandler) {
  const r = Router();

  /** Token check for the panel's login screen. */
  r.get('/admin/check', admin, (_req, res) => {
    res.status(204).end();
  });

  r.get('/admin/schedule', admin, async (req, res) => {
    res.json((await getSchedule(ctx, monthQuery.parse(req.query).month)) satisfies MonthSchedule);
  });

  /** Fill the month's empty days. Planned days are kept. */
  r.post('/admin/schedule', admin, async (req, res) => {
    res.json(await fillMonth(ctx, monthQuery.parse(req.body).month));
  });

  r.put('/admin/schedule/:date/:difficulty', admin, async (req, res) => {
    const { wordId } = z.object({ wordId: z.uuid() }).parse(req.body);
    await setDay(ctx, zIsoDate.parse(req.params.date), difficulty.parse(req.params.difficulty), wordId);
    res.status(204).end();
  });

  r.get('/admin/words', admin, async (_req, res) => {
    res.json((await listWords(ctx)) satisfies AdminWord[]);
  });

  r.post('/admin/words', admin, async (req, res) => {
    const body = z.object({ label: z.string().trim().min(1).max(60), difficulty }).parse(req.body);
    await addWord(ctx, body.label, body.difficulty);
    res.status(204).end();
  });

  r.patch('/admin/words/:id', admin, async (req, res) => {
    const patch = z
      .object({
        enabled: z.boolean().optional(),
        minConfidence: z.number().min(0).max(1).nullable().optional(),
        /** The full set: languages left out are cleared. */
        translations: z.record(z.string(), z.string().max(60)).optional(),
      })
      .parse(req.body);
    await updateWord(ctx, z.uuid().parse(req.params.id), patch);
    res.status(204).end();
  });

  /** Fill in missing translations with Claude: the listed words, or every word. */
  r.post('/admin/words/translate', admin, async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.uuid()).max(500).optional() }).parse(req.body ?? {});
    res.json((await translateWords(ctx, ids)) satisfies TranslateResult);
  });

  r.get('/admin/stats', admin, async (req, res) => {
    const range = z.object({ from: zIsoDate.optional(), to: zIsoDate.optional() }).parse(req.query);
    res.json((await wordStats(ctx, range)) satisfies WordDayStats[]);
  });

  return r;
}
