import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HolidayCalendar } from '../src/holidays.ts';
import {
  evaluateDay,
  expandGroup,
  expandGroups,
  nextOccurrences,
} from '../src/schedule.ts';
import type { AlarmGroup, Occurrence } from '../src/types.ts';

/**
 * 合成节假日数据(仅用于测试,不对应任何真实年份的国务院安排):
 * - 2026-01-01(周四) 放假
 * - 2026-01-02(周五) 放假
 * - 2026-01-04(周日) 调休补班
 * - 2026-01-10(周六) 调休补班(叠加用)
 * - 2026-01-17(周六) 放假(叠加用)
 */
const cal = new HolidayCalendar({
  year: 2026,
  days: [
    { name: '元旦', date: '2026-01-01', isOffDay: true },
    { name: '元旦', date: '2026-01-02', isOffDay: true },
    { name: '元旦调休', date: '2026-01-04', isOffDay: false },
    { name: '调休补班', date: '2026-01-10', isOffDay: false },
    { name: '放假', date: '2026-01-17', isOffDay: true },
  ],
});

const seven = [{ id: 't1', hour: 7, minute: 0 }];
const fmt = (occ: Occurrence[]) =>
  occ.map((o) => `${o.date} ${String(o.hour).padStart(2, '0')}:${String(o.minute).padStart(2, '0')} ${o.reason}`);

describe('weekly × china-smart:法定假日跳过、调休补班自动响', () => {
  const group: AlarmGroup = {
    id: 'g1',
    name: '上班',
    enabled: true,
    times: seven,
    rule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] },
  };

  it('节假日不响、补班周日响', () => {
    // 2025-12-29(周一) 起 10 天:12-29..2026-01-07
    const occ = expandGroup(group, cal, '2025-12-29', 10);
    assert.deepEqual(fmt(occ), [
      '2025-12-29 07:00 rule',
      '2025-12-30 07:00 rule',
      '2025-12-31 07:00 rule',
      // 01-01、01-02 放假跳过
      '2026-01-04 07:00 swap-workday', // 周日补班
      '2026-01-05 07:00 rule',
      '2026-01-06 07:00 rule',
      '2026-01-07 07:00 rule',
    ]);
  });

  it('raw 模式完全无视节假日', () => {
    const raw: AlarmGroup = { ...group, holidayMode: 'raw' };
    const occ = expandGroup(raw, cal, '2025-12-29', 10);
    assert.deepEqual(fmt(occ), [
      '2025-12-29 07:00 rule',
      '2025-12-30 07:00 rule',
      '2025-12-31 07:00 rule',
      '2026-01-01 07:00 rule',
      '2026-01-02 07:00 rule',
      // 01-04 周日不在 weekdays 里,即使补班也不响
      '2026-01-05 07:00 rule',
      '2026-01-06 07:00 rule',
      '2026-01-07 07:00 rule',
    ]);
  });
});

describe('everyNWeeks:大小周', () => {
  it('anchor 为大周周六,逢 2 周的周六响', () => {
    const group: AlarmGroup = {
      id: 'g2',
      name: '大周周六',
      enabled: true,
      times: seven,
      rule: { kind: 'everyNWeeks', n: 2, weekdays: [6], anchor: '2026-01-03' },
    };
    // 01-03(周六,循环周)响;01-10 小周周六不响
    // 另:01-04(周日)是全国调休补班日,按法定上班独立响起(不受周期约束)
    // 01-17 虽为大周周六,但落在放假(合成数据)→ 跳过
    const occ = expandGroup(group, cal, '2026-01-01', 20);
    assert.deepEqual(fmt(occ), [
      '2026-01-03 07:00 rule',
      '2026-01-04 07:00 swap-workday',
      '2026-01-10 07:00 swap-workday',
    ]);
  });

  it('anchor 在周中时,整周共享同一奇偶(按周一为周起点对齐)', () => {
    const group: AlarmGroup = {
      id: 'g3',
      name: '周一',
      enabled: true,
      times: seven,
      rule: { kind: 'everyNWeeks', n: 2, weekdays: [1], anchor: '2026-01-07' }, // 周三
    };
    // anchor 周 = 01-05(周一) 所在周;补班日 01-04、01-10 独立响起
    const occ = expandGroup(group, cal, '2026-01-01', 20);
    assert.deepEqual(fmt(occ), [
      '2026-01-04 07:00 swap-workday',
      '2026-01-05 07:00 rule',
      '2026-01-10 07:00 swap-workday',
      '2026-01-19 07:00 rule',
    ]);
  });

  it('china-smart 叠加:大周周六放假跳过,小周周六补班响起', () => {
    const group: AlarmGroup = {
      id: 'g4',
      name: '大小周周六',
      enabled: true,
      times: seven,
      rule: { kind: 'everyNWeeks', n: 2, weekdays: [6], anchor: '2026-01-03' },
    };
    const occ = expandGroup(group, cal, '2026-01-01', 20);
    assert.deepEqual(fmt(occ), [
      '2026-01-03 07:00 rule', // 大周周六,普通
      '2026-01-04 07:00 swap-workday', // 周日补班,独立响起
      '2026-01-10 07:00 swap-workday', // 小周周六,但调休补班
      // 01-17 是大周周六,但放假 → 跳过
    ]);
  });
});

