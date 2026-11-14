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

  // 首选:仓库内 raw manifest(CI 每次发版提交,raw.githubusercontent 无 API 限流)
  try {
    const meta = await fetchJson(
      `https://raw.githubusercontent.com/${source.owner}/${source.repo}/main/updates/update.json`,
    );
    return evaluateUpdate(meta, current);
  } catch {
    // 回退:releases/latest API(匿名 60 次/小时/IP,易 403)
  }

  try {
    const release = await fetchJson(
      `https://api.github.com/repos/${source.owner}/${source.repo}/releases/latest`,
    );
    const assets: { name: string; browser_download_url: string }[] = release.assets ?? [];
    const metaAsset = assets.find((a) => a.name === 'update.json');
    if (!metaAsset) throw new Error('Release 缺少 update.json 资产');
    const meta = await fetchJson(metaAsset.browser_download_url);
    return evaluateUpdate(meta, current);
  } catch (e: any) {
    return { status: 'error', error: e?.message ?? String(e), current };
  }
}

function evaluateUpdate(
  meta: any,
  current: { versionName: string; versionCode: number },
): UpdateCheckResult {
  const info: UpdateInfo = {
    versionName: String(meta.versionName ?? ''),
    versionCode: Number(meta.versionCode ?? 0),
    apkUrl: String(meta.apk ?? ''),
    notes: String(meta.notes ?? ''),
  };
  if (!info.apkUrl) throw new Error('update.json 缺少 apk 地址');
  if (info.versionCode > current.versionCode) {
    return { status: 'available', current, info };
  }
  return { status: 'up-to-date', current };
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
