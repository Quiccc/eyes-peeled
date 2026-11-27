import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';

type Option<T extends string> = {
  value: T;
  label: string;
  /** A small glyph before the label, drawn for the selected (orange) or resting state. */
  icon?: (selected: boolean) => ReactNode;
  /** A red count after the label (pending friend requests); hidden at 0. */
  badge?: number;
  /** Read instead of the label, e.g. to say what the badge counts. */
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Segment height: 44 by default, 40 for the compact control above the leaderboard. */
  height?: 40 | 44;
};

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, height = 44 }: Props<T>) {
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
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              { height },
              // The edge sits below the face, so the label stays centered.
              selected && { backgroundColor: theme.tint, boxShadow: `0 3px 0 ${theme.tintEdge}` },
              { opacity: pressed && !selected ? 0.6 : 1 },
            ]}>
            {option.icon?.(selected)}
            <ThemedText
              style={[styles.label, { color: selected ? theme.onTint : theme.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {option.label}
            </ThemedText>
            {!!option.badge && (
              <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                <ThemedText style={styles.badgeText}>{option.badge}</ThemedText>
              </View>
            )}
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
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  label: {
    flexShrink: 1,
    fontWeight: 900,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: 900,
  },
});
