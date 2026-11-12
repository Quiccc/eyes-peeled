import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'regular' | 'small';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', size = 'regular', loading, disabled, style, ...rest }: Props) {
  const theme = useTheme();
  const bg = {
    primary: theme.tint,
    secondary: theme.backgroundElement,
    danger: theme.danger,
    ghost: 'transparent',
  }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? theme.onTint : variant === 'ghost' ? theme.tint : theme.text;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'small' ? styles.small : styles.regular,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText type={size === 'small' ? 'smallBold' : 'default'} style={[styles.label, { color: fg }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  regular: {
    minHeight: 52,
    paddingHorizontal: Spacing.four,
  },
  small: {
    minHeight: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },
  label: {
    fontWeight: 700,
  },
});
