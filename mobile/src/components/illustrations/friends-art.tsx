import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ArtFrame, Eyeball, INK, IRIS, LID, SHADOW, Sparkle } from '@/components/illustrations/art-kit';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** No friends' finds yet today: the eyeball peeking over the top of an empty photo. */
export function PeekingPhotoArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="peekingPhoto">
      <Eyeball x={70} y={28} shadow={false} />
      <Rect x={36} y={40} width={68} height={66} rx={6} fill={SHADOW} stroke="none" />
      <Rect x={34} y={36} width={72} height={66} rx={6} fill="#FFFFFF" strokeWidth={4} />
      <Rect x={42} y={44} width={56} height={42} rx={3} fill={theme.background} strokeWidth={3} />
      <Path
        d="M48 56v-6h6M92 56v-6h-6M48 74v6h6M92 74v6h-6"
        fill="none"
        stroke={theme.textSecondary}
        strokeWidth={3}
      />
      <Circle cx={70} cy={65} r={3} fill={theme.textSecondary} stroke="none" />
      <Circle cx={56} cy={37} r={5} fill="#FFFFFF" strokeWidth={3} />
      <Circle cx={84} cy={37} r={5} fill="#FFFFFF" strokeWidth={3} />
      <Sparkle x={116} y={35} />
    </ArtFrame>
  );
}

/** Search found nobody: a magnifying glass with a squinting eye and a question mark. */
export function SquintSearchArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="squintSearch">
      <Line x1={82} y1={74} x2={104} y2={96} strokeWidth={13} />
      <Line x1={84} y1={76} x2={102} y2={94} stroke={theme.tint} strokeWidth={6} />
      <Circle cx={63} cy={56} r={29} fill={SHADOW} stroke="none" />
      <Circle cx={60} cy={52} r={29} fill="#FFFFFF" strokeWidth={5} />
      <Circle cx={62} cy={56} r={11} fill={IRIS} strokeWidth={3} />
      <Circle cx={62} cy={56} r={5} fill={INK} stroke="none" />
      <Path d="M34 48a27 27 0 0 1 52 0q-26 9-52 0z" fill={LID} strokeWidth={3} />
      <Path d="M40 38q4-6 10-6" fill="none" stroke="#FFFFFF" strokeWidth={3} />
      <Path
        d="M95 18h22a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7h-12l-7 6v-6h-3a7 7 0 0 1-7-7v-10a7 7 0 0 1 7-7z"
        fill={theme.medium}
        strokeWidth={3}
      />
      <SvgText
        x={106}
        y={38}
        textAnchor="middle"
        fontFamily={FontFamily}
        fontSize={20}
        fontWeight="900"
        fill="#FFFFFF"
        stroke="none">
        ?
      </SvgText>
    </ArtFrame>
  );
}

/** Friends' finds couldn't load: a paper plane carrying a photo, crashed into a rain cloud. */
export function CrashedPlaneArt() {
  const theme = useTheme();
  return (
    <ArtFrame label="crashedPlane">
      <Path d="M18 34q12 4 22 12" fill="none" stroke={theme.textSecondary} strokeWidth={3} strokeDasharray="4 6" />
      <Line x1={40} y1={56} x2={30} y2={70} strokeWidth={2} />
      <G transform="rotate(-8 28 77)">
        <Rect x={18} y={68} width={20} height={18} rx={2} fill="#FFFFFF" strokeWidth={3} />
        <Rect x={22} y={72} width={12} height={9} fill={theme.easy} stroke="none" />
      </G>
      <Path d="M36 40l46 22-26 2z" fill="#FFFFFF" strokeWidth={4} />
      <Path d="M56 64l26-2-20 14z" fill="#E8D8BD" strokeWidth={4} />
      <Path
        d="M74 58a14 14 0 0 1 26-9a12 12 0 0 1 22 7a10 10 0 0 1-2 20h-42a10 10 0 0 1-4-18z"
        fill="#C9D1D9"
        strokeWidth={4}
      />
      <Circle cx={92} cy={66} r={2.2} fill={INK} stroke="none" />
      <Circle cx={106} cy={66} r={2.2} fill={INK} stroke="none" />
      <Path d="M94 72q5-3 10 0" fill="none" strokeWidth={2.5} />
      <Path d="M86 84l-3 8M100 84l-3 8M114 84l-3 8" fill="none" stroke={theme.medium} strokeWidth={3.5} />
      <Path d="M74 44l2-6M66 48l-4-4" fill="none" stroke={theme.tint} strokeWidth={2.5} />
    </ArtFrame>
  );
}
