import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import MobileAds, { AdEventType, AdsConsent, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

/**
 * Full-screen ads only — shown at two moments:
 *  1. when the user picks a word (difficulty) to hunt
 *  2. when the user retries after a rejected photo
 *
 * showInterstitial() always resolves (after the ad closes, fails, or times out)
 * so an ad problem never blocks the game.
 */

const PROD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
});
const UNIT_ID = __DEV__ || !PROD_UNIT_ID ? TestIds.INTERSTITIAL : PROD_UNIT_ID;

/** Max time to wait for an ad that isn't loaded yet before letting the user continue. */
const LOAD_WAIT_MS = 2500;

let initPromise: Promise<boolean> | null = null;
let interstitial: InterstitialAd | null = null;

function createAndLoad() {
  interstitial?.removeAllListeners();
  const ad = InterstitialAd.createForAdRequest(UNIT_ID);
  ad.addAdEventListener(AdEventType.ERROR, () => {
    // Retry later; a failed load must not crash or block.
    setTimeout(() => {
      if (interstitial === ad) createAndLoad();
    }, 30_000);
  });
  ad.load();
  interstitial = ad;
}

/** Consent (UMP / GDPR), then iOS App Tracking Transparency, then SDK init + preload. Safe to call repeatedly. */
export function initAds(): Promise<boolean> {
  initPromise ??= (async () => {
    try {
      const consent = await AdsConsent.gatherConsent();
      if (Platform.OS === 'ios') {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') await requestTrackingPermissionsAsync();
      }
      if (!consent.canRequestAds) return false;
      await MobileAds().initialize();
      createAndLoad();
      return true;
    } catch (e) {
      console.warn('Ads init failed', e);
      return false;
    }
  })();
  return initPromise;
}

function waitForLoad(ad: InterstitialAd, ms: number) {
  if (ad.loaded) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    ad.addAdEventListener(AdEventType.LOADED, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

export async function showInterstitial(): Promise<void> {
  const ready = await Promise.race([initAds(), new Promise<boolean>((r) => setTimeout(() => r(false), LOAD_WAIT_MS))]);
  const ad = interstitial;
  if (!ready || !ad) return;
  if (!(await waitForLoad(ad, LOAD_WAIT_MS))) return;

  await new Promise<void>((resolve) => {
    ad.addAdEventListener(AdEventType.CLOSED, () => resolve());
    ad.addAdEventListener(AdEventType.ERROR, () => resolve());
    ad.show().catch(() => resolve());
  });
  // Preload the next one.
  createAndLoad();
}

/** For the "Privacy options" row in Profile (required by Google UMP in regulated regions). */
export async function showAdPrivacyOptions() {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (e) {
    console.warn('Privacy options unavailable', e);
  }
}
