import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Difficulty } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

type PillProps = {
  label: string;
  bg: string;
  color: string;
  /** Hugs its label at the start of its row by default; pass e.g. `{ alignSelf: 'center' }` to override. */
  style?: StyleProp<ViewStyle>;
  /** Caps the label's Dynamic Type growth, for pills inside fixed-height layouts. */
  maxFontSizeMultiplier?: number;
  /** Label overrides, e.g. a larger size. */
  textStyle?: StyleProp<TextStyle>;
};

function Pill({ label, bg, color, style, maxFontSizeMultiplier, textStyle }: PillProps) {
  const { i18n } = useTranslation();
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <ThemedText
        type="smallBold"
        style={[styles.label, { color }, textStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {label.toLocaleUpperCase(i18n.language)}
      </ThemedText>
    </View>
  );
}

export function DifficultyPill({
  difficulty,
  style,
  maxFontSizeMultiplier,
  textStyle,
}: {
  difficulty: Difficulty;
  style?: StyleProp<ViewStyle>;
  maxFontSizeMultiplier?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const fmt = useFormat();
  useTranslation();
  const c = difficultyColors(useTheme(), difficulty);
  return (
    <Pill
      label={fmt.difficultyLabel(difficulty)}
      bg={c.bg}
      color={c.text}
      style={style}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      textStyle={textStyle}
    />
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  label: {
    letterSpacing: 0.5,
  },
});
