# Eyes Peeled API

The Express 5 + Drizzle backend that implements [`docs/api-contract.md`](../docs/api-contract.md). Response types come straight from the app's [`mobile/src/api/types.ts`](../mobile/src/api/types.ts), so the two can't drift apart.

## Run it locally

```bash
cd server
npm install
cp .env.example .env      # works as-is for local dev
npm run dev               # http://localhost:4000, restarts on save
```

You don't need Docker or a Postgres install. With `DATABASE_URL` empty, the server uses **PGlite** (Postgres running inside Node) and keeps its data in `server/data/db`. Delete `server/data/` to start fresh. Migrations run and the word pool is seeded on every start.

Photos are checked by a **stub** that accepts about 60% of them until you set `ANTHROPIC_API_KEY` in `.env`. Then each photo is sent to Claude (`VERIFY_MODEL`, default `claude-haiku-5-5`), which answers whether a real example of the word is in it and how sure it is.

### Point the app at it

In the app's `mobile/.env.local`:

```
EXPO_PUBLIC_USE_MOCK_API=false
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000   # your computer's LAN IP (phone); 10.0.2.2 on the Android emulator
EXPO_PUBLIC_DEV_LOGIN=alex                     # sign in as test user "alex", no Apple/Google needed
```

Also set `PUBLIC_BASE_URL` in `server/.env` to that same URL, so photo links work on the phone. Restart `npx expo start` after changing env vars.

### Try it with curl

```bash
curl -X POST localhost:4000/auth/signin -H "Content-Type: application/json" \
  -d '{"provider":"google","idToken":"dev:alex"}'
curl localhost:4000/daily -H "Authorization: Bearer <accessToken>"
```

## Scripts

