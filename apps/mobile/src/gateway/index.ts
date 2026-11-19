import { Platform } from 'react-native';
import { nativeGateway } from './nativeGateway';
import { alarmKitGateway } from './alarmKit';
import type { AlarmGateway } from './types';

/**
 * 平台装配:
 * - Android:v2.2 原生调度(setAlarmClock → AlarmActivity 全屏响铃,不依赖通知渠道)
 * - iOS:AlarmKit(iOS 26+ 主路径,授权被拒/旧系统原生侧自动通知降级)
 * 接口两边同构(AlarmGateway),引擎与物化层完全复用。
 */
export const gateway: AlarmGateway =
  Platform.OS === 'android' ? nativeGateway : alarmKitGateway;
