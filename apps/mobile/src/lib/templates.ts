import { addDays, isoWeekday, localDateISO, type AlarmGroup, type AlarmTime, type RepeatRule } from '@core';

export const TEMPLATES = [
  { key: 'weekly', title: '双休', detail: '周一至周五' },
  { key: 'alternating', title: '大小周', detail: '隔周多上一个周六' },
  { key: 'cycle', title: '轮班', detail: '上二休二或早晚班循环' },
  { key: 'manual', title: '手动排班', detail: '在月历选择日期' },
] as const;

export const makeId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function cycleRule(style: 'two' | 'shifts', anchor: string, base: AlarmTime[]): Extract<RepeatRule, { kind: 'cycle' }> {
  if (style === 'two') {
    return { kind: 'cycle', anchor, days: ['work', 'work', null, null], shifts: [{ id: 'work', name: '上班', times: base }] };
  }
  return {
    kind: 'cycle', anchor, days: ['early', 'early', 'late', 'late', null, null],
    shifts: [
      { id: 'early', name: '早班', times: base },
      { id: 'late', name: '晚班', times: [{ id: makeId('t'), hour: 17, minute: 0 }] },
    ],
  };
}

export function templateGroup(template: string | undefined): AlarmGroup {
  const today = localDateISO();
  const times = [{ id: makeId('t'), hour: 7, minute: 0, label: '起床' }];
  const base: Omit<AlarmGroup, 'rule'> = { id: makeId('g'), name: '上班', enabled: true, holidayMode: 'china-smart', times };
  switch (template) {
    case 'alternating':
      return { ...base, name: '大小周', rule: { kind: 'everyNWeeks', n: 2, weekdays: [1, 2, 3, 4, 5, 6], anchor: addDays(today, (6 - isoWeekday(today) + 7) % 7) } };
    case 'cycle':
      return { ...base, name: '轮班', holidayMode: 'raw', rule: cycleRule('two', today, times) };
    case 'manual':
      return { ...base, name: '手动排班', holidayMode: 'raw', rule: { kind: 'customDates', dates: [] } };
    default:
      return { ...base, rule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] } };
  }
}
