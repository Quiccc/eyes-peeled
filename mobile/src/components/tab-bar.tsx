import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDaily, useFriendRequests } from '@/api/queries';
import { Chunky } from '@/components/chunky';
import { HuntCameraIcon, SleepyEyeIcon, TabIcon, type TabIconName } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useTheme } from '@/hooks/use-theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: TabIconName }> = {
  index: { label: 'Today', icon: 'today' },
  leaderboard: { label: 'Ranks', icon: 'ranks' },
  friends: { label: 'Friends', icon: 'friends' },
  profile: { label: 'Profile', icon: 'profile' },
};

/** Tabs either side of the Hunt shutter. */
const LEFT = ['index', 'leaderboard'];
const RIGHT = ['friends', 'profile'];

const SHUTTER = 60;
const SHUTTER_EDGE = 5;
/** How far the shutter rises above the top of the bar. */
const RISE = 27;
const KEY_EDGE = 4;

/**
 * The app's tab bar: Today · Ranks · [Hunt] · Friends · Profile. The active tab is a raised orange key;
 * the raised shutter in the middle opens the camera for the next word still to find. Once every word
 * is found the shutter goes flat and green, its eye asleep until tomorrow's words, and can't be pressed.
 */
export function TabBar({ state, navigateToTab }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: requests } = useFriendRequests();
  const { data: daily } = useDaily();
  const { openingId, startHunt } = useStartHunt();
  const pending = requests?.length ?? 0;

  const words = daily?.words ?? [];
  const allFound = words.length > 0 && words.every((w) => w.status === 'found');
  const next = words.find((w) => w.status !== 'found');

  const onHunt = () => {
    if (next) {
      void startHunt(next);
      return;
    }
    // Today's words haven't loaded yet: show them instead.
    const today = state.routes.find((r) => r.name === 'index');
    if (today) navigateToTab(today.key);
  };

  const renderTab = (name: string) => {
    const index = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[index];
    const tab = TABS[name];
    if (!route || !tab) return null;
    const focused = state.index === index;
    const badge = name === 'friends' && pending > 0 ? pending : 0;

    return (
      <Chunky
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${tab.label}, ${badge} friend requests` : tab.label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        color={focused ? theme.tint : 'transparent'}
        edgeColor={focused ? theme.tintEdge : 'transparent'}
        edge={KEY_EDGE}
        radius={16}
        style={styles.cell}
        contentStyle={styles.key}>
        <View>
          <TabIcon name={tab.icon} active={focused} />
          {badge > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: focused ? theme.tint : theme.backgroundElement }]}>
              <ThemedText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="smallBold" style={{ color: focused ? theme.onTint : theme.textSecondary }}>
          {tab.label}
        </ThemedText>
      </Chunky>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {LEFT.map(renderTab)}
        <View style={styles.slot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ThemedText type="smallBold" style={{ color: allFound ? theme.successText : theme.tabSelected }}>
            {allFound ? 'Done' : 'Hunt'}
          </ThemedText>
        </View>
        {RIGHT.map(renderTab)}
      </View>

      <View style={styles.shutterRow} pointerEvents="box-none">
        {allFound ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="All words found. New words tomorrow"
            style={[styles.done, { backgroundColor: theme.easyBg, borderColor: theme.backgroundElement }]}>
            <SleepyEyeIcon />
          </View>
        ) : (
          <Chunky
            accessibilityLabel={next ? `Hunt ${next.word.toLowerCase()}` : "Hunt today's words"}
            onPress={onHunt}
            disabled={!!openingId}
            color={theme.tint}
            edgeColor={theme.tintEdge}
            edge={SHUTTER_EDGE}
            radius={SHUTTER / 2}
            style={styles.shutter}
            contentStyle={[styles.shutterFace, { borderColor: theme.backgroundElement }]}>
            <HuntCameraIcon />
          </Chunky>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    // Room for the shutter to rise above the bar while staying inside the bar's touch area.
    paddingTop: RISE,
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 5,
    borderRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  cell: {
    flex: 1,
    height: 48 + KEY_EDGE,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  slot: {
    width: 72,
    height: 48 + KEY_EDGE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 1,
  },
  shutterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER + SHUTTER_EDGE,
  },
  shutterFace: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    width: SHUTTER,
    height: SHUTTER,
    marginTop: SHUTTER_EDGE,
    borderRadius: SHUTTER / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 900,
  },
});
