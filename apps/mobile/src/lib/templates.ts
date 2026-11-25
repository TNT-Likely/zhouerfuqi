import { addDays, isoWeekday, localDateISO, type AlarmGroup, type AlarmTime, type RepeatRule } from '@core';
import { getLocale, usesChineseHolidaysByDefault } from '../i18n';

const names = {
  'zh-CN': {
    weeklyTitle: '双休', weeklyDetail: '周一至周五',
    alternatingTitle: '大小周', alternatingDetail: '隔周多上一个周六',
    cycleTitle: '轮班', cycleDetail: '上二休二或早晚班循环',
    manualTitle: '手动排班', manualDetail: '在月历选择日期',
    work: '上班', early: '早班', late: '晚班', wakeUp: '起床',
  },
  en: {
    weeklyTitle: 'Weekdays', weeklyDetail: 'Monday to Friday',
    alternatingTitle: 'Alternate Saturdays', alternatingDetail: 'Weekdays plus every other Saturday',
    cycleTitle: 'Rotating shifts', cycleDetail: '2 on, 2 off or rotating early and late shifts',
    manualTitle: 'Pick dates', manualDetail: 'Choose dates on the calendar',
    work: 'Work', early: 'Early shift', late: 'Late shift', wakeUp: 'Wake up',
  },
};

export function templates(locale = getLocale()) {
  const copy = names[locale];
  return [
    { key: 'weekly', title: copy.weeklyTitle, detail: copy.weeklyDetail },
    { key: 'alternating', title: copy.alternatingTitle, detail: copy.alternatingDetail },
    { key: 'cycle', title: copy.cycleTitle, detail: copy.cycleDetail },
    { key: 'manual', title: copy.manualTitle, detail: copy.manualDetail },
  ] as const;
}

export const makeId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function cycleRule(style: 'two' | 'shifts', anchor: string, base: AlarmTime[], locale = getLocale()): Extract<RepeatRule, { kind: 'cycle' }> {
  const copy = names[locale];
  if (style === 'two') {
    return { kind: 'cycle', anchor, days: ['work', 'work', null, null], shifts: [{ id: 'work', name: copy.work, times: base }] };
  }
  return {
    kind: 'cycle', anchor, days: ['early', 'early', 'late', 'late', null, null],
    shifts: [
      { id: 'early', name: copy.early, times: base },
      { id: 'late', name: copy.late, times: [{ id: makeId('t'), hour: 17, minute: 0 }] },
    ],
  };
}

export function templateGroup(template: string | undefined, locale = getLocale()): AlarmGroup {
  const copy = names[locale];
  const today = localDateISO();
  const times = [{ id: makeId('t'), hour: 7, minute: 0, label: copy.wakeUp }];
  const holidayMode = usesChineseHolidaysByDefault() ? 'china-smart' : 'raw';
  const base: Omit<AlarmGroup, 'rule'> = { id: makeId('g'), name: copy.work, enabled: true, holidayMode, times };
  switch (template) {
    case 'alternating':
      return { ...base, name: copy.alternatingTitle, rule: { kind: 'everyNWeeks', n: 2, weekdays: [1, 2, 3, 4, 5, 6], anchor: addDays(today, (6 - isoWeekday(today) + 7) % 7) } };
    case 'cycle':
      return { ...base, name: copy.cycleTitle, holidayMode: 'raw', rule: cycleRule('two', today, times, locale) };
    case 'manual':
      return { ...base, name: copy.manualTitle, holidayMode: 'raw', rule: { kind: 'customDates', dates: [] } };
    default:
      return { ...base, rule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] } };
  }
}
