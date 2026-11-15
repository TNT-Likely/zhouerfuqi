import { Platform } from 'react-native';
import { notifyKitGateway } from './notifyKit';
import { alarmKitGateway } from './alarmKit';
import type { AlarmGateway } from './types';

/**
 * 平台装配:
 * - Android:notify-kit(Notifee fork),alarmManager.type = SET_ALARM_CLOCK
 * - iOS:AlarmKit(iOS 26+ 主路径,授权被拒/旧系统原生侧自动通知降级)
 * 接口两边同构(AlarmGateway),引擎与物化层完全复用。
 */
export const gateway: AlarmGateway =
  Platform.OS === 'android' ? notifyKitGateway : alarmKitGateway;
