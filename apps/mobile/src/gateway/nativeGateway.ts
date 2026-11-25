import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import type { AlarmDelivery, AlarmGateway, AlarmPermissionStatus, MaterializedAlarm } from './types';

/**
 * [v2.2] Android 实现:zf-alarm 原生调度(替代 notify-kit)。
 * - setAlarmClock 到点发布闹钟通知，由全屏意图或点按通知打开 AlarmActivity。
 * - AlarmActivity 循环响铃，提供原生贪睡和关闭操作。
 */
const ZfAlarm = Platform.OS === 'android' ? requireNativeModule('ZfAlarm') : null;

function accentHex(): string {
  // 惰性取当前主题色(避免 gateway → theme → prefs 的循环依赖)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { THEME_COLORS } = require('@/theme') as typeof import('@/theme');
    const { usePrefs } = require('@/stores/prefs') as typeof import('@/stores/prefs');
    const idx = usePrefs.getState().themeIdx;
    const s = THEME_COLORS[idx] ?? THEME_COLORS[0]!;
    const scheme = require('react-native').Appearance.getColorScheme();
    return scheme === 'light' ? s.light : s.dark;
  } catch {
    return '#4096FF';
  }
}

async function status(): Promise<AlarmPermissionStatus> {
  return {
    notifications: ZfAlarm?.areNotificationsEnabled() === true,
    exactAlarms: ZfAlarm?.canScheduleExactAlarms() === true,
    fullScreen: ZfAlarm?.canUseFullScreenIntent() === true,
  };
}

export const nativeGateway: AlarmGateway = {
  async init() {
    ZfAlarm?.ensureAlarmNotificationChannel?.();
  },

  async schedule(alarms: MaterializedAlarm[]) {
    const permissions = await status();
    if (!permissions.exactAlarms) return {};
    const ids: string[] = ZfAlarm.scheduleAlarms(alarms, accentHex());
    const delivery: AlarmDelivery = !permissions.notifications ? 'skipped' : permissions.fullScreen ? 'system' : 'notification';
    return Object.fromEntries(ids.map((id) => [id, delivery]));
  },

  async cancel(ids: string[]) {
    if (!ZfAlarm) return;
    ZfAlarm.cancelAlarms(ids);
  },

  requestPermissions: status,
  status,
};
