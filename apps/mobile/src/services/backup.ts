import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useGroups } from '../stores/groups';
import { useGuide } from '../stores/guide';
import type { AlarmGroup } from '@core';

/**
 * 整包备份/恢复(M1 补,原「规划中」项):
 *   导出 = groups(+保活向导步骤)→ JSON → 分享面板(用户自行存文件)
 *   导入 = DocumentPicker 选 JSON → 校验 → 用户确认 → 整量替换 → 自动重排
 * 本地优先:数据不出设备,分享面板去向由用户决定。
 */

const BACKUP_SCHEMA = 2;

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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function validRule(value: unknown) {
  if (!record(value)) return false;
  const weekdays = Array.isArray(value.weekdays) && value.weekdays.every((day) => integer(day, 1, 7));
  switch (value.kind) {
    case 'weekly': return weekdays;
    case 'everyNWeeks': return weekdays && integer(value.n, 1) && date(value.anchor);
    case 'everyNDays': return integer(value.n, 1) && date(value.anchor);
    case 'cycle': {
      if (!date(value.anchor) || !Array.isArray(value.days) || !value.days.length || !Array.isArray(value.shifts)) return false;
      const shifts = value.shifts;
      return shifts.every((shift) => record(shift) && validId(shift.id)
        && typeof shift.name === 'string' && validTimes(shift.times))
        && new Set(shifts.map((shift) => shift.id)).size === shifts.length
        && value.days.every((id) => id === null || shifts.some((shift) => shift.id === id));
    }
    case 'customDates': return Array.isArray(value.dates) && value.dates.every(date);
    default: return false;
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes(':');
}

function validTimes(value: unknown) {
  return Array.isArray(value) && value.every((time) => record(time) && validId(time.id)
    && integer(time.hour, 0, 23) && integer(time.minute, 0, 59)
    && (time.label === undefined || typeof time.label === 'string'))
    && new Set(value.map((time) => time.id)).size === value.length;
}

function validOverrides(value: unknown) {
  if (value === undefined) return true;
  return record(value) && Object.entries(value).every(([key, item]) => date(key) && record(item)
    && (item.times === undefined || validTimes(item.times))
    && (item.extraTimes === undefined || validTimes(item.extraTimes))
    && (item.skippedTimeIds === undefined || Array.isArray(item.skippedTimeIds) && item.skippedTimeIds.every(validId)));
}

function validGroup(value: unknown): value is AlarmGroup {
  return record(value)
    && validId(value.id) && typeof value.name === 'string' && typeof value.enabled === 'boolean'
    && (value.holidayMode === undefined || value.holidayMode === 'china-smart' || value.holidayMode === 'raw')
    && validRule(value.rule)
    && validTimes(value.times) && validOverrides(value.overrides);
}

function parseBackup(raw: string): BackupFile {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('无法读取 JSON，请选择完整的周而复起备份文件。');
  }
  if (!record(obj) || obj.app !== 'zhouerfuqi' || !Array.isArray(obj.groups)) {
    throw new Error('不是周而复起的备份文件');
  }
  if (obj.schema !== undefined && obj.schema !== 1 && obj.schema !== BACKUP_SCHEMA) {
    throw new Error('备份使用了当前版本无法读取的格式。');
  }
  if (!obj.groups.every(validGroup)) throw new Error('备份包含不完整的班组、响铃时间或排班规则。');
  if (new Set(obj.groups.map((group) => group.id)).size !== obj.groups.length) {
    throw new Error('备份包含重复的班组标识。');
  }
  const guideSteps = Array.isArray(obj.guideSteps) && obj.guideSteps.every((step) => typeof step === 'boolean')
    ? obj.guideSteps as boolean[] : undefined;
  return {
    app: 'zhouerfuqi',
    schema: BACKUP_SCHEMA,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    groups: obj.groups,
    guideSteps,
  };
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

export async function exportBackup(appVersion?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
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
}

export async function pickBackup(): Promise<{ name: string; backup: BackupFile } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    return { name: asset.name, backup: parseBackup(raw) };
  } finally {
    if (FileSystem.cacheDirectory && asset.uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
    }
  }
}

function recoveryPath(): string {
  if (!FileSystem.documentDirectory) throw new Error('无法找到本地备份目录。');
  return FileSystem.documentDirectory + 'zhouerfuqi-before-restore.json';
}

export async function getRecoveryBackup(): Promise<BackupFile | null> {
  const file = recoveryPath();
  if (!(await FileSystem.getInfoAsync(file)).exists) return null;
  return parseBackup(await FileSystem.readAsStringAsync(file));
}

export async function restoreBackup(backup: BackupFile, appVersion?: string): Promise<void> {
  await FileSystem.writeAsStringAsync(recoveryPath(), JSON.stringify(buildBackup(appVersion), null, 2));
  useGroups.getState().replaceAll(backup.groups);
  const guide = useGuide.getState();
  if (Array.isArray(backup.guideSteps) && backup.guideSteps.length === guide.steps.length) {
    backup.guideSteps.forEach((done, i) => {
      if (done !== guide.steps[i]) guide.toggle(i);
    });
  }
}
