# Eyes Peeled

A daily real-world scavenger hunt for iOS and Android. Every day at 00:00 UTC, three words go live (Rookie, Scout, Ranger), plus a 4th Premium word for Premium players. (In code and the API these levels are `easy`, `medium`, `hard` and `expert`.) Players find the real object, photograph it in the app, and a YOLO model checks the photo. Earlier valid photos and harder words earn more points. Leaderboards reset monthly, and friends can see each other's finds for the day.

Built with Expo SDK 58, Expo Router (native tabs), TanStack Query, AdMob, RevenueCat, and Apple/Google sign-in.

The repo has three parts, each with its own dependencies and checks:

| Folder | What it is |
|---|---|
| [`mobile/`](mobile/) | The Expo app (iOS + Android) |
| [`server/`](server/README.md) | Express 5 + Drizzle + Postgres API, plus the [admin panel](server/admin/README.md) it serves |
| [`yolo/`](yolo/README.md) | Python service that checks photos with the YOLO model |

[`docs/api-contract.md`](docs/api-contract.md) is the contract between the app and the server.

## Run it

**Everything at once (Windows):** `.\run.ps1` from the repo root opens a window each for the YOLO service, the server, the admin panel and Expo (installs missing `node_modules` and copies `.env` files on first run). Skip parts with `-NoYolo`, `-NoAdmin`, `-NoMobile`.

The app uses native modules (camera, AdMob, Google Sign-In), so it needs a **development build**. Expo Go won't work.

```bash
cd mobile
npm install
cp .env.example .env.local          # mock API is on by default

# build a dev client once (cloud), then install it on your device or simulator
npx eas-cli@latest build --profile development --platform ios      # or android
# or build locally if you have Xcode or Android Studio:
npx expo run:ios                    # npx expo run:android

npx expo start                      # then open the app in the dev client
```

With `EXPO_PUBLIC_USE_MOCK_API=true`, or with no `EXPO_PUBLIC_API_URL` set in a dev build, the app runs against an in-memory mock backend (`mobile/src/api/mock/`). Sign-in is simulated, and each photo is randomly accepted about 60% of the time. Without RevenueCat keys, buying Premium is simulated too. Set `EXPO_PUBLIC_MOCK_RESET_IN_SECONDS=30` to test the daily rollover.

## Backend

The backend lives in [`server/`](server/README.md): Express 5 + Drizzle + Postgres, implementing [`docs/api-contract.md`](docs/api-contract.md). It runs locally with no database install. Photo checks come from a separate Python YOLO service in [`yolo/`](yolo/README.md).

```bash
cd server && npm install && cp .env.example .env
npm run dev                         # http://localhost:4000 (or `npm run server` from mobile/)
```

Then in `mobile/.env.local` set `EXPO_PUBLIC_USE_MOCK_API=false`, `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000` and `EXPO_PUBLIC_DEV_LOGIN=<any name>` (signs in without Apple/Google in dev builds).

## Premium (in-app purchase)

One non-consumable purchase removes ads and unlocks the daily Premium word. Setup:

1. Create the product: a **non-consumable** in App Store Connect and a **one-time product** in Google Play Console.
2. In RevenueCat, add both apps and the product. Create an entitlement with the identifier **`premium`** and attach the product. Add it to the **current** offering as the **Lifetime** package.
3. Put the public SDK keys in `mobile/.env.local` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`).
4. Backend: implement `POST /me/purchases/sync` and the RevenueCat webhook (see [Purchases](docs/api-contract.md#purchases-premium)).

Purchases need a development build and a sandbox / test-track account, or RevenueCat's Test Store key.

## Before shipping

- `mobile/app.json`: the bundle id / package is `com.eyespeeled.app` (register it with Apple and Google Play). Set the Google `iosUrlScheme`, and the AdMob `iosAppId`/`androidAppId`. Test IDs are filled in for now.
- EAS `preview`/`production` profiles: set `EXPO_PUBLIC_API_URL` (production: `https://api.eyespeeled.app`; server `PUBLIC_BASE_URL` to match). A release build without it stops at launch rather than silently using the mock (set `EXPO_PUBLIC_USE_MOCK_API=true` to ship the mock on purpose).
- `mobile/.env.local`: set the Google client IDs and the AdMob interstitial unit IDs. Development builds always use Google's test ad units.
- App Store: privacy nutrition labels (camera, identifiers for ads), the content moderation process for reports, and a privacy policy URL (`https://eyespeeled.app/privacy`; terms at `/terms`, both linked from the sign-in screen).

## Layout

```
mobile/src/app/            routes (thin): sign-in, choose-username, (tabs)/{index,leaderboard,friends,profile}, hunt/[wordId], user/[userId], premium
mobile/src/api/            types, HTTP client (token refresh), endpoints, queries.ts (shared query hooks + cache invalidation), mock/ backend
mobile/src/auth/           AuthProvider, Apple/Google sign-in, SecureStore tokens
mobile/src/ads/            consent + ATT + interstitials (shown on word selection and on retry; off for Premium)
mobile/src/purchases/      RevenueCat Premium purchase / restore
mobile/src/features/       one folder per feature: hunt (camera, verdict state machine, upload + poll), today, social,
                           premium, safety (report / block), share
mobile/src/components/     UI building blocks shared by features
mobile/src/hooks/          generic hooks (theme, debounce, async button actions)
```

## Checks

```bash
cd mobile && npx tsc --noEmit && npx expo lint && npx expo-doctor
cd server && npm run typecheck && npm test
cd server/admin && npm run build
cd yolo && uv run pytest
```
