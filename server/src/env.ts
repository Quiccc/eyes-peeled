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
  /** Folder for PGlite data and uploaded photos */
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  FILE_URL_SECRET: z.string().min(32),
  APPLE_BUNDLE_ID: z.string().default('com.wordhunt.app'),
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
  /** Built admin panel, served at /admin-panel. */
  ADMIN_PANEL_DIR: z.string().default('../admin/dist'),
  /** In the first week of each month, plan next month's words automatically (empty days only). */
  AUTO_SCHEDULE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MIN_APP_VERSION: optional,
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}\nCopy server/.env.example to server/.env and fill it in.`);
  }
  const env = parsed.data;
  // Dev login must never be reachable in production.
  if (env.NODE_ENV === 'production') env.AUTH_DEV_LOGIN = false;
  return env;
}
