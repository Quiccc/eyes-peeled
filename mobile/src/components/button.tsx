import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Chunky } from '@/components/chunky';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Card-colored buttons: a 2px outline plus a 4px drop, 6px of bottom band in all. */
const OUTLINED_EDGE = 6;

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  /**
   * primary: orange. success: green (celebrating a find). secondary: card. danger: card with red label.
   * ink: near-black (light) / cream (dark). ghost: text only.
   */
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'ink' | 'ghost';
  size?: 'regular' | 'small';
  /** Face height override, e.g. 56 for hero calls to action. */
  height?: number;
  icon?: IconName;
  loading?: boolean;
  /** Caps the label's Dynamic Type growth, for buttons inside fixed-height layouts. */
  maxFontSizeMultiplier?: number;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'regular',
  height,
  icon,
  loading,
  maxFontSizeMultiplier,
  disabled,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const small = size === 'small';
  const isDisabled = disabled || loading;
  const fg = {
    primary: theme.onTint,
    success: theme.onSuccess,
    secondary: theme.text,
    danger: theme.dangerText,
    ink: theme.onInk,
    ghost: theme.textSecondary,
  }[variant];
  const sizeStyle = [
    small ? styles.small : styles.regular,
    // Small buttons with an icon are a touch tighter (the "Share" chip on a found word).
    small && icon ? styles.smallWithIcon : null,
    variant === 'ghost' && !small ? styles.ghost : null,
    height ? { minHeight: height } : null,
  ];
  const tall = (height ?? 0) >= 56;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <>
      {icon && <Icon name={icon} size={small ? 16 : 20} color={fg} />}
      <ThemedText
        type={small ? 'smallBold' : tall && variant === 'primary' ? 'subtitle' : 'default'}
        style={[styles.label, { color: fg }]}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
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
    success: { color: theme.success, edge: theme.successEdge, outlined: false },
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
      edge={face.outlined ? OUTLINED_EDGE : small ? Edge.small : tall && variant !== 'ink' ? Edge.card : Edge.button}
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
  smallWithIcon: {
    paddingHorizontal: 14,
    gap: 6,
  },
  ghost: {
    minHeight: 48,
  },
  label: {
    fontWeight: 900,
  },
});
