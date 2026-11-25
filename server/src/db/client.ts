import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';

import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type Database = {
  db: Db;
  close(): Promise<void>;
};

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Real Postgres when `databaseUrl` is set; otherwise embedded PGlite.
 * `dataDir` null = in-memory PGlite (tests). Migrations run on open.
 */
export async function openDatabase(opts: { databaseUrl?: string; dataDir: string | null }): Promise<Database> {
  if (opts.databaseUrl) {
    const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 10, idleTimeoutMillis: 30_000 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  let client: PGlite;
  if (opts.dataDir) {
    const dir = path.resolve(opts.dataDir, 'db');
    mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  } else {
    client = new PGlite();
  }
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => client.close() };
}
