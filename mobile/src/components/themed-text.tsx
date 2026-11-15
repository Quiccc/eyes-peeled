import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /**
   * The type scale: four sizes plus one display size for the big number moments
   * (countdown, points). Two weights only: Bold (700) and Black (900).
   */
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'display';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[styles.base, { color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FontFamily,
  },
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 900,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 900,
  },
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
});
