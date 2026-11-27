import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** A small outline icon on a soft tile. Ignored when `art` is given. */
  icon?: IconName;
  /** A full illustration (from components/illustrations) in place of the icon tile. */
  art?: ReactNode;
  title: string;
  hint?: string;
  /** Optional call to action, e.g. a <Button />. */
  action?: ReactNode;
  /** A dashed box around it, for a closed-off section inside a screen (another hunter's photos). */
  boxed?: boolean;
};

/** What a list shows when it has nothing yet: says what will appear here and how to get started. */
export function EmptyState({ icon, art, title, hint, action, boxed }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.root, boxed && [styles.boxed, { borderColor: theme.border }]]}>
      {art ? (
        <View style={styles.art}>{art}</View>
      ) : icon ? (
        <View style={[styles.tile, boxed && styles.tileBoxed, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={icon} size={boxed ? 26 : 30} color={boxed ? theme.textSecondary : theme.text} />
        </View>
      ) : null}
      <ThemedText type="subtitle" style={styles.center}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {hint}
        </ThemedText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** Placeholder rows shown while a list loads for the first time. */
export function SkeletonRows({ count = 5, height = 56 }: { count?: number; height?: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.skeletons} accessibilityLabel={t('common.loading')}>
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
  art: {
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
  // Sized by its content so a button here never soaks up spare height (e.g. inside a list's empty slot).
  action: {
    alignSelf: 'center',
    marginTop: Spacing.two,
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
