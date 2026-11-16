import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useGroups } from '../stores/groups';
import { useGuide } from '../stores/guide';
import { syncAll } from '../scheduler/sync';
import type { AlarmGroup } from '@core';

/**
 * 整包备份/恢复(M1 补,原「规划中」项):
 *   导出 = groups(+保活向导步骤)→ JSON → 分享面板(用户自行存文件)
 *   导入 = DocumentPicker 选 JSON → 校验 → 整量替换 → 自动重排
 * 本地优先:数据不出设备,分享面板去向由用户决定。
 */

const BACKUP_SCHEMA = 1;

export interface BackupFile {
  app: 'zhouerfuqi';
  schema: number;
  exportedAt: string;
  appVersion?: string;
  groups: AlarmGroup[];
  guideSteps?: boolean[];
}

function buildBackup(appVersion?: string): BackupFile {
  return {
    app: 'zhouerfuqi',
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    appVersion,
    groups: useGroups.getState().groups,
    guideSteps: useGuide.getState().steps,
  };
}

function parseBackup(raw: string): BackupFile {
  const obj = JSON.parse(raw) as Partial<BackupFile>;
  if (obj.app !== 'zhouerfuqi' || !Array.isArray(obj.groups)) {
    throw new Error('不是周而复起的备份文件');
  }
  for (const g of obj.groups) {
    if (!g || typeof g.id !== 'string' || typeof g.name !== 'string' || !Array.isArray(g.times) || !g.rule) {
      throw new Error(`备份里有一条不完整的排班(${g?.name ?? g?.id ?? '?'})`);
    }
  }
  return { ...obj, app: 'zhouerfuqi', schema: obj.schema ?? 1, exportedAt: obj.exportedAt ?? '', groups: obj.groups };
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

/** 导出 → 分享面板。返回分享是否成功抛错信息(null=成功) */
export async function exportBackup(appVersion?: string): Promise<string | null> {
  if (!Sharing.isAvailableAsync()) {
    throw new Error('当前设备不支持分享面板');
  }
  const json = JSON.stringify(buildBackup(appVersion), null, 2);
  const file = `${FileSystem.cacheDirectory}zhouerfuqi-backup-${stamp()}.json`;
  await FileSystem.writeAsStringAsync(file, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(file, {
    mimeType: 'application/json',
    dialogTitle: '导出周而复起备份',
    UTI: 'public.json',
  });
  return null;
}

/** 导入 → 整量替换 + 自动重排。返回导入的排班数 */
export async function importBackup(): Promise<number> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return -1;
  const asset = 'assets' in res ? res.assets[0] : null;
  if (!asset) return -1;
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const backup = parseBackup(raw);
  useGroups.getState().replaceAll(backup.groups);
  const guide = useGuide.getState();
  if (Array.isArray(backup.guideSteps) && backup.guideSteps.length === guide.steps.length) {
    backup.guideSteps.forEach((done, i) => {
      if (done !== guide.steps[i] && done) guide.toggle(i);
    });
  }
  void syncAll();
  return backup.groups.length;
}