| | |
|---|---|
| `npm run dev` | Start with reload on save |
| `npm start` | Start without reload |
| `npm test` | Vitest + supertest on an in-memory database |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate -- --name <change>` | After editing `src/db/schema.ts`, write a new migration to `drizzle/` and commit it |

## Layout

```
src/
  index.ts        startup: env, database, seed, re-check pending photos, listen
  app.ts          Express app: middleware + routes (tests use this directly)
  env.ts          every setting, validated (see .env.example)
  db/             schema.ts (tables) and client.ts (PGlite or Postgres)
  auth/           Apple / Google / dev sign-in, access + refresh tokens
  domain/         fixed value sets (difficulties, statuses, report reasons) used by schema, validation and admin
  dto/admin.ts    /admin/* response types, imported by the admin panel
  lib/            errors, validation (ids, months, dates), UTC date math, presenters, SQL helpers
  middleware/     auth (players), admin (ADMIN_TOKEN), app version
  routes/         thin HTTP layer: parse the request, call a service, send the result
    admin/        moderation.ts and panel.ts (schedule, words, stats)
  services/       all game logic, one concern per file:
                  users / account, daily-words / schedule / words,
                  submissions + verification (the verdict worker), scoring, leaderboard, profile,
                  relationships / friend-requests / feed / search, moderation, revenuecat,
                  verifier + claude-verifier (the photo check), storage, queue
  seed/words.ts   the starting word pool (any physical object works)
admin/            the admin panel (Vite + React), see admin/README.md
drizzle/          SQL migrations (generated, committed)
test/
```

## How it works

- **Tokens:** the access token is a JWT valid for 15 min. The refresh token is opaque, valid for 60 days, and stored only as a hash. Each `/auth/refresh` replaces it with a new one.
- **Daily words:** plan them ahead in the [admin panel](admin/README.md) (Schedule → "Fill empty slots", then change any future day). A day nobody planned gets its words picked on its first request. Picks use only enabled words, avoid repeats within 14 days on either side, and spread repeats as widely as the pool allows. Set `AUTO_SCHEDULE=true` to fill next month automatically during the first week.
- **Thresholds:** a photo passes when Claude finds the word with confidence at least `VERIFY_MIN_CONFIDENCE` (default 0.7), or the word's own threshold when one is set (admin panel → Words). Photos of screens or printed pictures don't count, and text in the photo is ignored. If Claude refuses to judge a photo, it counts as not found. If the API is down or times out, the photo is marked `error` and doesn't use up a try.
- **Testing the photo check:** put real photos in `server/eval-photos/<word>/{match,near-miss,screen}/` (git ignores the folder) and run `npm run eval:photos`. Each photo is resized like the app does and judged by the same code the server uses. The script prints each verdict, the errors at thresholds 0.5–0.9 with a suggested `VERIFY_MIN_CONFIDENCE`, and the cost per photo and per day (`--players N`, default 1000). Options: `--model`, `--concurrency`, `--price-in`/`--price-out` ($ per million tokens). Raw results go to `eval-photos/results-<time>.json`. Needs `ANTHROPIC_API_KEY`.
- **Photos:** each upload is saved and then checked by the verifier, two at a time. If the verdict takes longer than 8 s, the app gets `pending` and polls. Pending photos left over from a restart are checked again at startup.
- **Image URLs:** these are signed and expire after 1 h. Files live in `server/data/uploads`. Moving to S3/R2 only means implementing the interface in `services/storage.ts`.
- **Admin** (needs `ADMIN_TOKEN`; wrong or missing token = 404). Use the [admin panel](admin/README.md) at `/admin-panel/`, or call the API with `Authorization: Bearer <ADMIN_TOKEN>`:
  - Moderation: `GET /admin/reports?status=open|resolved`, `POST /admin/reports/:id/resolve`, `POST /admin/submissions/:id/remove`, `POST /admin/users/:id/remove-avatar`, `POST /admin/users/:id/ban`, `POST /admin/users/:id/unban`
  - Schedule: `GET /admin/schedule?month=YYYY-MM`, `POST /admin/schedule { month }` (fills empty days only), `PUT /admin/schedule/:date/:difficulty { wordId }` (future days only)
  - Words: `GET /admin/words`, `POST /admin/words { label, difficulty }`, `PATCH /admin/words/:id { enabled?, minConfidence? }`
  - `GET /admin/stats?from&to`, `GET /admin/check`
- **RevenueCat:** in dev with no `REVENUECAT_SECRET_KEY`, `POST /me/purchases/sync` grants Premium. The webhook is at `POST /webhooks/revenuecat`; set the same `Authorization` value in RevenueCat as `REVENUECAT_WEBHOOK_AUTH`.

## Before production

Deploying to a VPS (Docker Compose with Postgres and Caddy for HTTPS) is covered step by step in [`deploy/README.md`](../deploy/README.md).

- Use a real Postgres (`DATABASE_URL`), long random secrets, `NODE_ENV=production` (this turns dev login off), and HTTPS.
- With `NODE_ENV=production` the server refuses to start if `ANTHROPIC_API_KEY`, `REVENUECAT_SECRET_KEY` or `REVENUECAT_WEBHOOK_AUTH` is missing, or if a secret is still a `change-me` placeholder from `.env.example`.
- Behind a proxy, set `TRUST_PROXY` (e.g. `1`) so rate limits see each client's IP. Per IP per minute, `/auth/*` allows 20 requests, `/files/*` (photos) 600, and everything else 120.
- Set `GOOGLE_WEB_CLIENT_ID`, the RevenueCat keys, `ADMIN_TOKEN` and `MIN_APP_VERSION`.
- Set `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (a key with Sign in with Apple enabled). Without them, deleting an Apple account doesn't revoke its Apple token, which App Review requires.
- Logs are JSON lines from pino (`LOG_LEVEL`, default `info`). Every response has an `x-request-id` header that also appears in its log lines.
- Photos are stored on local disk under `DATA_DIR`. That's fine on a single VPS with a volume and backups; implement the `Storage` interface in `src/services/storage.ts` for S3/R2 if you ever run more than one instance.
