import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

const SIZES = {
  large: { tile: 112, radius: 36, icon: 60 },
  medium: { tile: 96, radius: 32, icon: 52 },
} as const;

/** The darker band under the tile, below the full-size face. */
const EDGE = 8;

type Props = {
  icon: IconName;
  size: keyof typeof SIZES;
  style?: StyleProp<ViewStyle>;
};

/** The tilted orange tile with a big icon that tops the sign-in and Premium screens. */
export function HeroBadge({ icon, size, style }: Props) {
  const theme = useTheme();
  const s = SIZES[size];
  return (
    <View
      style={[
        styles.badge,
        { width: s.tile, height: s.tile + EDGE, borderRadius: s.radius, backgroundColor: theme.tintEdge },
        style,
      ]}>
      <View style={[styles.face, { height: s.tile, borderRadius: s.radius, backgroundColor: theme.tint }]}>
        <Icon name={icon} size={s.icon} color={theme.onTint} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    transform: [{ rotate: '-6deg' }],
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
