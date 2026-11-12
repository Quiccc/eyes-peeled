import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  const theme = useTheme();
  const initial = (user.username ?? user.displayName ?? '?').charAt(0).toUpperCase();
  const dims = { width: size, height: size, borderRadius: size / 2 };

  if (user.avatarUrl) {
    return <Image source={user.avatarUrl} style={dims} contentFit="cover" />;
  }
  return (
    <View style={[styles.fallback, dims, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={{ fontSize: size * 0.42, lineHeight: size * 0.6, fontWeight: 700 }}>{initial}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
