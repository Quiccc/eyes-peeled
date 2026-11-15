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
};

/** What a list shows when it has nothing yet: says what will appear here and how to get started. */
export function EmptyState({ icon, title, hint, action }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.tile, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={30} color={theme.text} />
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
