import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: optional,
  /** Folder for PGlite data and uploaded photos. Relative paths are resolved from server/. */
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  FILE_URL_SECRET: z.string().min(32),
  APPLE_BUNDLE_ID: z.string().default('com.eyespeeled.app'),
  GOOGLE_WEB_CLIENT_ID: optional,
  AUTH_DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  YOLO_URL: optional,
  YOLO_KEY: optional,
  YOLO_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  /** How long POST /submissions waits for a verdict before answering 'pending'. */
  VERIFY_SYNC_WAIT_MS: z.coerce.number().int().min(0).default(8000),
  REVENUECAT_SECRET_KEY: optional,
  REVENUECAT_WEBHOOK_AUTH: optional,
  ADMIN_TOKEN: optional,
  /** Built admin panel, served at /admin-panel. Relative paths are resolved from server/. */
  ADMIN_PANEL_DIR: z.string().default('admin/dist'),
  /** In the first week of each month, plan next month's words automatically (empty days only). */
  AUTO_SCHEDULE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MIN_APP_VERSION: optional,
  /**
   * Express `trust proxy` setting, needed behind a load balancer so rate limits see the client's IP.
   * A hop count ("1"), "true", or a list of subnets. Empty = don't trust proxy headers.
   */
  TRUST_PROXY: optional,
});

/** Placeholder values from .env.example contain this; they must never reach production. */
const PLACEHOLDER = 'change-me';

/** Settings that fail silently in production (random verdicts, guessable tokens), so refuse to start. */
function productionProblems(env: z.infer<typeof schema>): string[] {
  const problems: string[] = [];
  if (!env.YOLO_URL) problems.push('YOLO_URL: required (without it photos are judged at random)');
  if (!env.YOLO_KEY) problems.push('YOLO_KEY: required');
  if (!env.REVENUECAT_SECRET_KEY) problems.push('REVENUECAT_SECRET_KEY: required (Premium restores fail without it)');
  if (!env.REVENUECAT_WEBHOOK_AUTH) problems.push('REVENUECAT_WEBHOOK_AUTH: required');
  const secrets = ['JWT_SECRET', 'FILE_URL_SECRET', 'YOLO_KEY', 'ADMIN_TOKEN', 'REVENUECAT_WEBHOOK_AUTH'] as const;
  for (const key of secrets) {
    if (env[key]?.includes(PLACEHOLDER)) problems.push(`${key}: still the placeholder from .env.example`);
  }
  return problems;
}

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}\nCopy server/.env.example to server/.env and fill it in.`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const problems = productionProblems(env);
    if (problems.length) {
      throw new Error(`Invalid production environment:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    }
    // Dev login must never be reachable in production.
    env.AUTH_DEV_LOGIN = false;
  }
  return env;
}
