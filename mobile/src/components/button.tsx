import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Chunky } from '@/components/chunky';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  /** primary: orange. secondary: card. danger: card with red label. ink: near-black (light) / cream (dark). ghost: text only. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ink' | 'ghost';
  size?: 'regular' | 'small';
  /** Face height override, e.g. 56 for hero calls to action. */
  height?: number;
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'regular',
  height,
  icon,
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const small = size === 'small';
  const isDisabled = disabled || loading;
  const fg = {
    primary: theme.onTint,
    secondary: theme.text,
    danger: theme.dangerText,
    ink: theme.onInk,
    ghost: theme.textSecondary,
  }[variant];
  const sizeStyle = [small ? styles.small : styles.regular, height ? { minHeight: height } : null];
  const tall = (height ?? 0) >= 56;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <>
      {icon && <Icon name={icon} size={small ? 16 : 20} color={fg} />}
      <ThemedText
        type={small ? 'smallBold' : tall && variant === 'primary' ? 'subtitle' : 'default'}
        style={[styles.label, { color: fg }]}
        numberOfLines={1}>
        {title}
      </ThemedText>
    </>
  );

  if (variant === 'ghost') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.row,
          sizeStyle,
          { opacity: isDisabled ? 0.5 : pressed ? 0.6 : 1 },
          style,
        ]}
        {...rest}>
        {content}
      </Pressable>
    );
  }

  const face = {
    primary: { color: theme.tint, edge: theme.tintEdge, outlined: false },
    secondary: { color: theme.backgroundElement, edge: theme.border, outlined: true },
    danger: { color: theme.backgroundElement, edge: theme.border, outlined: true },
    ink: { color: theme.ink, edge: theme.inkEdge, outlined: false },
  }[variant];

  return (
    <Chunky
      color={face.color}
      edgeColor={face.edge}
      outlined={face.outlined}
      radius={small ? 14 : tall ? 18 : Radius.md}
      edge={small ? Edge.small : tall && variant === 'primary' ? Edge.card : Edge.button}
      disabled={isDisabled}
      style={style}
      contentStyle={[styles.row, sizeStyle]}
      {...rest}>
      {content}
    </Chunky>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  regular: {
    minHeight: 52,
    paddingHorizontal: Spacing.four,
  },
  small: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  label: {
    fontWeight: 900,
  },
});
