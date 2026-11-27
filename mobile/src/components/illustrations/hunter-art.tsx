import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ArtFrame, GOLD, INK, IRIS, LID, SHADOW } from '@/components/illustrations/art-kit';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A hunter's profile couldn't load: their ID badge with a snapped lanyard. */
export function SnappedBadgeArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="snappedBadge">
      <Path d="M50 6l6 14l-3 2l4 2" fill="none" stroke={theme.tint} strokeWidth={5} />
      <Path d="M60 30l3 8" fill="none" stroke={theme.tint} strokeWidth={5} />
      <Path d="M90 6l-12 32" fill="none" stroke={theme.tint} strokeWidth={5} />
      <Rect x={46} y={40} width={52} height={66} rx={10} fill={SHADOW} stroke="none" />
      <G transform="rotate(4 70 69)">
        <Rect x={44} y={36} width={52} height={66} rx={10} fill="#FFFFFF" strokeWidth={4} />
        <Rect x={62} y={42} width={16} height={6} rx={3} fill="#E8D8BD" strokeWidth={2.5} />
        <Circle cx={70} cy={64} r={11} fill={theme.easyBg} strokeWidth={3} />
        <Circle cx={70} cy={61} r={4} fill={theme.easyText} stroke="none" />
        <Path d="M62.5 71a8 7 0 0 1 15 0" fill={theme.easyText} stroke="none" />
        <Line x1={56} y1={84} x2={84} y2={84} stroke="#E8D8BD" strokeWidth={4} />
        <Line x1={60} y1={92} x2={80} y2={92} stroke="#E8D8BD" strokeWidth={4} />
      </G>
      <Circle cx={98} cy={40} r={9} fill={theme.danger} strokeWidth={3} />
      <Line x1={98} y1={35.5} x2={98} y2={40.5} stroke="#FFFFFF" strokeWidth={2.8} />
      <Circle cx={98} cy={44.5} r={1.5} fill="#FFFFFF" stroke="none" />
    </ArtFrame>
  );
}

/** Photos are for friends: two photos held shut by a padlock with a heart keyhole. */
export function LockedPhotosArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="lockedPhotos">
      <G transform="rotate(-10 56 58)">
        <Rect x={30} y={24} width={52} height={62} rx={4} fill="#FFFFFF" strokeWidth={4} />
        <Rect x={36} y={30} width={40} height={38} fill={theme.medium} stroke="none" />
        <Path d="M36 60l12-12 10 10 8-6 10 10v6h-40z" fill={theme.mediumEdge} stroke="none" />
      </G>
      <G transform="rotate(8 86 58)">
        <Rect x={60} y={24} width={52} height={62} rx={4} fill="#FFFFFF" strokeWidth={4} />
        <Rect x={66} y={30} width={40} height={38} fill={theme.hard} stroke="none" />
        <Circle cx={96} cy={40} r={5} fill={GOLD} stroke="none" />
        <Path d="M66 62l14-14 12 12 14-8v16h-40z" fill={theme.hardEdge} stroke="none" />
      </G>
      <Path d="M58 68v-10a12 12 0 0 1 24 0v10" fill="none" strokeWidth={10} />
      <Path d="M58 68v-10a12 12 0 0 1 24 0v10" fill="none" stroke={theme.silver} strokeWidth={4} />
      <Rect x={48} y={70} width={44} height={34} rx={9} fill={theme.tintEdge} stroke="none" />
      <Rect x={48} y={66} width={44} height={32} rx={9} fill={theme.tint} strokeWidth={4} />
      <Path d="M70 90l-7.5-7.5a4.6 4.6 0 0 1 7.5-5.3a4.6 4.6 0 0 1 7.5 5.3z" fill={INK} stroke="none" />
    </ArtFrame>
  );
}

/** Nothing found yet today: sleepy binoculars on a hill as the sun comes up. */
export function SleepyBinocularsArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="sleepyBinoculars">
      <Path d="M104 34v-6M120 46l5-4M88 42l-5-4" fill="none" stroke={GOLD} strokeWidth={3.5} />
      <Circle cx={104} cy={62} r={15} fill={GOLD} strokeWidth={3.5} />
      <Path d="M14 104q56-40 112 0z" fill={theme.easy} strokeWidth={4} />
      <Path d="M34 92q20-12 40-10" fill="none" stroke={theme.easyEdge} strokeWidth={3} />
      <Rect x={60} y={58} width={20} height={12} fill={INK} stroke="none" />
      <Circle cx={55} cy={72} r={16} fill={INK} stroke={theme.textSecondary} strokeWidth={2} />
      <Circle cx={85} cy={72} r={16} fill={INK} stroke={theme.textSecondary} strokeWidth={2} />
      <Circle cx={55} cy={72} r={10} fill="#FFFFFF" stroke="none" />
      <Circle cx={56} cy={75} r={5} fill={IRIS} stroke="none" />
      <Circle cx={56} cy={75} r={2.4} fill={INK} stroke="none" />
      <Path d="M45 72a10 10 0 0 1 20 0z" fill={LID} strokeWidth={2.5} />
      <Circle cx={85} cy={72} r={10} fill="#7E9BAE" stroke="none" />
      <Path d="M80 68q3-4 8-4" fill="none" stroke="#FFFFFF" strokeWidth={3} />
      <SvgText x={34} y={44} fontFamily={FontFamily} fontSize={13} fontWeight="900" fill={theme.textSecondary} stroke="none">
        z
      </SvgText>
      <SvgText x={22} y={32} fontFamily={FontFamily} fontSize={18} fontWeight="900" fill={theme.textSecondary} stroke="none">
        z
      </SvgText>
    </ArtFrame>
  );
}
