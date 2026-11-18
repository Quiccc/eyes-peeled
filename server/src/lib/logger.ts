import { pino } from 'pino';

/**
 * One logger for the whole server. JSON lines in production (`docker compose logs`), pretty in
 * dev, silent under vitest. LOG_LEVEL overrides the level.
 */
function create() {
  const env = process.env.NODE_ENV;
  const level = process.env.LOG_LEVEL ?? (env === 'test' || process.env.VITEST ? 'silent' : 'info');
  if (env === 'production' || level === 'silent') return pino({ level });
  return pino({
    level,
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  });
}

export const logger = create();
