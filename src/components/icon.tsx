import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** One icon set for the whole app: SF Symbols on iOS, Material Symbols on Android. */
const ICONS = {
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events' },
  users: { ios: 'person.2.fill', android: 'group' },
  user: { ios: 'person.fill', android: 'person' },
  lock: { ios: 'lock.fill', android: 'lock' },
  check: { ios: 'checkmark', android: 'check' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  clock: { ios: 'clock', android: 'schedule' },
  search: { ios: 'magnifyingglass', android: 'search' },
  close: { ios: 'xmark', android: 'close' },
  star: { ios: 'star.fill', android: 'star' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right' },
  'no-ads': { ios: 'nosign', android: 'block' },
  retry: { ios: 'arrow.counterclockwise', android: 'replay' },
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
