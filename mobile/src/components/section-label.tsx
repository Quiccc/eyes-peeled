import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** Small uppercase heading above a group of cards ("ACCOUNT", "REQUESTS · 1"). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label} accessibilityRole="header">
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 1,
  },
});
