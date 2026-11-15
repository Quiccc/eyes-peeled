import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: theme.tint, borderBottomWidth: 3, borderBottomColor: theme.tintEdge },
              { opacity: pressed && !selected ? 0.6 : 1 },
            ]}>
            <ThemedText style={[styles.label, { color: selected ? theme.onTint : theme.textSecondary }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  segment: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  label: {
    fontWeight: 900,
  },
});
