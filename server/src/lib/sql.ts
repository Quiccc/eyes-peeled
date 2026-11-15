/** Rows from db.execute() — PGlite and node-postgres both return `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** True when `e` (or an error it wraps) carries this Postgres SQLSTATE. */
function hasPgCode(e: unknown, code: string): boolean {
  let err: unknown = e;
  // drizzle wraps driver errors in `cause`
  for (let i = 0; i < 3 && err; i++) {
    if (typeof err === 'object' && err && 'code' in err && (err as { code: unknown }).code === code) return true;
    err = typeof err === 'object' && err && 'cause' in err ? (err as { cause: unknown }).cause : null;
  }
  return false;
}

/** Postgres unique_violation */
export const isUniqueViolation = (e: unknown) => hasPgCode(e, '23505');

/** Postgres foreign_key_violation: a referenced row doesn't exist. */
export const isForeignKeyViolation = (e: unknown) => hasPgCode(e, '23503');
