import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ArtFrame, Eyeball, GOLD, INK, Sparkle } from '@/components/illustrations/art-kit';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Friends leaderboard is empty: the eyeball ready to race, an empty spot beside it for a friend. */
export function RaceFriendsArt() {
  const theme = useTheme();
  const checks: [number, number][] = [
    [26, 36], [39, 36], [32.5, 42], [45.5, 42], [26, 48], [39, 48],
  ];
  return (
    <ArtFrame label="raceStart">
      <Line x1={20} y1={96} x2={122} y2={96} strokeWidth={4} />
      <Line x1={26} y1={96} x2={26} y2={36} strokeWidth={4} />
      <Rect x={26} y={36} width={26} height={18} fill="#FFFFFF" strokeWidth={3} />
      {checks.map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x} y={y} width={6.5} height={6} fill={INK} stroke="none" />
      ))}
      <Line x1={40} y1={66} x2={46} y2={66} strokeWidth={3} />
      <Line x1={36} y1={74} x2={44} y2={74} strokeWidth={3} />
      <Line x1={57} y1={86} x2={52} y2={95} strokeWidth={4} />
      <Line x1={70} y1={86} x2={77} y2={93} strokeWidth={4} />
      <Eyeball x={63} y={68} />
      <Path d="M52 50q8-6 16-3" fill="none" strokeWidth={4} />
      <Circle cx={104} cy={68} r={17} fill="none" stroke={theme.textSecondary} strokeWidth={3} strokeDasharray="5 6" />
      <Line x1={104} y1={60} x2={104} y2={76} stroke={theme.tint} strokeWidth={5} />
      <Line x1={96} y1={68} x2={112} y2={68} stroke={theme.tint} strokeWidth={5} />
      <Sparkle x={112} y={29} />
    </ArtFrame>
  );
}

/** Nobody has scored this month: an empty podium with the crown hovering over the top step. */
export function FreshMonthArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="emptyPodium">
      <Rect x={18} y={24} width={26} height={26} rx={5} fill="#FFFFFF" strokeWidth={3} />
      <Path d="M18 31v-2a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v2z" fill="#F0524F" strokeWidth={3} />
      <SvgText
        x={31}
        y={47}
        textAnchor="middle"
        fontFamily={FontFamily}
        fontSize={15}
        fontWeight="900"
        fill={INK}
        stroke="none">
        1
      </SvgText>
      <Rect x={30} y={72} width={28} height={28} fill={theme.silver} strokeWidth={4} />
      <Rect x={82} y={80} width={28} height={20} fill={theme.bronze} strokeWidth={4} />
      <Rect x={56} y={58} width={28} height={42} fill={theme.gold} strokeWidth={4} />
      <Line x1={16} y1={100} x2={124} y2={100} strokeWidth={4} />
      <G transform="translate(55 22)">
        <Path d="M4 8l5.5 5L15 5l5.5 8L26 8l-2.5 12h-17z" fill={GOLD} strokeWidth={2.5} />
        <Circle cx={3.5} cy={6} r={2.2} fill={GOLD} strokeWidth={2} />
        <Circle cx={15} cy={3} r={2.2} fill={GOLD} strokeWidth={2} />
        <Circle cx={26.5} cy={6} r={2.2} fill={GOLD} strokeWidth={2} />
      </G>
      <Line x1={62} y1={50} x2={64} y2={54} stroke={theme.textSecondary} strokeWidth={2.5} />
      <Line x1={78} y1={50} x2={76} y2={54} stroke={theme.textSecondary} strokeWidth={2.5} />
      <Sparkle x={104} y={37} />
      <Sparkle x={118} y={61} r={5} />
    </ArtFrame>
  );
}

/** The leaderboard couldn't load: a sad trophy whose plug came out of the wall. */
export function UnpluggedTrophyArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="sadTrophy">
      <Path d="M34 40h-6a8 8 0 0 0 8 14" fill="none" strokeWidth={4} />
      <Path d="M70 40h6a8 8 0 0 1-8 14" fill="none" strokeWidth={4} />
      <Path d="M34 32h36v18a18 18 0 0 1-36 0z" fill={GOLD} strokeWidth={4} />
      <Rect x={48} y={68} width={8} height={10} fill={GOLD} strokeWidth={3.5} />
      <Rect x={38} y={78} width={28} height={10} rx={2} fill="#D46A00" strokeWidth={4} />
      <Circle cx={46} cy={46} r={2.4} fill={INK} stroke="none" />
      <Circle cx={58} cy={46} r={2.4} fill={INK} stroke="none" />
      <Path d="M46 58q6-5 12 0" fill="none" strokeWidth={3} />
      <Path d="M66 84c12 0 12 10 24 10h2" fill="none" strokeWidth={4} />
      <Rect x={92} y={87} width={11} height={14} rx={2} fill={theme.silver} strokeWidth={3} />
      <Line x1={103} y1={91} x2={108} y2={91} strokeWidth={3} />
      <Line x1={103} y1={97} x2={108} y2={97} strokeWidth={3} />
      <Rect x={116} y={80} width={14} height={28} rx={4} fill="#FFFFFF" strokeWidth={3} />
      <Line x1={121} y1={89} x2={121} y2={93} strokeWidth={2.5} />
      <Line x1={125} y1={89} x2={125} y2={93} strokeWidth={2.5} />
      <Path d="M111 84l-1-4M112 94h3M111 103l-1 3" fill="none" stroke={theme.tint} strokeWidth={2.5} />
    </ArtFrame>
  );
}
