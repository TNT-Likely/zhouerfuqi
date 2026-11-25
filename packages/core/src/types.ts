/** ISO 星期:1 = 周一 … 7 = 周日 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 闹钟组内的一个响铃时间 */
export interface AlarmTime {
  id: string;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  label?: string;
}

export interface Shift {
  id: string;
  name: string;
  times: AlarmTime[];
}

export interface DayOverride {
  /** 完整替换当天的响铃时间。空列表表示这一天休息。 */
  times?: AlarmTime[];
  skippedTimeIds?: string[];
  extraTimes?: AlarmTime[];
}

/**
 * 班制规则。日期一律使用 ISO `yyyy-mm-dd` 字符串(无时区歧义)。
 *
 * - `weekly`:每周固定星期几(普通双休 / 单休)
 * - `everyNWeeks`:每 N 周的星期几(大小周 = n=2,anchor 是任意一个
 *   "循环周"里的日期,推荐用某个已知大周的周六)
 * - `everyNDays`:每 N 天响一天(上 X 休 Y 的最简形态,X=Y-1 时即
 *   "上一天休一天";后续可扩展更复杂的连上连休模式)
 * - `customDates`:手动月历点选,完全自由;点选即权威,
 *   不受节假日叠加影响(点选日一定响)
 */
export type RepeatRule =
  | { kind: 'weekly'; weekdays: Weekday[] }
  | { kind: 'everyNWeeks'; n: number; weekdays: Weekday[]; anchor: string }
  | { kind: 'everyNDays'; n: number; anchor: string }
  | { kind: 'cycle'; anchor: string; days: (string | null)[]; shifts: Shift[] }
  | { kind: 'customDates'; dates: string[] };

/**
 * 节假日叠加模式:
 *
 * - `raw`:完全按规则响,忽略节假日数据
 * - `china-smart`(缺省):规则命中日若为法定休息日则跳过;
 *   不在规则内的"调休补班日"自动响(即华为"智能工作日"语义
 *   与大小周规则的正交组合)
 */
export type HolidayMode = 'raw' | 'china-smart';

/** 闹钟组:一组固定搭配的响铃时间 + 一条班制规则 */
export interface AlarmGroup {
  id: string;
  name: string;
  enabled: boolean;
  times: AlarmTime[];
  rule: RepeatRule;
  holidayMode?: HolidayMode;
  overrides?: Record<string, DayOverride>;
}

export type RingReason =
  | 'rule' // 规则命中(未被节假日取消)
  | 'swap-workday' // 调休补班日(规则未命中,但法定要上班)
  | 'override';

export interface Occurrence {
  /** 所属闹钟组 */
  groupId: string;
  /** ISO `yyyy-mm-dd` */
  date: string;
  timeId: string;
  hour: number;
  minute: number;
  label?: string;
  shiftName?: string;
  reason: RingReason;
}

/** 某一天的判定结果,供 UI 日历着色使用 */
export interface DayEvaluation {
  /** 规则是否命中 */
  ruleHit: boolean;
  /** 节假日状态:true=法定休息日 false=调休补班日 undefined=无数据 */
  holiday: boolean | undefined;
  /** 当天该组是否会响 */
  ring: boolean;
  reason: RingReason | null;
}
