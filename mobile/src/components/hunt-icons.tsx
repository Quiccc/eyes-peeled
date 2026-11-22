import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { GOLD, INK, IRIS } from '@/components/illustrations/art-kit';

/**
 * The hunt flow's button icons, in the tab bar's style (components/tab-icons.tsx): a 24 grid,
 * 2px ink outlines and flat logo colours. They are decorative; the button label names the action.
 */
type IconProps = { size?: number };

const ORANGE = '#FF8A00';
const GREEN = '#2FB344';

function Frame({ size = 20, children }: { size?: number; children: React.ReactNode }) {
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

/** "Next word": a chunky white arrow with two speed lines. */
export function NextIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M2.5 10h2.5M2.5 14h2.5" />
      <Path d="M7.5 9h5.5V5.2L20.8 12L13 18.8V15H7.5z" fill="#FFFFFF" />
    </Frame>
  );
}

/** "Share": a tilted photo with a little landscape, and an orange arrow flying out of it. */
export function ShareIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <G transform="rotate(-8 9.5 14)">
        <Rect x={3} y={7.5} width={13} height={13} rx={2.2} fill="#FFFFFF" />
        <Path d="M5.2 18.4l3.3-3.8 2.3 2.3 1.8-1.8 2 3.3z" fill={GREEN} strokeWidth={1.4} />
        <Circle cx={12.3} cy={11} r={1.4} fill={GOLD} strokeWidth={1.2} />
      </G>
      <Path d="M13.6 10.4L19.4 4.6M15.6 4h4.4v4.4" strokeWidth={4.6} />
      <Path d="M13.6 10.4L19.4 4.6M15.6 4h4.4v4.4" stroke={ORANGE} strokeWidth={2.2} />
    </Frame>
  );
}

/** Eight-tooth gear outline, built once. */
const GEAR = (() => {
  const pts: string[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (2 * Math.PI * i) / (teeth * 4) - Math.PI / 2;
    const r = i % 4 === 1 || i % 4 === 2 ? 9.6 : 7.4;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}z`;
})();

/** "Open settings": a white gear whose hub is the mascot's eye. */
export function GearIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <Path d={GEAR} fill="#FFFFFF" />
      <Circle cx={12} cy={12} r={3.8} fill={IRIS} />
      <Circle cx={12} cy={12} r={1.6} fill={INK} stroke="none" />
      <Circle cx={11} cy={11} r={0.7} fill="#FFFFFF" stroke="none" />
    </Frame>
  );
}

/** Combo chip: two chain links, one white and one gold. */
export function LinkIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <G transform="rotate(-40 12 12)">
        <Rect x={2.5} y={8.5} width={11} height={7} rx={3.5} strokeWidth={4.4} />
        <Rect x={2.5} y={8.5} width={11} height={7} rx={3.5} stroke="#FFFFFF" />
        <Rect x={10.5} y={8.5} width={11} height={7} rx={3.5} strokeWidth={4.4} />
        <Rect x={10.5} y={8.5} width={11} height={7} rx={3.5} stroke={GOLD} />
        <Path d="M10.6 10.2v-1" strokeWidth={4.4} />
        <Path d="M10.6 10.6v-1.4" stroke="#FFFFFF" />
      </G>
    </Frame>
  );
}

/** Streak / "all found" line: an orange flame with a gold core. */
export function FlameIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M12 2.5c1.2 3.8 6 5.2 6 10.8a6 6 0 0 1-12 0c0-2.6 1.3-4.1 2.6-5.2.1 2.2 1.2 3.4 2.4 3.6-.6-3.6.2-6.4 1-9.2z"
        fill={ORANGE}
      />
      <Path
        d="M12 12.6c.8 1.8 3 2.6 3 5a3 3 0 0 1-6 0c0-1.6 1-2.6 1.8-3.4.3 1 .9 1.4 1.2 1.4z"
        fill={GOLD}
        strokeWidth={1.5}
      />
    </Frame>
  );
}

/**
 * The viewfinder's flash toggle. On: a white bolt with an ink outline (sits on the gold button).
 * Off: a white outlined bolt with a slash (sits on the dark glass button, where ink would vanish).
 */
export function FlashIcon({ on, size }: IconProps & { on: boolean }) {
  const bolt = 'M13.5 2.5L5 13.5h6l-1.5 8 9-11.5h-6z';
  return (
    <Frame size={size}>
      {on ? (
        <Path d={bolt} fill="#FFFFFF" />
      ) : (
        <>
          <Path d={bolt} stroke="#FFFFFF" />
          <Path d="M3.5 3.5l17 17" stroke="#FFFFFF" strokeWidth={2.2} />
        </>
      )}
    </Frame>
  );
}
