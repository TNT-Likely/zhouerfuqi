import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import notifee from 'react-native-notify-kit';
import { ThemeProvider } from '@/theme';
import { gateway } from '@/gateway';
import { syncAll } from '@/scheduler/sync';
import { scheduleRefresher as zfScheduleRefresher } from '../modules/zf-alarm/src';
import { useGroups } from '@/stores/groups';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await gateway.init();
        await gateway.requestPermissions();
        await syncAll();
        // 每日 03:30 自刷新(补偿 MIUI 对 7 天外精确闹钟的钳制)
        zfScheduleRefresher(3, 30);
      } catch (e: any) {
        Alert.alert('启动初始化失败', e?.message ?? String(e));
      }

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

    // App 回前台时重排(架构 §4.1 触发点之一);
    // iOS 无 BOOT 广播/Headless 通道,前台重排 + 每次启动是仅有的补偿路径
    const sub = useGroups.subscribe(() => {
      void syncAll();
    });
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncAll();
    });
    return () => {
      unsub();
      sub();
      appStateSub.remove();
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
