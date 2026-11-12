import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { openSafetyMenu } from '@/components/safety-menu';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL, displayName, ordinal, timeAgo } from '@/lib/format';

type Props = {
  item: FeedItem;
  /** Hide the author row (e.g. on that user's own profile) */
  hideAuthor?: boolean;
  onBlocked?: () => void;
};

export function FeedCard({ item, hideAuthor, onBlocked }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {!hideAuthor && (
        <View style={styles.header}>
          <Link href={{ pathname: '/user/[userId]', params: { userId: item.user.id } }} asChild>
            <Pressable style={styles.author}>
              <Avatar user={item.user} size={32} />
              <View>
                <ThemedText type="smallBold">{displayName(item.user)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {timeAgo(item.createdAt)}
                </ThemedText>
              </View>
            </Pressable>
          </Link>
          <Pressable
            hitSlop={12}
            accessibilityLabel="More options"
            onPress={() => openSafetyMenu({ user: item.user, submissionId: item.submissionId, onBlocked })}>
            <ThemedText type="subtitle" themeColor="textSecondary" style={styles.more}>
              ···
            </ThemedText>
          </Pressable>
        </View>
      )}
      <Image source={item.imageUrl} style={styles.photo} contentFit="cover" transition={200} />
      <View style={styles.footer}>
        <ThemedText type="smallBold" style={{ color: theme[item.difficulty] }}>
          {DIFFICULTY_LABEL[item.difficulty]} · {item.word.toUpperCase()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          +{item.points} pts{item.rank ? ` · ${ordinal(item.rank)}` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  more: {
    fontSize: 22,
    lineHeight: 24,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
});
