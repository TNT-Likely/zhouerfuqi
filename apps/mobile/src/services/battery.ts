import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

/**
 * 电池优化豁免:主动检测 + 主动申请(闹钟类应用的标配)。
 * - 检测:PowerManager.isIgnoringBatteryOptimizations
 * - 申请:ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 系统确认框
 *   (需清单 REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 权限,已声明)
 */
const n = Platform.OS === 'android' ? requireNativeModule('ZfAlarm') : null;

export function isIgnoringBatteryOptimizations(): boolean {
  if (!n) return true; // iOS 无此概念
  return n.isIgnoringBatteryOptimizations() === true;
}

export function requestIgnoreBatteryOptimization(): void {
  if (!n) return;
  n.requestIgnoreBatteryOptimization();
}
