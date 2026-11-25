import { useEffect, useState } from 'react';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import notifee from 'react-native-notify-kit';
import { ThemeProvider, useTheme } from '@/theme';
import { FeedbackProvider } from '@/components/Feedback';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { gateway } from '@/gateway';
import { syncAll } from '@/scheduler/sync';
import { initHolidays } from '@/services/holidays';
import { consumeLastNotificationTap, onNotificationTap } from '../modules/zf-alarm-ios/src';
import { useGroups } from '@/stores/groups';

type RingRoute = { timeLabel: string; title?: string; alarmId?: string };

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AppNavigation />
      </FeedbackProvider>
    </ThemeProvider>
  );
}

function AppNavigation() {
  const t = useTheme();
  const router = useRouter();
  const navigationKey = useRootNavigationState()?.key;
  const [ringRoute, setRingRoute] = useState<RingRoute | null>(null);
  const [startupError, setStartupError] = useState<string>();
  useEffect(() => {
    if (!navigationKey || !ringRoute) return;
    setRingRoute(null);
    router.push({ pathname: '/ring', params: ringRoute });
  }, [navigationKey, ringRoute, router]);

  useEffect(() => {
    (async () => {
      try {
        await gateway.init();
        await syncAll();
      } catch (error) {
        setStartupError(error instanceof Error ? error.message : String(error));
      }

      // 节假日缓存加载 + 静默尝试补次年数据(离线/未发布时静默)
      void initHolidays().then(() => syncAll()).catch((error) => console.warn('节假日同步失败', error));

      // 全屏意图/点通知 → 直接进响铃页(notify-kit 把 data 原样带回来)
      const initial = await notifee.getInitialNotification();
      if (typeof initial?.notification.data?.timeLabel === 'string') {
        setRingRoute({ timeLabel: initial.notification.data.timeLabel, title: initial.notification.title, alarmId: initial.notification.id });
      }
    })();

    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      // EventType.PRESS = 1
      if (type === 1 && typeof detail.notification?.data?.timeLabel === 'string') {
        setRingRoute({ timeLabel: detail.notification.data.timeLabel, title: detail.notification.title, alarmId: detail.notification.id });
      }
    });

    // [iOS] 降级通知(UNUserNotificationCenter)点击 → 响铃页。
    // 原生侧把点击落到 UserDefaults 并发事件;两条路径都「consume 才路由」,不会重复跳页。
    let unsubIosTap: (() => void) | undefined;
    if (Platform.OS === 'ios') {
      const pending = consumeLastNotificationTap();
      if (pending) setRingRoute({ timeLabel: pending.timeLabel, title: pending.title, alarmId: pending.id });
      unsubIosTap = onNotificationTap(() => {
        const tap = consumeLastNotificationTap();
        if (tap) setRingRoute({ timeLabel: tap.timeLabel, title: tap.title, alarmId: tap.id });
      });
    }

    // App 回前台时重排(架构 §4.1 触发点之一);
    // iOS 无 BOOT 广播/Headless 通道,前台重排 + 每次启动是仅有的补偿路径
    const resync = () => { void syncAll().catch((error) => console.warn('闹钟重排失败', error)); };
    const sub = useGroups.subscribe(resync);
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') resync();
    });
    return () => {
      unsub();
      sub();
      appStateSub.remove();
      unsubIosTap?.();
    };
  }, []);

  return (
    <>
      <StatusBar style={t.scheme === 'light' ? 'dark' : 'light'} />
      {/* v2.1 单主屏架构:首页唯一常驻;月历/设置/关于为底部滑出的模态抽屉 */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="guide" />
        <Stack.Screen name="ring" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      {startupError ? (
        <AppDialog title="启动初始化失败" layout="center" tone="error" icon="alert-circle-outline"
          onClose={() => setStartupError(undefined)}>
          <DialogCopy centered>{startupError}</DialogCopy>
        </AppDialog>
      ) : null}
    </>
  );
}