describe('everyNDays:上 X 休 Y 最简形态', () => {
  it('每 3 天响一天', () => {
    const group: AlarmGroup = {
      id: 'g5',
      name: '轮值',
      enabled: true,
      times: seven,
      rule: { kind: 'everyNDays', n: 3, anchor: '2026-01-01' },
    };
    const occ = expandGroup(group, cal, '2026-01-01', 8);
    // 注意:01-01 规则命中,但落在法定假日(合成数据元旦)被 china-smart 跳过
    assert.deepEqual(fmt(occ), [
      '2026-01-04 07:00 rule',
      '2026-01-07 07:00 rule',
    ]);
  });

  it('anchor 之前的日子也能正确对齐(negative diff)', () => {
    const group: AlarmGroup = {
      id: 'g6',
      name: '轮值',
      enabled: true,
      times: seven,
      rule: { kind: 'everyNDays', n: 3, anchor: '2026-01-10' },
    };
    const occ = expandGroup(group, cal, '2026-01-01', 8);
    // 01-01 按 diff=-9 命中循环,但同样被元旦假日层跳过
    assert.deepEqual(fmt(occ), [
      '2026-01-04 07:00 rule',
      '2026-01-07 07:00 rule',
    ]);
  });
});

describe('customDates:自定义月历点选', () => {
  it('只响点选的日期', () => {
    const group: AlarmGroup = {
      id: 'g7',
      name: '本月排班',
      enabled: true,
      times: seven,
      rule: { kind: 'customDates', dates: ['2026-01-03', '2026-01-09'] },
    };
    const occ = expandGroup(group, cal, '2026-01-01', 12);
    assert.deepEqual(fmt(occ), ['2026-01-03 07:00 rule', '2026-01-09 07:00 rule']);
  });
});

describe('闹钟组语义', () => {
  it('一组多个时间,每个响铃日展开多条', () => {
    const group: AlarmGroup = {
      id: 'g8',
      name: '上班',
      enabled: true,
      times: [
        { id: 'a', hour: 6, minute: 40, label: '第一道' },
        { id: 'b', hour: 6, minute: 50 },
        { id: 'c', hour: 12, minute: 55, label: '午休' },
      ],
      rule: { kind: 'customDates', dates: ['2026-01-05'] },
    };
    const occ = expandGroup(group, cal, '2026-01-01', 10);
    assert.deepEqual(fmt(occ), [
      '2026-01-05 06:40 rule',
      '2026-01-05 06:50 rule',
      '2026-01-05 12:55 rule',
    ]);
  });

  it('enabled=false 的组整体静音', () => {
    const group: AlarmGroup = {
      id: 'g9',
      name: '上班',
      enabled: false,
      times: seven,
      rule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6] },
    };
    assert.deepEqual(expandGroup(group, cal, '2026-01-01', 10), []);
  });
});

describe('evaluateDay / nextOccurrences', () => {
  it('evaluateDay 给出日历着色所需信息', () => {
    const group: AlarmGroup = {
      id: 'g10',
      name: '上班',
      enabled: true,
      times: seven,
      rule: { kind: 'weekly', weekdays: [4] }, // 周四
    };
    assert.deepEqual(evaluateDay(group, cal, '2026-01-01'), {
      ruleHit: true,
      holiday: true, // 元旦放假
      ring: false,
      reason: null,
    });
    assert.deepEqual(evaluateDay(group, cal, '2026-01-08'), {
      ruleHit: true,
      holiday: undefined,
      ring: true,
      reason: 'rule',
    });
    assert.deepEqual(evaluateDay(group, cal, '2026-01-04'), {
      ruleHit: false, // 周日
      holiday: false, // 补班
      ring: true,
      reason: 'swap-workday',
    });
  });

  it('nextOccurrences 返回最早响铃日的全部事件,跨组合并排序', () => {
    const groups: AlarmGroup[] = [
      {
        id: 'g11',
        name: '上班',
        enabled: true,
        times: [{ id: 'a', hour: 6, minute: 40 }],
        rule: { kind: 'customDates', dates: ['2026-01-05', '2026-01-06'] },
      },
      {
        id: 'g12',
        name: '午休',
        enabled: true,
        times: [{ id: 'b', hour: 12, minute: 55 }],
        rule: { kind: 'customDates', dates: ['2026-01-05'] },
      },
    ];
    const occ = nextOccurrences(groups, cal, '2026-01-01');
    assert.deepEqual(fmt(occ), [
      '2026-01-05 06:40 rule',
      '2026-01-05 12:55 rule',
    ]);
  });

  it('customDates 点选日即使落在法定假日也照响(点选即权威),多组结果按日期时间排序', () => {
    const groups: AlarmGroup[] = [
      {
        id: 'g13',
        name: '加班',
        enabled: true,
        times: [{ id: 'b', hour: 12, minute: 55 }],
        rule: { kind: 'customDates', dates: ['2026-01-02'] }, // 01-02 是法定放假日的合成数据
      },
      {
        id: 'g14',
        name: '上班',
        enabled: true,
        times: [{ id: 'a', hour: 6, minute: 40 }],
        rule: { kind: 'customDates', dates: ['2026-01-03'] },
      },
    ];
    const occ = expandGroups(groups, cal, '2026-01-01', 5);
    assert.deepEqual(fmt(occ), [
      '2026-01-02 12:55 rule', // 放假日仍响:手动点选覆盖节假日层
      '2026-01-03 06:40 rule',
    ]);
  });
});
