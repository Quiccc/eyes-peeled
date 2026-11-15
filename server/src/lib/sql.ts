/** Rows from db.execute() — PGlite and node-postgres both return `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** Postgres unique_violation */
export function isUniqueViolation(e: unknown): boolean {
  let err: unknown = e;
  // drizzle wraps driver errors in `cause`
  for (let i = 0; i < 3 && err; i++) {
    if (typeof err === 'object' && err && 'code' in err && (err as { code: unknown }).code === '23505') return true;
    err = typeof err === 'object' && err && 'cause' in err ? (err as { cause: unknown }).cause : null;
  }
  return false;
}
