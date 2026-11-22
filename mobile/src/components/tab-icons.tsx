import Svg, { Circle, Path } from 'react-native-svg';

import { GOLD, INK, IRIS, LID } from '@/components/illustrations/art-kit';
import { useTheme } from '@/hooks/use-theme';

export type TabIconName = 'today' | 'ranks' | 'friends' | 'profile';

/**
 * The tab bar's own icons, drawn in the logo's style on a 24 grid: ink outlines and flat fills.
 * In full colour on the active (orange) key; muted to the secondary text colour and cream fills otherwise.
 */
export function TabIcon({ name, active, size = 26 }: { name: TabIconName; active: boolean; size?: number }) {
  const theme = useTheme();
  const muted = theme.backgroundSelected;
  const c = active
    ? {
        o: INK,
        white: '#FFFFFF',
        cream: '#FFF1DC',
        fold: LID,
        tick: '#2FB344',
        silver: '#C9D1D9',
        gold: GOLD,
        bronze: '#E0A072',
        blue: IRIS,
        green: '#2FB344',
        clip: '#FF8A00',
      }
    : {
        o: theme.textSecondary,
        white: theme.backgroundElement,
        cream: theme.backgroundElement,
        fold: muted,
        tick: theme.textSecondary,
        silver: muted,
        gold: muted,
        bronze: muted,
        blue: muted,
        green: muted,
        clip: muted,
      };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c.o} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {name === 'today' && (
        <>
          <Path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill={c.cream} />
          <Path d="M15 3v4h4z" fill={c.fold} />
          <Path d="M8.5 13.5l2.5 2.5 4.5-5" stroke={c.tick} strokeWidth={2.6} />
        </>
      )}
      {name === 'ranks' && (
        <>
          <Path d="M3 14h6v7H3z" fill={c.silver} />
          <Path d="M15 16h6v5h-6z" fill={c.bronze} />
          <Path d="M9 11h6v10H9z" fill={c.gold} />
          <Path d="M9 8l1-4.5 2 2.2 2-2.2 1 4.5z" fill={c.gold} />
        </>
      )}
      {name === 'friends' && (
        <>
          <Circle cx={16} cy={9} r={5.5} fill={c.white} />
          <Circle cx={17} cy={9} r={2.2} fill={c.blue} strokeWidth={1.6} />
          <Circle cx={17} cy={9} r={0.9} fill={c.o} stroke="none" />
          <Circle cx={9} cy={14} r={6.5} fill={c.white} />
          <Circle cx={10.3} cy={13.4} r={2.8} fill={c.blue} strokeWidth={1.6} />
          <Circle cx={10.3} cy={13.4} r={1.2} fill={c.o} stroke="none" />
        </>
      )}
      {name === 'profile' && (
        <>
          <Path d="M6 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill={c.white} />
          <Path d="M10 2h4v4h-4z" fill={c.clip} />
          <Circle cx={12} cy={11.5} r={2.8} fill={c.green} />
          <Path d="M7.5 18.5a4.5 4 0 0 1 9 0z" fill={c.green} />
        </>
      )}
    </Svg>
  );
}

/** The Hunt shutter's camera: a white body with the mascot's blue lens and a gold flash. */
export function HuntCameraIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8.5a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#FFFFFF" />
      <Circle cx={12} cy={13} r={4} fill={IRIS} />
      <Circle cx={12} cy={13} r={1.6} fill={INK} stroke="none" />
      <Circle cx={11} cy={12} r={0.7} fill="#FFFFFF" stroke="none" />
      <Circle cx={17.6} cy={9.2} r={1.1} fill={GOLD} strokeWidth={1.2} />
    </Svg>
  );
}

/** Shown on the shutter once every word is found: the eye has closed until tomorrow's words. */
export function SleepyEyeIcon({ size = 34 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={14} r={7} fill="#FFFFFF" />
      <Path d="M4 14a7 7 0 0 1 14 0q-7 3.6-14 0z" fill={LID} />
      <Path d="M7.2 16.4l-0.9 1.7M11 17.4v1.9M14.8 16.4l0.9 1.7" strokeWidth={1.8} />
      <Path d="M17 3.5h3.5l-3.5 4h3.5" stroke={theme.successText} strokeWidth={1.8} />
    </Svg>
  );
}
