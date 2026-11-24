import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import { nativeGateway } from '../gateway/nativeGateway';

export const supportsNotificationPermissionPrompt = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function checkNotificationPermission(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    // Android 12 及以下没有运行时弹窗，用户仍可在系统设置里关闭应用通知。
    return (await nativeGateway.status()).notifications;
  } catch {
    return null;
  }
}

/** Android 13 起可以主动拉起通知授权弹窗。 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!supportsNotificationPermissionPrompt) return (await checkNotificationPermission()) === true;
  try {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as never,
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function openAppNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      if (requireNativeModule('ZfAlarm').openNotificationSettings?.() === true) return;
    } catch {
      // 部分系统不提供独立的应用通知设置页。
    }
  }
  await Linking.openSettings();
}

/** 是否需要弹横幅:有启用中的班组 且 通知权限明确未授 */
export async function needsNotificationBanner(hasEnabledGroup: boolean): Promise<boolean> {
  if (!hasEnabledGroup) return false;
  return (await checkNotificationPermission()) === false;
}
