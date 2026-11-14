import notifee, {
  AndroidCategory,
  AndroidImportance,
  AlarmType,
  AuthorizationStatus,
  TriggerType,
} from 'react-native-notify-kit';
import type { TimestampTrigger } from 'react-native-notify-kit';
import type { AlarmGateway, AlarmPermissionStatus, MaterializedAlarm } from './types';

/**
 * [M1] Android 实现:notify-kit(Notifee 新架构 fork)。
 * alarmType = SET_ALARM_CLOCK 与系统时钟同源,享受 Doze/OEM 白名单豁免。
 */
const CHANNEL = 'alarms';
let channelReady = false;

async function ensureChannel() {
  if (channelReady) return;
  await notifee.createChannel({
    id: CHANNEL,
    name: '闹钟',
    description: '班制闹钟响铃通道',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
  });
  channelReady = true;
}

export const notifyKitGateway: AlarmGateway = {
  async init() {
    await ensureChannel();
  },

  async schedule(alarms: MaterializedAlarm[]) {
    await ensureChannel();
    for (const a of alarms) {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: a.epochMs,
        // fork 采用 Notifee 经典形状:alarmManager.type = SET_ALARM_CLOCK
        alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
      };
      await notifee.createTriggerNotification(
        {
          id: a.id,
          title: a.title,
          body: a.body,
          data: {
            groupId: a.groupId,
            timeId: a.timeId,
            timeLabel: a.timeLabel,
            epochMs: String(a.epochMs),
          },
          android: {
            channelId: CHANNEL,
            category: AndroidCategory.ALARM,
            fullScreenAction: { id: 'default' },
            pressAction: { id: 'default' },
          },
        },
        trigger,
      );
    }
  },

  async cancel(ids: string[]) {
    for (const id of ids) {
      await notifee.cancelTriggerNotification(id);
    }
  },

  async requestPermissions(): Promise<AlarmPermissionStatus> {
    const settings = await notifee.requestPermission();
    return {
      notifications: settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
      // USE_EXACT_ALARM 在清单声明即自动授予(Android 13+);
      // Android 12 的 SCHEDULE_EXACT_ALARM 默认授予。运行时若被用户关闭,
      // schedule 会抛错,UI 层捕获后在设置页提示。
      exactAlarms: true,
    };
  },

  async status(): Promise<AlarmPermissionStatus> {
    const settings = await notifee.getNotificationSettings();
    return {
      notifications: settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
      exactAlarms: true,
    };
  },
};
