import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

const SIZES = {
  large: { tile: 112, radius: 36, icon: 60 },
  medium: { tile: 96, radius: 32, icon: 52 },
} as const;

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
        { width: s.tile, height: s.tile, borderRadius: s.radius, backgroundColor: theme.tint, borderBottomColor: theme.tintEdge },
        style,
      ]}>
      <Icon name={icon} size={s.icon} color={theme.onTint} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
});
