import { Platform } from 'react-native';

/**
 * [M1] 应用内 APK 自更新(Android 专用)。
 * 注意:懒 require——顶层 requireNativeModule 在无此模块的平台(iOS)会抛异常。
 */

export interface InstalledVersion {
  versionName: string;
  versionCode: number;
}

export function isUpdateSupported(): boolean {
  return Platform.OS === 'android';
}

function native(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    return require('expo-modules-core').requireNativeModule('ZfUpdate');
  } catch {
    return null;
  }
}

export function getVersion(): InstalledVersion {
  const n = native();
  if (!n) return { versionName: '-', versionCode: 0 };
  return n.getVersion() as InstalledVersion;
}

export function installApk(path: string): boolean {
  const n = native();
  if (!n) return false;
  return n.installApk(path) as boolean;
}
