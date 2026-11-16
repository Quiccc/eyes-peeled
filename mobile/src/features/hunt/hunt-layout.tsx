import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DailyWord } from '@/api/types';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayWord } from '@/lib/format';

/** Full-screen column used by every non-camera hunt state: target on top, photo frame, status, actions. */
export function HuntScreenShell({ children, after }: { children: ReactNode; after?: ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.root}>{children}</SafeAreaView>
      {after}
    </ThemedView>
  );
}

/** Centered content (loading, word no longer active). */
export function HuntCentered({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.centered}>{children}</SafeAreaView>
    </ThemedView>
  );
}

/** The word being hunted, with its difficulty. */
export function HuntTarget({ word }: { word: DailyWord }) {
  return (
    <View style={styles.target}>
      <DifficultyPill difficulty={word.difficulty} style={styles.centerSelf} />
      <ThemedText type="title" style={styles.targetWord} accessibilityRole="header">
        {displayWord(word.word)}
      </ThemedText>
    </View>
  );
}

/** The big rounded frame that holds the photo (or a placeholder icon). `badge` sits on its corner. */
export function PhotoFrame({
  borderColor,
  style,
  badge,
  children,
}: {
  borderColor: string;
  style?: StyleProp<ViewStyle>;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.frame, { borderColor, backgroundColor: theme.backgroundSelected }, style]}>
      <View style={styles.frameInner}>{children}</View>
      {badge}
    </View>
  );
}

/** Headline plus explanation under the frame. */
export function HuntStatus({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.status, style]}>{children}</View>;
}

export function HuntActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export const huntStyles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerSelf: {
    alignSelf: 'center',
  },
  target: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  targetWord: {
    lineHeight: 36,
    letterSpacing: 1,
    textAlign: 'center',
  },
  // 320 tall like the design; gives way on short screens so the actions stay visible.
  frame: {
    height: 320,
    flexShrink: 1,
    minHeight: 220,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
  },
  frameInner: {
    flex: 1,
    borderRadius: Radius.lg - 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actions: {
    gap: 14,
  },
});
