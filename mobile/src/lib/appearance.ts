import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * The user's Light / Dark / System choice from Profile → Appearance.
 *
 * Applied with Appearance.setColorScheme(), which overrides the color scheme for the whole app
 * at the native level — useColorScheme()/useTheme(), navigation, native tabs, alerts and the
 * status bar all follow it. 'system' maps to 'unspecified' (follow the phone setting).
 */
export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'settings.appearance';
const PREFS: readonly AppearancePref[] = ['system', 'light', 'dark'];

let current: AppearancePref = 'system';
const listeners = new Set<() => void>();

/**
 * Animates a theme switch: must call applyChange() exactly once (e.g. under a snapshot overlay).
 * Registered by <ThemeTransitionOverlay /> at the app root.
 */
type ThemeTransition = (applyChange: () => void) => Promise<void>;
let transition: ThemeTransition | null = null;

export function setThemeTransition(handler: ThemeTransition | null) {
  transition = handler;
}

function apply(pref: AppearancePref) {
  current = pref;
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
  listeners.forEach((l) => l());
}

/** Read the saved choice and apply it. Call once at startup. Never throws. */
export async function loadAppearance(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved && PREFS.includes(saved as AppearancePref)) apply(saved as AppearancePref);
  } catch {
    // Unreadable storage: keep following the system.
  }
}

/** Apply a new choice (crossfaded when a transition is registered) and remember it. Never throws. */
let latestRequest = 0;

export async function setAppearance(pref: AppearancePref): Promise<void> {
  if (pref === current) return;
  // Taps can overlap a running crossfade; only the most recent choice may apply or be saved.
  const request = ++latestRequest;
  const isLatest = () => request === latestRequest;
  // An explicit Light/Dark that matches what's on screen changes nothing visible — skip the animation.
  // ('system' may or may not change the colors; crossfading identical frames is harmless.)
  const visibleChange = pref === 'system' || pref !== Appearance.getColorScheme();
  if (transition && visibleChange) {
    let applied = false;
    const applyOnce = () => {
      if (applied) return;
      applied = true;
      if (isLatest()) apply(pref);
    };
    try {
      await transition(applyOnce);
    } catch (e) {
      console.warn('Theme transition failed', e);
    }
    applyOnce(); // the theme must switch even if the animation failed
  } else {
    apply(pref);
  }
  if (!isLatest()) return;
  try {
    await SecureStore.setItemAsync(KEY, pref);
  } catch (e) {
    console.warn('Could not save appearance', e);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current Light / Dark / System choice (not the resolved scheme — use useColorScheme for that). */
export function useAppearancePref(): AppearancePref {
  return useSyncExternalStore(subscribe, () => current);
}
