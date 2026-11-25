import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';

export type SettingsRow = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  /** A 24px glyph (e.g. components/profile-icons.tsx) on a 36px tile at the start of the row. */
  icon?: ReactNode;
  /** The icon tile's colour. */
  tileColor?: string;
};

/** A card of tappable settings rows separated by hairlines, each ending in a chevron (or a spinner while busy). */
export function SettingsGroup({ rows }: { rows: readonly SettingsRow[] }) {
  const theme = useTheme();
  const guard = usePressGuard();
  return (
    <View style={[styles.group, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {rows.map((row, i) => (
        <Pressable
          key={row.title}
          accessibilityRole="button"
          disabled={row.loading}
          onPress={guard(row.onPress)}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: 2, borderTopColor: theme.border },
            pressed && { backgroundColor: theme.backgroundSelected },
          ]}>
          {row.icon ? (
            <View style={[styles.tile, { backgroundColor: row.tileColor ?? theme.backgroundSelected }]}>{row.icon}</View>
          ) : null}
          <ThemedText style={styles.label}>{row.title}</ThemedText>
          {/* The spinner and the chevron share one 20px slot, so the label never moves. */}
          <View style={styles.trailing}>
            {row.loading ? (
              <ActivityIndicator color={theme.textSecondary} />
            ) : (
              <Icon name="chevron-right" size={18} color={theme.textSecondary} />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** A red text button for irreversible actions, e.g. "Delete account". */
export function DangerLink({ title, loading, onPress }: SettingsRow) {
  const theme = useTheme();
  const guard = usePressGuard();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={guard(onPress)}
      style={({ pressed }) => [styles.danger, { opacity: pressed ? 0.6 : 1 }]}>
      {loading ? (
        <ActivityIndicator color={theme.dangerText} />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.dangerText }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingLeft: 12,
    paddingRight: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontWeight: 900,
  },
  trailing: {
    width: 20,
    alignItems: 'center',
  },
  danger: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
