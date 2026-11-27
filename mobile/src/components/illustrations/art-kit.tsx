import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type en from '@/i18n/locales/en.json';

/** The outline every illustration is drawn with, as on the logo. Fixed in both themes. */
export const INK = '#2B2118';
/** The logo eyeball's iris blue. */
export const IRIS = '#2D9CDB';
export const GOLD = '#FFC83D';
/** The soft shadow under a raised shape. */
export const SHADOW = 'rgba(43,33,24,0.22)';
/** Squinting / sleepy eyelid. */
export const LID = '#FFD49A';

const W = 140;
const H = 112;

/**
 * An empty-state illustration: a 140×112 drawing on a soft round plate, one picture for screen readers.
 * Children are drawn in the plate's 140×112 coordinate space (the design canvas's artwork grid).
 */
/** Screen-reader descriptions of the illustrations: keys under `art` in the catalogs. */
export type ArtLabel = keyof typeof en.art;

export function ArtFrame({ label, children }: { label: ArtLabel; children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t(`art.${label}`)}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Circle cx={70} cy={58} r={52} fill={theme.backgroundSelected} />
        <G stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          {children}
        </G>
      </Svg>
    </View>
  );
}

/** A four-point gold sparkle centred on (x, y); `r` is its half-width. */
export function Sparkle({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  const k = r / 7;
  return (
    <Path
      d="M0 -7l1.8 5.2L7 0l-5.2 1.8L0 7l-1.8-5.2L-7 0l5.2-1.8z"
      transform={`translate(${x} ${y}) scale(${k})`}
      fill={GOLD}
      strokeWidth={1.5 / k}
    />
  );
}

/** The logo's eyeball mascot (radius 18) centred on (x, y), looking up and to the right. */
export function Eyeball({ x, y, shadow = true }: { x: number; y: number; shadow?: boolean }) {
  return (
    <G>
      {shadow && <Circle cx={x + 2} cy={y + 4} r={18} fill={SHADOW} stroke="none" />}
      <Circle cx={x} cy={y} r={18} fill="#FFFFFF" strokeWidth={4} />
      <Circle cx={x + 4} cy={y - 3} r={8.5} fill={IRIS} strokeWidth={3} />
      <Circle cx={x + 4} cy={y - 3} r={4} fill={INK} stroke="none" />
      <Circle cx={x + 1.5} cy={y - 5.5} r={2} fill="#FFFFFF" stroke="none" />
    </G>
  );
}
