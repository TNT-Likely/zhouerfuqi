import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

/**
 * 注册/刷新每日 03:30 自刷新闹钟(自续期,补偿 MIUI 7 天钳制)。
 * 仅 Android;iOS 无此钳制且无 Headless 通道,固定 no-op。
 * 注意:必须懒 require——顶层 requireNativeModule 在无此模块的平台会抛异常。
 */
export function scheduleRefresher(hour: number, minute: number): boolean {
  if (Platform.OS !== 'android') return false;
  const ZfAlarm = requireNativeModule('ZfAlarm');
  return ZfAlarm.scheduleRefresher(hour, minute) as boolean;
}

export function setRefresherEnabled(enabled: boolean): void {
  if (Platform.OS === 'android') requireNativeModule('ZfAlarm').setRefresherEnabled(enabled);
}

export default { scheduleRefresher };
