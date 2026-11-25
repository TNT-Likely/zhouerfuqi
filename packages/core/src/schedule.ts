import { addDays, diffDays, isoWeekday, localDateISO, mod, occurrenceEpoch, weekStart } from './dates.ts';
import { HolidayCalendar } from './holidays.ts';
import type {
  AlarmGroup,
  AlarmTime,
  DayEvaluation,
  Occurrence,
  RepeatRule,
  RingReason,
  Shift,
} from './types.ts';

export function shiftForDate(rule: Extract<RepeatRule, { kind: 'cycle' }>, date: string): Shift | undefined {
  const day = rule.days[mod(diffDays(date, rule.anchor), rule.days.length)];
  return rule.shifts.find((shift) => shift.id === day);
}

/** 规则是否命中某日(不看节假日) */
export function isRuleDay(rule: RepeatRule, date: string): boolean {
  switch (rule.kind) {
    case 'weekly':
      return rule.weekdays.includes(isoWeekday(date));
    case 'everyNWeeks': {
      // 大小周语义:锚点星期几隔 N 周响(需在选中列表内);其余选中的星期每周都响
      const wd = isoWeekday(date);
      if (!rule.weekdays.includes(wd)) return false;
      if (wd !== isoWeekday(rule.anchor)) return true;
      return mod(Math.floor(diffDays(weekStart(date), weekStart(rule.anchor)) / 7), rule.n) === 0;
    }
    case 'everyNDays':
      return mod(diffDays(date, rule.anchor), rule.n) === 0;
    case 'cycle':
      return !!shiftForDate(rule, date);
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
  const { ruleHit, holiday, ring, reason } = planDay(group, calendar, date);
  return { ruleHit, holiday, ring, reason };
}

/** 每日规则、节假日和临时调整的共同入口。 */
export function planDay(group: AlarmGroup, calendar: HolidayCalendar, date: string): DayEvaluation & {
  times: AlarmTime[];
  shiftName?: string;
} {
  const shift = group.rule.kind === 'cycle' ? shiftForDate(group.rule, date) : undefined;
  const ruleHit = group.rule.kind === 'cycle' ? !!shift : isRuleDay(group.rule, date);
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
      // 轮班的休息日没有对应班次，法定补班仅适用于固定班制。
      ring = holiday === false && group.rule.kind !== 'cycle';
      reason = ring ? 'swap-workday' : null;
    }
  }
  const scheduledTimes = ring ? (shift?.times ?? group.times) : [];
  const override = group.overrides?.[date];
  if (!override) return { ruleHit, holiday, ring, reason, times: scheduledTimes, shiftName: shift?.name };

  const skipped = new Set(override.skippedTimeIds);
  const times = [...(override.times ?? scheduledTimes), ...(override.extraTimes ?? [])]
    .filter((time) => !skipped.has(time.id))
    .sort((a, b) => minutesOfTime(a) - minutesOfTime(b));
  return { ruleHit, holiday, ring: times.length > 0, reason: times.length ? 'override' : null, times, shiftName: shift?.name };
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
    const day = planDay(group, calendar, date);
    for (const time of day.times) {
      out.push({
        groupId: group.id,
        date,
        timeId: time.id,
        hour: time.hour,
        minute: time.minute,
        label: time.label,
        ...(day.shiftName ? { shiftName: day.shiftName } : {}),
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
  return findNextDay(groups, calendar, start, () => true);
}

export function nextUpcomingOccurrences(groups: AlarmGroup[], calendar: HolidayCalendar, now: Date): Occurrence[] {
  const start = localDateISO(now);
  return findNextDay(groups, calendar, start, (occurrence) => occurrenceEpoch(occurrence) > now.getTime());
}

function findNextDay(
  groups: AlarmGroup[], calendar: HolidayCalendar, start: string, include: (occurrence: Occurrence) => boolean,
): Occurrence[] {
  const enabled = groups.filter((group) => group.enabled);
  if (!enabled.length) return [];
  const WINDOW = 90;
  for (let w = 0; w < 8; w++) {
    const s = addDays(start, w * WINDOW);
    const occ = expandGroups(enabled, calendar, s, WINDOW).filter(include);
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
  return a.timeId.localeCompare(b.timeId) || a.groupId.localeCompare(b.groupId);
}

/** 便捷构造:HH:MM -> 分钟数(仅用于 UI/调试展示) */
export function minutesOfTime(t: Pick<AlarmTime, 'hour' | 'minute'>): number {
  return t.hour * 60 + t.minute;
}
