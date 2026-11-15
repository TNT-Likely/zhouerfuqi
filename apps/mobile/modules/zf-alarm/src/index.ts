import { requireNativeModule } from 'expo-modules-core';

const ZfAlarm = requireNativeModule('ZfAlarm');

/** 注册/刷新每日 03:30 自刷新闹钟(自续期,补偿 MIUI 7 天钳制) */
export function scheduleRefresher(hour: number, minute: number): boolean {
  return ZfAlarm.scheduleRefresher(hour, minute) as boolean;
}

export default { scheduleRefresher };
