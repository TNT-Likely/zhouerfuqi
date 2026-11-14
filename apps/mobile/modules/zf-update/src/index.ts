import { requireNativeModule } from 'expo-modules-core';

const ZfUpdate = requireNativeModule('ZfUpdate');

export interface InstalledVersion {
  versionName: string;
  versionCode: number;
}

export function getVersion(): InstalledVersion {
  return ZfUpdate.getVersion() as InstalledVersion;
}

export function installApk(path: string): boolean {
  return ZfUpdate.installApk(path) as boolean;
}
