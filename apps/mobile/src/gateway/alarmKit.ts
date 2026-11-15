import {
  scheduleAlarm,
  cancelAlarm,
  requestPermissions,
  status,
} from '../../modules/zf-alarm-ios/src';
import type { AlarmGateway, AlarmPermissionStatus, MaterializedAlarm } from './types';

/**
 * [M2] iOS 实现:zf-alarm-ios 原生模块。
 * iOS 26+ 走 AlarmKit(系统闹钟 UI,与系统时钟同源,无 MIUI 式 7 天钳制,
 * 故无需每日自刷新器);旧系统 / 授权被拒时原生侧自动落时间敏感通知降级。
 */
export const alarmKitGateway: AlarmGateway = {
  async init() {
    // 通知权限在 requestPermissions 里请求;iOS 无需 Android 式 channel 预建
  },

  async schedule(alarms: MaterializedAlarm[]) {
    for (const a of alarms) {
      await scheduleAlarm(a.id, a.epochMs, a.title, a.body);
    }
  },

  async cancel(ids: string[]) {
    for (const id of ids) {
      await cancelAlarm(id);
    }
  },

  async requestPermissions(): Promise<AlarmPermissionStatus> {
    return requestPermissions();
  },

  async status(): Promise<AlarmPermissionStatus> {
    return status();
  },
};
