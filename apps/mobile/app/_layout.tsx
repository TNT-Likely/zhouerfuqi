import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import notifee from 'react-native-notify-kit';
import { ThemeProvider } from '@/theme';
import { gateway } from '@/gateway';
import { syncAll } from '@/scheduler/sync';
import { useGroups } from '@/stores/groups';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      await gateway.init();
      await gateway.requestPermissions();
      await syncAll();

      // 全屏意图/点通知 → 直接进响铃页(notify-kit 把 data 原样带回来)
      const initial = await notifee.getInitialNotification();
      if (initial?.notification.data?.timeLabel) {
        router.push('/ring');
      }
    })();

    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      // EventType.PRESS = 1
      if (type === 1 && detail.notification?.data?.timeLabel) {
        router.push('/ring');
      }
    });

    // App 回前台时重排(架构 §4.1 触发点之一)
    const sub = useGroups.subscribe(() => {
      void syncAll();
    });
    return () => {
      unsub();
      sub();
    };
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: undefined } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="guide" />
        <Stack.Screen name="ring" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </ThemeProvider>
  );
}
