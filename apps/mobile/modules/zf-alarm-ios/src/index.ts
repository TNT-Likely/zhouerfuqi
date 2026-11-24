import { Platform } from 'react-native';

/**
 * [M2] iOS 闹钟网关原生封装(zf-alarm-ios,Swift)。
 * 主路径 AlarmKit(iOS 26+),降级 UNUserNotificationCenter 时间敏感通知;
 * 后端选择在原生侧完成,这里只透传。
 */

export type ZfAlarmBackend = 'alarmkit' | 'notification' | 'skipped';
export type ZfAlarmPermissionStatus = { notifications: boolean; exactAlarms: boolean };

export interface ZfNotificationTap {
  id: string;
  timeLabel: string;
  title: string;
}

interface ZfAlarmIosNative {
  isAlarmKitAvailable(): boolean;
  requestPermissions(): Promise<ZfAlarmPermissionStatus>;
  status(): Promise<ZfAlarmPermissionStatus>;
  pruneOrphanedAlarms?(): Promise<void>;
  scheduleAlarm(id: string, epochMs: number, title: string, body: string): Promise<ZfAlarmBackend>;
  cancelAlarm(id: string): Promise<boolean>;
  consumeLastNotificationTap(): ZfNotificationTap | null;
  addListener(eventName: 'zfNotificationTap', listener: (tap: ZfNotificationTap) => void): { remove: () => void };
}

let cached: ZfAlarmIosNative | null | undefined;

/** iOS 上拿原生模块;其他平台返回 null(调用方兜底) */
function native(): ZfAlarmIosNative | null {
  if (Platform.OS !== 'ios') return null;
  if (cached === undefined) {
    try {
      cached = require('expo-modules-core').requireNativeModule('ZfAlarmIos') as ZfAlarmIosNative;
    } catch {
      // prebuild 前的 JS 预览环境(Storybook/design 等)无原生层
      cached = null;
    }
  }
  return cached;
}

export function isAlarmKitAvailable(): boolean {
  const n = native();
  return n ? n.isAlarmKitAvailable() : false;
}

export function requestPermissions(): Promise<ZfAlarmPermissionStatus> {
  const n = native();
  if (!n) return Promise.resolve({ notifications: false, exactAlarms: false });
  return n.requestPermissions();
}

export function status(): Promise<ZfAlarmPermissionStatus> {
  const n = native();
  if (!n) return Promise.resolve({ notifications: false, exactAlarms: false });
  return n.status();
}

export async function pruneOrphanedAlarms(): Promise<void> {
  await native()?.pruneOrphanedAlarms?.();
}

export function scheduleAlarm(id: string, epochMs: number, title: string, body: string): Promise<ZfAlarmBackend> {
  const n = native();
  if (!n) return Promise.resolve('skipped');
  return n.scheduleAlarm(id, epochMs, title, body);
}

export function cancelAlarm(id: string): Promise<boolean> {
  const n = native();
  if (!n) return Promise.resolve(false);
  return n.cancelAlarm(id);
}

/**
 * 降级通知点击路由([M2 补])。
 * 冷启动:delegate 落 UserDefaults,JS 挂载后 consume;热路径:addListener 即时收。
 */
export function consumeLastNotificationTap(): ZfNotificationTap | null {
  const n = native();
  return n ? n.consumeLastNotificationTap() : null;
}

export function onNotificationTap(listener: (tap: ZfNotificationTap) => void): () => void {
  const n = native();
  if (!n) return () => {};
  const sub = n.addListener('zfNotificationTap', listener);
  return () => sub.remove();
}
