import * as Haptics from 'expo-haptics';

/** Small haptic vocabulary for the app. Every call is best-effort and never throws. */

/** Light tick when a chunky surface is pressed. */
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A photo was accepted, a purchase went through. */
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
