import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Difficulty } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL } from '@/lib/format';

type PillProps = {
  label: string;
  bg: string;
  color: string;
  /** Hugs its label at the start of its row by default; pass e.g. `{ alignSelf: 'center' }` to override. */
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, bg, color, style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <ThemedText type="smallBold" style={[styles.label, { color }]}>
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );
}

export function DifficultyPill({ difficulty, style }: { difficulty: Difficulty; style?: StyleProp<ViewStyle> }) {
  const c = difficultyColors(useTheme(), difficulty);
  return <Pill label={DIFFICULTY_LABEL[difficulty]} bg={c.bg} color={c.text} style={style} />;
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
