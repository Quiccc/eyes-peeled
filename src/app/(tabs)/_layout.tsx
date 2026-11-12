import { NativeTabs } from 'expo-router/native-tabs';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys } from '@/lib/query-client';

export default function TabLayout() {
  const theme = useTheme();
  const { data: requests } = useQuery({ queryKey: queryKeys.friendRequests, queryFn: api.getFriendRequests });
  const pending = requests?.length ?? 0;

  return (
    <NativeTabs tintColor={theme.tint} labelStyle={{ selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera.viewfinder" md="photo_camera" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Label>Leaderboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy.fill" md="emoji_events" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="friends">
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
        {pending > 0 && <NativeTabs.Trigger.Badge>{String(pending)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
