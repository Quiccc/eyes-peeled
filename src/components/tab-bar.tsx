import { useQuery } from '@tanstack/react-query';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { queryKeys } from '@/lib/query-client';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'camera' },
  leaderboard: { label: 'Ranks', icon: 'trophy' },
  friends: { label: 'Friends', icon: 'users' },
  profile: { label: 'Profile', icon: 'user' },
};

/** The app's tab bar: a chunky card with the selected tab on a soft-orange pill. */
export function TabBar({ state, navigateToTab }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: requests } = useQuery({ queryKey: queryKeys.friendRequests, queryFn: api.getFriendRequests });
  const pending = requests?.length ?? 0;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? theme.text : theme.textSecondary;
          const badge = route.name === 'friends' && pending > 0 ? pending : 0;

          const onPress = () => {
            if (focused) return;
            tap();
            navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${tab.label}, ${badge} friend requests` : tab.label}
              onPress={onPress}
              style={[styles.item, focused && { backgroundColor: theme.backgroundSelected }]}>
              <View>
                <Icon name={tab.icon} size={22} color={color} />
                {badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText type="smallBold" style={{ color }}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  item: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
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
