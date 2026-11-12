# Word Hunt

A daily real-world scavenger hunt for iOS and Android. Every day at 00:00 UTC, three words go live (easy, medium, hard). Players find the real object, photograph it in the app, and a YOLO model checks the photo. Earlier valid photos and harder words earn more points. Leaderboards reset monthly, and friends can see each other's finds for the day.

Built with Expo SDK 58, Expo Router (native tabs), TanStack Query, AdMob, and Apple/Google sign-in.

## Run it

The app uses native modules (camera, AdMob, Google Sign-In), so it needs a **development build**. Expo Go won't work.

```bash
npm install
cp .env.example .env.local          # mock API is on by default

# build a dev client once (cloud), then install it on your device or simulator
npx eas-cli@latest build --profile development --platform ios      # or android
# or build locally if you have Xcode or Android Studio:
npx expo run:ios                    # npx expo run:android

npx expo start                      # then open the app in the dev client
```

With `EXPO_PUBLIC_USE_MOCK_API=true`, or with no `EXPO_PUBLIC_API_URL` set, the app runs against an in-memory mock backend (`src/api/mock.ts`). Sign-in is simulated, and each photo is randomly accepted about 60% of the time. Set `EXPO_PUBLIC_MOCK_RESET_IN_SECONDS=30` to test the daily rollover.

## Connect your backend

Implement [`docs/api-contract.md`](docs/api-contract.md), then set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCK_API=false`.

## Before shipping

- `app.json`: set your real `ios.bundleIdentifier` and `android.package`, the Google `iosUrlScheme`, and the AdMob `iosAppId`/`androidAppId`. Test IDs are filled in for now.
- `.env`: set the Google client IDs and the AdMob interstitial unit IDs. Development builds always use Google's test ad units.
- App Store: privacy nutrition labels (camera, identifiers for ads), the content moderation process for reports, and a privacy policy URL.

## Layout

```
src/app/            routes: sign-in, choose-username, (tabs)/{index,leaderboard,friends,profile}, hunt/[wordId], user/[userId]
src/api/            types, HTTP client (token refresh), endpoints, mock backend
src/auth/           AuthProvider, Apple/Google sign-in, SecureStore tokens
src/ads/            consent + ATT + interstitials (shown on word selection and on retry)
src/features/hunt/  photo resize/compress, upload + poll
src/components/     UI building blocks
```

## Checks

```bash
npx tsc --noEmit && npx expo lint && npx expo-doctor
```
