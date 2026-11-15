import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.text3,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: ({ color }) => <Ionicons name="alarm-outline" size={21} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title: '日历', tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={21} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={21} color={color} /> }} />
    </Tabs>
  );
}
