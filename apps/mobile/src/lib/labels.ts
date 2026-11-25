import type { AlarmGroup } from '@core';
import { formattingLocale, getLocale } from '../i18n';

const labels = {
  'zh-CN': {
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    separator: '',
    cycleSeparator: '、',
    off: '休',
    notSelected: '未选',
    weekly: '每周',
    weeks: (n: number) => `每 ${n} 周`,
    days: (n: number) => `每 ${n} 天`,
    cycle: (n: number) => `${n} 天轮班`,
    manual: (n: number) => `手动 ${n} 天`,
  },
  en: {
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    separator: ', ',
    cycleSeparator: ', ',
    off: 'Off',
    notSelected: 'No days selected',
    weekly: 'Weekly',
    weeks: (n: number) => n === 1 ? 'Weekly' : `Every ${n} weeks`,
    days: (n: number) => n === 1 ? 'Daily' : `Every ${n} days`,
    cycle: (n: number) => `${n}-day rotation`,
    manual: (n: number) => n === 1 ? '1 selected date' : `${n} selected dates`,
  },
};

export function weekdayNames(locale = getLocale()): readonly string[] {
  return labels[locale].weekdays;
}

export function dateLabel(date: string, locale = getLocale()): string {
  const utc = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(utc.getTime())) return date;
  return new Intl.DateTimeFormat(formattingLocale(locale), {
    month: locale === 'en' ? 'short' : 'long', day: 'numeric', timeZone: 'UTC', calendar: 'gregory',
  }).format(utc);
}

export function monthLabel(year: number, month: number, locale = getLocale()): string {
  return new Intl.DateTimeFormat(formattingLocale(locale), {
    year: 'numeric', month: 'long', timeZone: 'UTC', calendar: 'gregory',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function weekdayLabel(list: number[], locale = getLocale()): string {
  const copy = labels[locale];
  return list.length ? [...list].sort().map((day) => copy.weekdays[day - 1]).join(copy.separator) : copy.notSelected;
}

export function ruleDesc(group: AlarmGroup, locale = getLocale()): string {
  const { rule } = group;
  const copy = labels[locale];
  switch (rule.kind) {
    case 'weekly':
      return `${copy.weekly} · ${weekdayLabel(rule.weekdays, locale)}`;
    case 'everyNWeeks':
      return `${copy.weeks(rule.n)} · ${weekdayLabel(rule.weekdays, locale)}`;
    case 'everyNDays':
      return copy.days(rule.n);
    case 'cycle':
      return `${copy.cycle(rule.days.length)} · ${rule.days.map((id) => rule.shifts.find((shift) => shift.id === id)?.name || copy.off).join(copy.cycleSeparator)}`;
    case 'customDates':
      return copy.manual(rule.dates.length);
  }
}
