import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * One icon set for the whole app: SF Symbols on iOS, Material Symbols on Android.
 * Outline glyphs (no `.fill`) to match the design's stroke icons; Material Symbols are outlined by default.
 */
const ICONS = {
  trophy: { ios: 'trophy', android: 'emoji_events' },
  users: { ios: 'person.2', android: 'group' },
  user: { ios: 'person', android: 'person' },
  lock: { ios: 'lock', android: 'lock' },
  check: { ios: 'checkmark', android: 'check' },
  clock: { ios: 'clock', android: 'schedule' },
  search: { ios: 'magnifyingglass', android: 'search' },
  close: { ios: 'xmark', android: 'close' },
  star: { ios: 'star', android: 'star' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right' },
  'no-ads': { ios: 'nosign', android: 'block' },
  retry: { ios: 'arrow.counterclockwise', android: 'replay' },
  'camera-off': { ios: 'video.slash', android: 'no_photography' },
  'chevron-left': { ios: 'chevron.left', android: 'chevron_left' },
  'person-add': { ios: 'person.badge.plus', android: 'person_add' },
  'person-remove': { ios: 'person.badge.minus', android: 'person_remove' },
  flag: { ios: 'flag', android: 'flag' },
  'arrow-up': { ios: 'arrow.up', android: 'arrow_upward' },
} as const satisfies Record<string, Exclude<SymbolViewProps['name'], string>>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  /** Defaults to the theme's text color. */
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color, style }: Props) {
  const theme = useTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? theme.text}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
