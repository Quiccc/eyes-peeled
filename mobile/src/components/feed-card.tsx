import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ShareIcon } from '@/components/hunt-icons';
import { Icon } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { Block, Bone } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { openSafetyMenu } from '@/features/safety/safety-menu';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

type Props = {
  item: FeedItem;
  /** Hide the author row (e.g. on that user's own profile) */
  hideAuthor?: boolean;
  onBlocked?: () => void;
  /** Show a "Share" button. Only pass this for the signed-in user's own finds. */
  onShare?: () => void;
};

export function FeedCard({ item, hideAuthor, onBlocked, onShare }: Props) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        hideAuthor && styles.cardBare,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {!hideAuthor && (
        <View style={styles.header}>
          <Link href={{ pathname: '/user/[userId]', params: { userId: item.user.id } }} asChild>
            <Pressable style={styles.author} accessibilityRole="link">
              <Avatar user={item.user} size={36} />
              <ThemedText style={styles.name} numberOfLines={1}>
                {fmt.displayName(item.user)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                · {fmt.timeAgo(item.createdAt)}
              </ThemedText>
            </Pressable>
          </Link>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('user.moreOptions')}
            onPress={() => openSafetyMenu({ user: item.user, submissionId: item.submissionId, onBlocked })}
            style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="more" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}
      <Image
        source={item.imageUrl}
        style={[styles.photo, hideAuthor && styles.photoBare, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={200}
      />
      {hideAuthor ? (
        <View style={[styles.footer, styles.footerBare]}>
          <DifficultyPill difficulty={item.difficulty} style={styles.pill} />
          <ThemedText style={[styles.word, styles.wordBare]} numberOfLines={1}>
            {fmt.displayWord(item.word)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold">{t('format.plusPoints', { count: item.points })}</ThemedText>
            {item.rank ? ` · ${fmt.ordinal(item.rank)}` : ''}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.footer, styles.footerFeed]}>
          <DifficultyPill difficulty={item.difficulty} style={styles.pill} />
          <ThemedText style={[styles.word, styles.wordBare]} numberOfLines={1}>
            {fmt.displayWord(item.word)}
          </ThemedText>
          <View style={styles.score}>
            <ThemedText style={[styles.scorePoints, { color: theme.successText }]}>{t('format.plusPoints', { count: item.points })}</ThemedText>
            {item.rank ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                {t('format.nthFinder', { rank: fmt.ordinal(item.rank) })}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}
      {onShare && (
        <View style={styles.share}>
          <Button size="small" variant="secondary" iconNode={<ShareIcon size={16} />} title={t('share.share')} onPress={onShare} />
        </View>
      )}
    </View>
  );
}

/**
 * The bare card with a Share button (your own finds on your profile) while it loads. It is built from the
 * card's own parts with sample content hidden under pulsing bones, so it is exactly as tall as the real card.
 */
export function FeedCardSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('profile.loadingFinds')}
      style={[styles.card, styles.cardBare, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Block style={[styles.photo, styles.photoBare]} />
      <View style={[styles.footer, styles.footerBare]}>
        <Bone radius={Radius.pill}>
          <DifficultyPill difficulty="easy" />
        </Bone>
        <View style={styles.wordSlot}>
          <Bone style={styles.wordBone}>
            <ThemedText style={[styles.word, styles.wordBare]} numberOfLines={1}>
              WORD
            </ThemedText>
          </Bone>
        </View>
      </View>
      <View style={styles.share}>
        <Bone radius={14}>
          <Button size="small" variant="secondary" iconNode={<ShareIcon size={16} />} title={t('share.share')} />
        </Bone>
      </View>
    </View>
  );
}

// Two sizes, as in the design: with the author (Friends feed), and bare on a profile.
const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
    overflow: 'hidden',
  },
  cardBare: {
    borderBottomWidth: Edge.button,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.two + 4,
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.two + 2,
    paddingRight: 6,
  },
  author: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  name: {
    flexShrink: 1,
    fontWeight: 900,
  },
  time: {
    lineHeight: 16,
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  photoBare: {
    height: 180,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two + 4,
  },
  /** The pill hugs the top of its row by default; here it sits on the word's centre line. */
  pill: {
    alignSelf: 'center',
  },
  footerFeed: {
    gap: Spacing.two + 2,
    paddingHorizontal: 14,
  },
  score: {
    alignItems: 'flex-end',
  },
  scorePoints: {
    fontWeight: 900,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  footerBare: {
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  word: {
    flex: 1,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  wordBare: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1,
  },
  share: {
    paddingHorizontal: Spacing.two + 4,
    paddingBottom: Spacing.two + 4,
  },
  wordSlot: {
    flex: 1,
  },
  wordBone: {
    alignSelf: 'flex-start',
  },
});
