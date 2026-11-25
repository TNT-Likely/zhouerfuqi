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
  if (r.kind === 'cycle') return `${r.days.length} 天轮班 · ${r.days.map((id) => r.shifts.find((shift) => shift.id === id)?.name || '休').join('、')}`;
  return `手动 ${r.dates.length} 天`;
}
