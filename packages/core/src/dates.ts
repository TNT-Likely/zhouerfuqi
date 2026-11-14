import type { Weekday } from './types.ts';

export const MS_PER_DAY = 86_400_000;

/** `yyyy-mm-dd` -> UTC 零点 Date(全程 UTC,不受本地时区/夏令时影响) */
export function parseISO(date: string): Date {
  return new Date(date + 'T00:00:00Z');
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return toISO(new Date(parseISO(date).getTime() + n * MS_PER_DAY));
}

/** a - b 的天数差(可为负) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / MS_PER_DAY);
}

/** ISO 星期几:1=周一 … 7=周日 */
export function isoWeekday(date: string): Weekday {
  const dow = parseISO(date).getUTCDay(); // JS:0=周日
  return (dow === 0 ? 7 : dow) as Weekday;
}

/** 非负取模(负数也能得到正确余数) */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** 某日期所在"周"的周一 */
export function weekStart(date: string): string {
  return addDays(date, -(isoWeekday(date) - 1));
}
