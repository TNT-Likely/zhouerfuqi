import { addDays, diffDays, isoWeekday, mod, weekStart } from './dates.ts';
import { HolidayCalendar } from './holidays.ts';
import type {
  AlarmGroup,
  AlarmTime,
  DayEvaluation,
  Occurrence,
  RepeatRule,
  RingReason,
} from './types.ts';

/** 规则是否命中某日(不看节假日) */
export function isRuleDay(rule: RepeatRule, date: string): boolean {
  switch (rule.kind) {
    case 'weekly':
      return rule.weekdays.includes(isoWeekday(date));
    case 'everyNWeeks':
      return (
        rule.weekdays.includes(isoWeekday(date)) &&
        mod(Math.floor(diffDays(weekStart(date), weekStart(rule.anchor)) / 7), rule.n) === 0
      );
    case 'everyNDays':
      return mod(diffDays(date, rule.anchor), rule.n) === 0;
    case 'customDates':
      return rule.dates.includes(date);
  }
}

/**
 * 判定某天某组是否响铃(china-smart 模式):
 * - 规则命中 && 非法定休息日 → 响(rule)
 * - 规则未命中 && 调休补班日 → 响(swap-workday)
 */
export function evaluateDay(
  group: AlarmGroup,
  calendar: HolidayCalendar,
  date: string,
): DayEvaluation {
  const ruleHit = isRuleDay(group.rule, date);
  const holiday = calendar.statusOf(date);
  // customDates(手动点选)视为用户最高意志,始终按 raw 处理:
  // 点选的日期一定响,也不会因为落在法定假日而被取消
  const mode =
    group.rule.kind === 'customDates' ? 'raw' : (group.holidayMode ?? 'china-smart');

  let ring: boolean;
  let reason: RingReason | null;
  if (mode === 'raw') {
    ring = ruleHit;
    reason = ruleHit ? 'rule' : null;
  } else {
    if (ruleHit) {
      ring = holiday !== true;
      reason = ring ? 'rule' : null;
    } else {
      ring = holiday === false;
      reason = ring ? 'swap-workday' : null;
    }
  }
  return { ruleHit, holiday, ring, reason };
}

/** 从 start(含)起展开 days 天内某组的全部响铃事件,按日期时间排序 */
export function expandGroup(
  group: AlarmGroup,
  calendar: HolidayCalendar,
  start: string,
  days: number,
): Occurrence[] {
  const out: Occurrence[] = [];
  if (!group.enabled) return out;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const day = evaluateDay(group, calendar, date);
    if (!day.ring) continue;
    for (const time of group.times) {
      out.push({
        date,
        timeId: time.id,
        hour: time.hour,
        minute: time.minute,
        label: time.label,
        reason: day.reason ?? 'rule',
      });
    }
  }
  return out.sort(compareOccurrence);
}

/** 多组一起展开 */
export function expandGroups(
  groups: AlarmGroup[],
  calendar: HolidayCalendar,
  start: string,
  days: number,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const group of groups) {
    out.push(...expandGroup(group, calendar, start, days));
  }
  return out.sort(compareOccurrence);
}

/**
 * 从 start(含)起往后找,返回"最早出现响铃的那一天"的全部事件。
 * 最多向后扫约 720 天(customDates 可以排得很远)。
 */
export function nextOccurrences(
  groups: AlarmGroup[],
  calendar: HolidayCalendar,
  start: string,
): Occurrence[] {
  const WINDOW = 90;
  for (let w = 0; w < 8; w++) {
    const s = addDays(start, w * WINDOW);
    const occ = expandGroups(groups, calendar, s, WINDOW);
    if (occ.length > 0) {
      const firstDate = occ[0]!.date;
      return occ.filter((o) => o.date === firstDate);
    }
  }
  return [];
}

function compareOccurrence(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.timeId.localeCompare(b.timeId);
}

/** 便捷构造:HH:MM -> 分钟数(仅用于 UI/调试展示) */
export function minutesOfTime(t: Pick<AlarmTime, 'hour' | 'minute'>): number {
  return t.hour * 60 + t.minute;
}
