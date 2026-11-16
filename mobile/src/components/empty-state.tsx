import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: IconName;
  title: string;
  hint?: string;
  /** Optional call to action, e.g. a <Button />. */
  action?: ReactNode;
  /** A dashed box around it, for a closed-off section inside a screen (another hunter's photos). */
  boxed?: boolean;
};

/** What a list shows when it has nothing yet: says what will appear here and how to get started. */
export function EmptyState({ icon, title, hint, action, boxed }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.root, boxed && [styles.boxed, { borderColor: theme.border }]]}>
      <View style={[styles.tile, boxed && styles.tileBoxed, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={boxed ? 26 : 30} color={boxed ? theme.textSecondary : theme.text} />
      </View>
      <ThemedText type="subtitle" style={styles.center}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {hint}
        </ThemedText>
      ) : null}
      {action}
    </View>
  );
}

/** Placeholder rows shown while a list loads for the first time. */
export function SkeletonRows({ count = 5, height = 56 }: { count?: number; height?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.skeletons} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.skeleton,
            { height, backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: 1 - i * 0.15 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  boxed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
  },
  tileBoxed: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginBottom: 0,
  },
  center: {
    textAlign: 'center',
  },
  skeletons: {
    gap: Spacing.two,
  },
  skeleton: {
    borderRadius: Radius.md + 2,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
});
