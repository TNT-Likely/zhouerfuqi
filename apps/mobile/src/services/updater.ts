import * as FileSystem from 'expo-file-system/legacy';
import { getVersion, installApk } from '../../modules/zf-update/src';

/**
 * 应用内自更新流水线:
 *   GitHub Release(tag 推送触发 CI 构建)
 *     → Release 资产: zhouerfuqi-<ver>.apk + update.json
 *     → App: releases/latest API 找 update.json → 比对 versionCode
 *     → 下载 APK → FileProvider 拉起系统安装器
 */

export const DEFAULT_UPDATE_SOURCE = {
  // GitHub 仓库(TNT-Likely/zhouerfuqi);CI 推 tag 后自动出包
  owner: 'TNT-Likely',
  repo: 'zhouerfuqi',
};

export interface UpdateInfo {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  notes: string;
}

export type UpdateCheckResult =
  | { status: 'up-to-date'; current: { versionName: string; versionCode: number } }
  | { status: 'available'; current: { versionName: string; versionCode: number }; info: UpdateInfo }
  | { status: 'error'; error: string; current: { versionName: string; versionCode: number } }

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function checkUpdate(
  source: { owner: string; repo: string } = DEFAULT_UPDATE_SOURCE,
): Promise<UpdateCheckResult> {
  const current = getVersion();
  try {
    const release = await fetchJson(
      `https://api.github.com/repos/${source.owner}/${source.repo}/releases/latest`,
    );
    const assets: { name: string; browser_download_url: string }[] = release.assets ?? [];
    const metaAsset = assets.find((a) => a.name === 'update.json');
    if (!metaAsset) throw new Error('Release 缺少 update.json 资产');

    const meta = await fetchJson(metaAsset.browser_download_url);
    const info: UpdateInfo = {
      versionName: String(meta.versionName ?? release.tag_name),
      versionCode: Number(meta.versionCode ?? 0),
      apkUrl: String(meta.apk ?? ''),
      notes: String(meta.notes ?? release.body ?? ''),
    };
    if (!info.apkUrl) throw new Error('update.json 缺少 apk 地址');

    if (info.versionCode > current.versionCode) {
      return { status: 'available', current, info };
    }
    return { status: 'up-to-date', current };
  } catch (e: any) {
    return { status: 'error', error: e?.message ?? String(e), current };
  }
}

export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const dest = `${FileSystem.cacheDirectory}zhouerfuqi-${info.versionName}.apk`;
  const callback = FileSystem.createDownloadResumable(info.apkUrl, dest, {}, (p) => {
    const total = p.totalBytesExpectedToWrite || 1;
    onProgress?.(Math.round(((p.totalBytesWritten || 0) / total) * 100));
  });
  const result = await callback.downloadAsync();
  if (!result || result.status !== 200) throw new Error('下载失败');
  installApk(result.uri);
}
