import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Difficulty, User } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HUES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** Stable per user, so the same person always gets the same color. */
function hueFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

type Props = {
  user: User;
  size?: number;
  /** Orange ring on a soft-orange face: the signed-in user's own profile header. */
  ring?: boolean;
};

export function Avatar({ user, size = 40, ring }: Props) {
  const theme = useTheme();
  const initial = (user.username ?? user.displayName ?? '?').charAt(0).toUpperCase();
  const dims = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 4, borderColor: theme.tint } : null;

  if (user.avatarUrl) {
    return <Image source={user.avatarUrl} style={[dims, ringStyle]} contentFit="cover" />;
  }
  const c = difficultyColors(theme, hueFor(user.id));
  return (
    <View
      style={[styles.fallback, dims, ringStyle, { backgroundColor: ring ? theme.backgroundSelected : c.bg }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <ThemedText
        style={{
          fontSize: size * 0.44,
          lineHeight: size * 0.6,
          fontWeight: 900,
          color: ring ? theme.text : c.text,
        }}>
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
