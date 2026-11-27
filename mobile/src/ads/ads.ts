import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import MobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  TestIds,
  type AdsConsentInfo,
} from 'react-native-google-mobile-ads';

/**
 * Full-screen ads only — shown at two moments:
 *  1. when the user picks a word (difficulty) to hunt
 *  2. when the user retries after a rejected photo
 *
 * showInterstitial() always resolves (after the ad closes, fails, or times out)
 * so an ad problem never blocks the game. Failures are retried on the next call
 * rather than disabling ads for the rest of the session.
 */

const PROD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || 'ca-app-pub-5078516573680218/6985552962',
});
const UNIT_ID = __DEV__ || !PROD_UNIT_ID ? TestIds.INTERSTITIAL : PROD_UNIT_ID;

/** Max time to wait for an ad that isn't loaded yet before letting the user continue. */
const LOAD_WAIT_MS = 2500;
/** Background retry after a failed load. */
const RETRY_MS = 30_000;

let initPromise: Promise<boolean> | null = null;
let interstitial: InterstitialAd | null = null;
/** The current interstitial's last load failed; the next showInterstitial() requests a fresh one. */
let lastLoadFailed = false;
/** Turned off for Premium users — then no ad is ever requested or shown. */
let adsEnabled = true;

/**
 * Whether Google requires a "privacy options" entry point for this user (EEA, UK, etc.). Outside those regions
 * the UMP form never opens, so the Profile row is hidden. Known once consent info has been fetched.
 */
let privacyOptionsRequired = false;
const privacyListeners = new Set<() => void>();

function notePrivacyRequirement(info: AdsConsentInfo) {
  const required = info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  if (required === privacyOptionsRequired) return;
  privacyOptionsRequired = required;
  privacyListeners.forEach((listener) => listener());
}

/** Dev-only: say why an ad was (not) shown, so "no ads" reports can be diagnosed from the Metro log. */
function debug(message: string, extra?: unknown) {
  if (__DEV__) console.log(`[ads] ${message}`, ...(extra === undefined ? [] : [extra]));
}

export function setAdsEnabled(enabled: boolean) {
  adsEnabled = enabled;
  if (!enabled) {
    interstitial?.removeAllListeners();
    interstitial = null;
  }
}

function createAndLoad() {
  interstitial?.removeAllListeners();
  lastLoadFailed = false;
  const ad = InterstitialAd.createForAdRequest(UNIT_ID);
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    debug('load error', error);
    if (interstitial !== ad) return;
    lastLoadFailed = true;
    // Retry later; a failed load must not crash or block.
    setTimeout(() => {
      if (interstitial === ad && adsEnabled) createAndLoad();
    }, RETRY_MS);
  });
  ad.load();
  interstitial = ad;
}

/**
 * Consent (UMP / GDPR), then iOS App Tracking Transparency, then SDK init + preload.
 * Safe to call repeatedly: a successful init is cached, a failed one is retried on the next call.
 */
export function initAds(): Promise<boolean> {
  initPromise ??= (async () => {
    const started = Date.now();
    const step = (name: string) => debug(`init: ${name} (+${Date.now() - started}ms)`);
    try {
      step('gathering consent…');
      let consent;
      try {
        consent = await AdsConsent.gatherConsent();
        step(`consent done, status=${consent.status}, canRequestAds=${consent.canRequestAds}`);
      } catch (e) {
        // The consent refresh is a network call to Google (UMP) and can fail (offline, DNS/ad blockers).
        // Per Google's UMP guidance, consent stored from a previous session may still be used to request ads.
        consent = await AdsConsent.getConsentInfo();
        step(`consent refresh failed (${e instanceof Error ? e.message : String(e)}); stored canRequestAds=${consent.canRequestAds}`);
      }
      notePrivacyRequirement(consent);
      if (Platform.OS === 'ios') {
        const { status } = await getTrackingPermissionsAsync();
        step(`tracking status=${status}`);
        if (status === 'undetermined') {
          step('requesting tracking permission…');
          const res = await requestTrackingPermissionsAsync();
          step(`tracking permission → ${res.status}`);
        }
      }
      if (!consent.canRequestAds) {
        debug('consent: canRequestAds=false', consent.status);
        return false;
      }
      step('initializing SDK…');
      await MobileAds().initialize();
      step('SDK initialized, loading first ad');
      if (adsEnabled) createAndLoad();
      return true;
    } catch (e) {
      console.warn('Ads init failed', e);
      return false;
    }
  })().then((ok) => {
    if (!ok) initPromise = null; // allow a retry instead of disabling ads for the session
    return ok;
  });
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
  if (!adsEnabled) {
    debug('skipped: disabled (premium)');
    return;
  }
  const ready = await Promise.race([initAds(), new Promise<boolean>((r) => setTimeout(() => r(false), LOAD_WAIT_MS))]);
  if (!ready) {
    debug(`skipped: init not ready within ${LOAD_WAIT_MS}ms (or consent/init failed)`);
    return;
  }

  // No ad, or the preloaded one failed: request a fresh one now instead of waiting for the background retry.
  if (!interstitial || (lastLoadFailed && !interstitial.loaded)) createAndLoad();
  const ad = interstitial;
  if (!ad) return;
  if (!(await waitForLoad(ad, LOAD_WAIT_MS))) {
    debug(`skipped: no ad loaded within ${LOAD_WAIT_MS}ms`);
    return;
  }

  await new Promise<void>((resolve) => {
    ad.addAdEventListener(AdEventType.CLOSED, () => resolve());
    ad.addAdEventListener(AdEventType.ERROR, (error) => {
      debug('show error', error);
      resolve();
    });
    ad.show().catch((error: unknown) => {
      debug('show error', error);
      resolve();
    });
  });
  // Preload the next one (unless the user went Premium meanwhile).
  if (adsEnabled) createAndLoad();
}

/** True when the "Ad privacy options" row should be shown (Google UMP requires it in regulated regions). */
export function useAdPrivacyOptionsRequired() {
  return useSyncExternalStore(
    (listener) => {
      privacyListeners.add(listener);
      return () => privacyListeners.delete(listener);
    },
    () => privacyOptionsRequired,
  );
}

/** For the "Ad privacy options" row in Profile. */
export async function showAdPrivacyOptions() {
  try {
    notePrivacyRequirement(await AdsConsent.showPrivacyOptionsForm());
  } catch (e) {
    console.warn('Privacy options unavailable', e);
  }
}
