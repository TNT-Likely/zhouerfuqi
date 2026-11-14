import { Tabs } from 'expo-router';
import { Text } from 'react-native';
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
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: () => <Text style={{ fontSize: 17 }}>⏰</Text> }} />
      <Tabs.Screen name="calendar" options={{ title: '日历', tabBarIcon: () => <Text style={{ fontSize: 17 }}>🗓</Text> }} />
      <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: () => <Text style={{ fontSize: 17 }}>⚙️</Text> }} />
    </Tabs>
  );
}
