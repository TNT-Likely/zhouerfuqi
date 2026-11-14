import type { AlarmGroup } from '@core';

export const WD = ['一', '二', '三', '四', '五', '六', '日'] as const;

export function cnDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${parseInt(m!, 10)}月${parseInt(d!, 10)}日`;
}

export function weekdayLabel(list: number[]): string {
  return list.length ? [...list].sort().map((d) => WD[d - 1]).join('') : '未选';
}

/** 规则摘要,如「每 2 周 · 一二三四五六」 */
export function ruleDesc(group: AlarmGroup): string {
  const r = group.rule;
  if (r.kind === 'weekly') return `每周 · ${weekdayLabel(r.weekdays)}`;
  if (r.kind === 'everyNWeeks') return `每 ${r.n} 周 · ${weekdayLabel(r.weekdays)}`;
  if (r.kind === 'everyNDays') return `每 ${r.n} 天`;
  return `手动 ${r.dates.length} 天`;
}

/** 本次响铃的原因标签(与设计稿/交互稿同语义) */
export function ringReasonLabel(group: AlarmGroup, date: string, isoDow: number): string {
  const r = group.rule;
  if (r.kind === 'customDates') return '手动排班';
  if (r.kind === 'everyNDays') return `每 ${r.n} 天`;
  if (r.kind === 'everyNWeeks' && isoDow === 6 && r.weekdays.includes(6)) {
    return r.n === 2 ? '大周周六' : `每 ${r.n} 周的周六`;
  }
  if (r.kind === 'everyNWeeks') return `工作日 ${weekdayLabel(r.weekdays)}`;
  return `工作日 ${weekdayLabel(r.weekdays)}`;
}

export function holidayChip(
  status: boolean | undefined,
  onHoliday: boolean,
): { text: string; tone: 'blue' | 'green' | 'red' } | null {
  if (status === false) return { text: '法定上班 · 补班', tone: 'green' };
  if (status === true) return { text: '法定假日', tone: 'red' };
  if (onHoliday) return { text: '节假日联动 ON', tone: 'blue' };
  return null;
}
