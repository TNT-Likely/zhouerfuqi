import { HolidayCalendar, type HolidayData } from '@core';
import * as FileSystem from 'expo-file-system/legacy';
import data2026 from '../../assets/holidays/2026.json';

// [M1] 内置 holiday-cn 年度快照(离线兜底);[M1 补] 在线更新:
// 国务院每年 11-12 月发布次年安排,holiday-cn 仓库随后更新。
// 这里拉取「内置年份 + 1」的年度数据,成功后落 documentDirectory 缓存,重启仍有效。
// 失败(离线/未发布)静默——内置快照始终兜底。

const BUNDLED: HolidayData[] = [data2026 as HolidayData];
const SOURCE_REPO = 'NateScarlet/holiday-cn';

let cached: HolidayData[] = [];
let cacheLoaded = false;
let lastRefresh: { at: string; ok: boolean; years: number[] } | null = null;
let calendar: HolidayCalendar | null = null;

function cacheDir(): string {
  return `${FileSystem.documentDirectory}holidays/`;
}

async function ensureCacheDir(): Promise<string> {
  const dir = cacheDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/** 读缓存目录里的年度 JSON(结构非法的文件直接忽略) */
async function loadCached(): Promise<HolidayData[]> {
  try {
    const dir = await ensureCacheDir();
    const listing = await FileSystem.readDirectoryAsync(dir);
    const out: HolidayData[] = [];
    for (const name of listing) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await FileSystem.readAsStringAsync(`${dir}${name}`);
        const data = JSON.parse(raw) as HolidayData;
        if (typeof data.year === 'number' && Array.isArray(data.days)) out.push(data);
      } catch {
        // 单个缓存文件损坏不拖累整体
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function persistCached(data: HolidayData): Promise<void> {
  const dir = await ensureCacheDir();
  await FileSystem.writeAsStringAsync(`${dir}${data.year}.json`, JSON.stringify(data), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

function invalidate(): void {
  calendar = null;
}

function bundledYears(): number[] {
  return BUNDLED.map((d) => d.year);
}

function coveredYears(): number[] {
  return [...new Set([...bundledYears(), ...cached.map((d) => d.year)])];
}

/**
 * 尝试补齐「最新已覆盖年份 + 1」的节假日数据(通常即次年)。
 * 静默完成:返回是否新增了年份。重复调用在同一启动周期内会被去重。
 */
export async function refreshHolidays(now = new Date()): Promise<boolean> {
  const target = Math.max(...coveredYears()) + 1;
  const ceiling = now.getFullYear() + 1; // 不追未来两年之外
  if (target > ceiling) return false;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${SOURCE_REPO}/master/${target}.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as HolidayData;
    if (data.year !== target || !Array.isArray(data.days) || data.days.length === 0) {
      throw new Error('bad payload');
    }
    await persistCached(data);
    cached = await loadCached();
    invalidate();
    lastRefresh = { at: new Date().toISOString(), ok: true, years: coveredYears() };
    return true;
  } catch {
    lastRefresh = { at: new Date().toISOString(), ok: false, years: coveredYears() };
    return false;
  }
}

function allDatas(): HolidayData[] {
  if (!cacheLoaded) {
    // 同步路径拿不到缓存文件(异步 IO);首启由 initHolidays 预热,这里先用内置
    return BUNDLED;
  }
  return [...BUNDLED, ...cached.filter((c) => !BUNDLED.some((b) => b.year === c.year))];
}

export function getHolidayCalendar(): HolidayCalendar {
  if (!calendar) calendar = new HolidayCalendar(...allDatas());
  return calendar;
}

/** App 启动时调用:加载缓存 + 静默尝试拉新年份 */
export async function initHolidays(): Promise<void> {
  cached = await loadCached();
  cacheLoaded = true;
  invalidate();
  await refreshHolidays();
}

export function holidayInfo() {
  const datas = allDatas();
  return {
    years: [...new Set(datas.map((d) => d.year))],
    days: datas.reduce((n, d) => n + d.days.length, 0),
    source: `holiday-cn (MIT)${cached.length ? ' · 在线更新可用' : ''}`,
    lastRefresh,
  };
}
