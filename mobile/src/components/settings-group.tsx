import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';

export type SettingsRow = {
  title: string;
  onPress: () => void;
  loading?: boolean;
};

/** A card of tappable settings rows separated by hairlines. */
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
          <ThemedText style={styles.label}>{row.title}</ThemedText>
          {row.loading && <ActivityIndicator color={theme.textSecondary} />}
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
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: 900,
  },
  danger: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
