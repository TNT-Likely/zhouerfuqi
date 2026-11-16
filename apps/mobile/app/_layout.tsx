import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Alert, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import notifee from 'react-native-notify-kit';
import { ThemeProvider } from '@/theme';
import { gateway } from '@/gateway';
import { syncAll } from '@/scheduler/sync';
import { initHolidays } from '@/services/holidays';
import { scheduleRefresher as zfScheduleRefresher } from '../modules/zf-alarm/src';
import { consumeLastNotificationTap, onNotificationTap } from '../modules/zf-alarm-ios/src';
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

      // 节假日缓存加载 + 静默尝试补次年数据(离线/未发布时静默)
      void initHolidays();

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

    // [iOS] 降级通知(UNUserNotificationCenter)点击 → 响铃页。
    // 原生侧把点击落到 UserDefaults 并发事件;两条路径都「consume 才路由」,不会重复跳页。
    let unsubIosTap: (() => void) | undefined;
    if (Platform.OS === 'ios') {
      const pending = consumeLastNotificationTap();
      if (pending) router.push({ pathname: '/ring', params: { timeLabel: pending.timeLabel } });
      unsubIosTap = onNotificationTap(() => {
        const tap = consumeLastNotificationTap();
        if (tap) router.push({ pathname: '/ring', params: { timeLabel: tap.timeLabel } });
      });
    }

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
      unsubIosTap?.();
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
