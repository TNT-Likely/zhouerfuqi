import { Platform, PermissionsAndroid, Linking } from 'react-native';

/**
 * 权限主动检测/申请(Android;iOS 的通知权限随排班动作触发系统弹窗,不在此处理)。
 * - POST_NOTIFICATIONS(API 33+ 运行时):通知是「响铃提醒」的前置,未授权时横幅+弹窗主动申请
 * - SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM:清单声明 USE_EXACT_ALARM,安装即授权,无需运行时申请
 * - USE_FULL_SCREEN_INTENT:安装即授权(Android 14+ 用户可在设置撤销,降级为悬浮横幅,不阻塞)
 */

export async function checkNotificationPermission(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null; // iOS 不在此通道管理
  if (Number(Platform.Version) < 33) return true; // API<33 安装即有
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as never,
    );
  } catch {
    return null;
  }
}

/** 主动拉起系统授权弹窗;被永久拒绝时返回 false(调用方应引导去系统设置) */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) < 33) return true;
  try {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as never,
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** 跳系统设置的应用详情页(永久拒绝后的兜底引导) */
export function openAppNotificationSettings(): void {
  Linking.openSettings();
}

/** 是否需要弹横幅:有启用中的班组 且 通知权限明确未授 */
export async function needsNotificationBanner(hasEnabledGroup: boolean): Promise<boolean> {
  if (!hasEnabledGroup) return false;
  return (await checkNotificationPermission()) === false;
}
