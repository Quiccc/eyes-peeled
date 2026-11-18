import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { openDatabase } from '../src/db/client';
import { words } from '../src/db/schema';
import { WORD_POOL, seedWords } from '../src/seed/words';

/**
 * The other tests run on in-memory PGlite. This one runs the migrations and seed against real
 * Postgres (CI starts a postgres:17 service). Locally it is skipped unless TEST_DATABASE_URL is set.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('real Postgres', () => {
  it('migrates and seeds, and doing it again on the next start changes nothing', async () => {
    const poolSize = Object.values(WORD_POOL).flat().length;
    for (let start = 0; start < 2; start++) {
      const database = await openDatabase({ databaseUrl, dataDir: null });
      try {
        await seedWords(database.db);
        const [row] = await database.db.select({ n: sql<number>`count(*)::int` }).from(words);
        expect(row?.n).toBeGreaterThanOrEqual(poolSize);
        const dupes = await database.db
          .select({ label: words.label })
          .from(words)
          .groupBy(words.label)
          .having(sql`count(*) > 1`);
        expect(dupes).toEqual([]);
      } finally {
        await database.close();
      }
    }
  });
});
