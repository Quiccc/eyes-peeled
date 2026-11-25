import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { GOLD, INK, IRIS, LID } from '@/components/illustrations/art-kit';
import { useTheme } from '@/hooks/use-theme';

/**
 * The Profile tab's icons, in the tab bar's style (components/tab-icons.tsx): a 24 grid, 2px ink outlines and
 * flat logo colours. Decorative: the row or option label names the action. Paths match the "Word Hunt
 * Redesign" canvas (Profile & Premium page).
 */

const WHITE = '#FFFFFF';
const ORANGE = '#FF8A00';
const RED = '#F0524F';
const GREEN = '#2FB344';

/** Fixed pastel tiles under the account row icons, so the ink outline reads in both themes. */
export const SETTINGS_TILE = {
  restore: '#DDF5E1',
  privacy: '#DCEFFB',
  blocked: '#FDE1E0',
  signOut: '#FFF1DC',
} as const;

function Frame({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {children}
    </Svg>
  );
}

/* ---------- Account rows ---------- */

/** "Restore purchases": a white shopping bag with a green tick. */
export function RestoreIcon() {
  return (
    <Frame>
      <Path d="M5 8h14l-1.2 12.5H6.2z" fill={WHITE} />
      <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <Path d="M9 14.2l2.2 2.2 4-4.4" stroke={GREEN} strokeWidth={2.6} />
    </Frame>
  );
}

/** "Ad privacy options": a white shield with the mascot's eye. */
export function PrivacyIcon() {
  return (
    <Frame>
      <Path d="M12 2.8l7.5 3.2v5.2c0 5.2-3.3 8.6-7.5 10.2-4.2-1.6-7.5-5-7.5-10.2V6z" fill={WHITE} />
      <Circle cx={12} cy={11.5} r={3.6} fill={IRIS} strokeWidth={1.6} />
      <Circle cx={12} cy={11.5} r={1.5} fill={INK} stroke="none" />
    </Frame>
  );
}

/** "Blocked users": a white no-entry sign with an ink-edged red bar. */
export function BlockedIcon() {
  return (
    <Frame>
      <Circle cx={12} cy={12} r={8.5} fill={WHITE} />
      <Path d="M6.2 6.2l11.6 11.6" strokeWidth={4.4} />
      <Path d="M6.2 6.2l11.6 11.6" stroke={RED} strokeWidth={2.2} />
    </Frame>
  );
}

/** "Sign out": a door with an arrow walking out of it. */
export function SignOutIcon() {
  return (
    <Frame>
      <Path d="M4 3.5h9.5v17H4z" fill={LID} />
      <Circle cx={10.5} cy={12.5} r={0.9} fill={INK} stroke="none" />
      <Path d="M13.5 12h7M17.5 8.8l3.2 3.2-3.2 3.2" strokeWidth={2.2} />
    </Frame>
  );
}

/* ---------- Appearance options: full colour on the selected (orange) key, muted otherwise ---------- */

export type AppearanceGlyph = 'system' | 'light' | 'dark';

export function AppearanceIcon({ name, selected, size = 20 }: { name: AppearanceGlyph; selected: boolean; size?: number }) {
  const theme = useTheme();
  const o = selected ? INK : theme.textSecondary;
  const white = selected ? WHITE : theme.backgroundElement;
  const fill = selected ? GOLD : theme.backgroundSelected;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={o}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {name === 'system' ? (
        <>
          <Circle cx={12} cy={12} r={7.5} fill={white} />
          <Path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill={o} />
        </>
      ) : name === 'light' ? (
        <>
          <Circle cx={12} cy={12} r={4.2} fill={fill} />
          <Path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </>
      ) : (
        <>
          <Path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10z" fill={selected ? LID : theme.backgroundSelected} />
          <Path d="M17 3.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill={o} strokeWidth={1} />
        </>
      )}
    </Svg>
  );
}

/* ---------- Stat tiles ---------- */

/** "pts this month": a gold four-point sparkle. */
export function PointsIcon({ size = 18 }: { size?: number }) {
  return (
    <Frame size={size}>
      <Path d="M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4-2.4 7.1-2.4-7.1L2.5 12l7.1-2.4z" fill={GOLD} />
    </Frame>
  );
}

/** "global rank": a gold medal on a blue and red ribbon. */
export function MedalIcon({ size = 18 }: { size?: number }) {
  return (
    <Frame size={size}>
      <Path d="M7.5 2.5h3.5l2.5 6H10z" fill={IRIS} />
      <Path d="M16.5 2.5H13l-2.5 6H14z" fill={RED} />
      <Circle cx={12} cy={15} r={6} fill={GOLD} />
      <Circle cx={12} cy={15} r={2.8} strokeWidth={1.5} />
    </Frame>
  );
}

/** The streak flame, lit (orange and gold) or out (muted) when the streak is 0. */
export function StreakIcon({ lit, size = 18 }: { lit: boolean; size?: number }) {
  const theme = useTheme();
  const o = lit ? INK : theme.textSecondary;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={o}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Path
        d="M12 2.5c1.2 3.8 6 5.2 6 10.8a6 6 0 0 1-12 0c0-2.6 1.3-4.1 2.6-5.2.1 2.2 1.2 3.4 2.4 3.6-.6-3.6.2-6.4 1-9.2z"
        fill={lit ? ORANGE : theme.backgroundSelected}
      />
      <Path
        d="M12 12.6c.8 1.8 3 2.6 3 5a3 3 0 0 1-6 0c0-1.6 1-2.6 1.8-3.4.3 1 .9 1.4 1.2 1.4z"
        fill={lit ? GOLD : theme.backgroundElement}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
