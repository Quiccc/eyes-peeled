import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { invalidateSocial, useUserProfile } from '@/api/queries';
import type { FeedItem, UserProfile } from '@/api/types';
import { ActionSheet, type ActionSheetItem } from '@/components/action-sheet';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FindTile } from '@/components/find-tile';
import { Icon, type IconName } from '@/components/icon';
import { LockedPhotosArt, SleepyBinocularsArt, SnappedBadgeArt } from '@/components/illustrations/hunter-art';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileStats } from '@/components/profile-stats';
import { QueryState } from '@/components/query-state';
import { SectionLabel } from '@/components/section-label';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { startBlock, startReport, startUnblock } from '@/features/safety/safety-menu';
import { useFriendAction, useRespondFriendRequest } from '@/features/social/use-friend-mutations';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { displayName, plural } from '@/lib/format';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserProfile(userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const p = profile.data;

  const refresh = () => invalidateSocial(queryClient);

  const menuItems = (p: UserProfile): ActionSheetItem[] => {
    const name = displayName(p.user);
    const items: ActionSheetItem[] = [];
    if (p.friendStatus === 'friends') {
      items.push({ label: 'Remove friend', icon: 'person-remove', onPress: () => confirmRemove(p) });
    }
    items.push(
      p.friendStatus === 'blocked'
        ? { label: `Unblock ${name}`, icon: 'no-ads', onPress: () => startUnblock(p.user, refresh) }
        : {
            label: `Block ${name}`,
            icon: 'no-ads',
            destructive: true,
            onPress: () =>
              startBlock(p.user, () => {
                refresh();
                router.back();
              }),
          },
      { label: 'Report', icon: 'flag', destructive: true, onPress: () => startReport(p.user) },
    );
    return items;
  };

  const action = useFriendAction();
  const confirmRemove = (p: UserProfile) =>
    Alert.alert(`Remove ${displayName(p.user)}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => action.mutate(p) },
    ]);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* The app's own header bar: back and the options menu. The hunter's name sits in the hero below. */}
        <View style={styles.header}>
          <HeaderButton icon="chevron-left" label="Back" size={24} onPress={() => router.back()} />
          {p ? (
            <HeaderButton icon="more" label="More options" size={22} onPress={() => setMenuOpen(true)} />
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>

        <QueryState
          query={profile}
          loading={<ActivityIndicator style={styles.loader} />}
          errorTitle="Couldn't load this hunter"
          errorArt={<SnappedBadgeArt />}>
          {(p) => (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.hero}>
                <ProfileHeader user={p.user} ring="hue" centered />
                <RelationshipAction profile={p} />
              </View>

              <ProfileStats profile={p} strip />

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <SectionLabel>TODAY&apos;S FINDS</SectionLabel>
                  {p.friendStatus === 'friends' && p.today.length > 0 && (
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {plural(p.today.length, 'find')}
                    </ThemedText>
                  )}
                </View>
                {p.friendStatus !== 'friends' ? (
                  <EmptyState
                    boxed
                    art={<LockedPhotosArt />}
                    title="Photos are for friends"
                    hint={
                      p.friendStatus === 'blocked'
                        ? "You won't see each other's finds."
                        : 'Become friends to see their finds.'
                    }
                  />
                ) : p.today.length === 0 ? (
                  <EmptyState boxed art={<SleepyBinocularsArt />} title="Nothing found yet today" />
                ) : (
                  <FindsGrid items={p.today} />
                )}
              </View>
            </ScrollView>
          )}
        </QueryState>

        {p && (
          <ActionSheet
            visible={menuOpen}
            title={`Options for ${displayName(p.user)}`}
            items={menuItems(p)}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** What you can do about this hunter right now, under their name. Rarer actions live in the ⋯ menu. */
function RelationshipAction({ profile: p }: { profile: UserProfile }) {
  const theme = useTheme();
  const action = useFriendAction();
  const respond = useRespondFriendRequest();

  switch (p.friendStatus) {
    case 'friends':
      return (
        <View style={[styles.chip, { backgroundColor: theme.easyBg }]}>
          <Icon name="check" size={16} color={theme.easyText} />
          <ThemedText type="smallBold" style={{ color: theme.easyText }}>
            Friends
          </ThemedText>
        </View>
      );
    case 'blocked':
      return (
        <View style={[styles.chip, { backgroundColor: theme.hardBg }]}>
          <ThemedText type="smallBold" style={{ color: theme.hardText }}>
            Blocked
          </ThemedText>
        </View>
      );
    case 'none':
      return (
        <Button
          title="Add friend"
          icon="person-add"
          loading={action.isPending}
          onPress={() => action.mutate(p)}
          style={styles.wide}
        />
      );
    case 'outgoing':
      return (
        <Button
          title="Requested · Cancel"
          icon="clock"
          variant="secondary"
          loading={action.isPending}
          onPress={() => action.mutate(p)}
          style={styles.wide}
        />
      );
    case 'incoming':
      return (
        <View style={styles.pair}>
          <Button
            title="Decline"
            variant="secondary"
            loading={respond.isPending}
            disabled={action.isPending || !p.requestId}
            onPress={() => p.requestId && respond.mutate({ id: p.requestId, action: 'decline' })}
            style={styles.flex}
          />
          <Button
            title="Accept"
            icon="check"
            loading={action.isPending}
            disabled={respond.isPending}
            onPress={() => action.mutate(p)}
            style={styles.flex}
          />
        </View>
      );
  }
}

/** Today's finds two to a row. */
function FindsGrid({ items }: { items: FeedItem[] }) {
  const rows: FeedItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].submissionId} style={styles.gridRow}>
          {row.map((item) => (
            <FindTile key={item.submissionId} item={item} />
          ))}
          {row.length === 1 && <View style={styles.flex} />}
        </View>
      ))}
    </View>
  );
}

function HeaderButton({ icon, label, size, onPress }: { icon: IconName; label: string; size: number; onPress: () => void }) {
  const guard = usePressGuard();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={guard(onPress)}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: Spacing.six },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  chip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  wide: {
    alignSelf: 'stretch',
  },
  pair: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  section: {
    gap: Spacing.two + 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grid: {
    gap: Spacing.two + 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
});
