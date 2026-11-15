# Word Hunt API

The Express 5 + Drizzle backend that implements [`docs/api-contract.md`](../docs/api-contract.md). Response types come straight from the app's [`src/api/types.ts`](../src/api/types.ts), so the two can't drift apart.

## Run it locally

```bash
cd server
npm install
cp .env.example .env      # works as-is for local dev
npm run dev               # http://localhost:4000, restarts on save
```

You don't need Docker or a Postgres install. With `DATABASE_URL` empty, the server uses **PGlite** (Postgres running inside Node) and keeps its data in `server/data/db`. Delete `server/data/` to start fresh. Migrations run and the word pool is seeded on every start.

Photos are checked by a **stub** that accepts about 60% of them until you run the YOLO service in [`../yolo`](../yolo/README.md) and set `YOLO_URL`.

### Point the app at it

In the app's `.env.local`:

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
  routes/         one file per area of the contract
  services/       game logic: daily words, submissions, scoring, leaderboard, social, RevenueCat
  seed/words.ts   the word pool. Every label must be a class your YOLO model detects
drizzle/          SQL migrations (generated, committed)
test/
```

## How it works

- **Tokens:** the access token is a JWT valid for 15 min. The refresh token is opaque, valid for 60 days, and stored only as a hash. Each `/auth/refresh` replaces it with a new one.
- **Daily words:** the first request of each UTC day picks one word per difficulty and avoids repeating any word from the last 14 days.
- **Photos:** each upload is saved and then checked by the verifier, two at a time. If the verdict takes longer than 8 s, the app gets `pending` and polls. Pending photos left over from a restart are checked again at startup.
- **Image URLs:** these are signed and expire after 1 h. Files live in `server/data/uploads`. Moving to S3/R2 only means implementing the interface in `services/storage.ts`.
- **Moderation** (needs `ADMIN_TOKEN`):
  - `GET /admin/reports`
  - `POST /admin/reports/:id/resolve`
  - `POST /admin/submissions/:id/remove`
  - `POST /admin/users/:id/ban`

  Send `Authorization: Bearer <ADMIN_TOKEN>` with each one.
- **RevenueCat:** in dev with no `REVENUECAT_SECRET_KEY`, `POST /me/purchases/sync` grants Premium. The webhook is at `POST /webhooks/revenuecat`; set the same `Authorization` value in RevenueCat as `REVENUECAT_WEBHOOK_AUTH`.

## Before production

- Use a real Postgres (`DATABASE_URL`), long random secrets, `NODE_ENV=production` (this turns dev login off), and HTTPS.
- Set `GOOGLE_WEB_CLIENT_ID`, the RevenueCat keys, `ADMIN_TOKEN` and `MIN_APP_VERSION`.
- Move photos to object storage.
- **Not implemented yet: Apple token revocation on account deletion.** The app has to send Apple's `authorizationCode`. There's a TODO in `routes/me.ts`.
