import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tab-bar';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
