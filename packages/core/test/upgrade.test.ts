import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expandGroup, expandGroups, HolidayCalendar, nextUpcomingOccurrences, occurrenceEpoch,
  type AlarmGroup,
} from '../src/index.ts';

const morning = { id: 'morning', hour: 7, minute: 0 };
const morning2 = { id: 'morning2', hour: 7, minute: 5 };
const late = { id: 'late', hour: 17, minute: 0 };
const group: AlarmGroup = {
  id: 'shift', name: '轮班', enabled: true, times: [morning],
  rule: {
    kind: 'cycle', anchor: '2026-11-23', days: ['e', 'e', 'l', 'l', null, null],
    shifts: [{ id: 'e', name: '早班', times: [morning, morning2] }, { id: 'l', name: '晚班', times: [late] }],
  },
  holidayMode: 'raw',
};
const empty = new HolidayCalendar();

describe('cycle and daily overrides', () => {
  it('keeps each shift’s own times and lines up the cycle before the anchor', () => {
    const days = expandGroup(group, empty, '2026-11-22', 9);
    assert.deepEqual(days.map((item) => [item.date, item.shiftName, item.hour, item.minute]), [
      ['2026-11-23', '早班', 7, 0],
      ['2026-11-23', '早班', 7, 5],
      ['2026-11-24', '早班', 7, 0],
      ['2026-11-24', '早班', 7, 5],
      ['2026-11-25', '晚班', 17, 0],
      ['2026-11-26', '晚班', 17, 0],
      ['2026-11-29', '早班', 7, 0],
      ['2026-11-29', '早班', 7, 5],
      ['2026-11-30', '早班', 7, 0],
      ['2026-11-30', '早班', 7, 5],
    ]);
  });

  it('skips one occurrence, replaces one day, and adds once on a rest day', () => {
    const changed: AlarmGroup = {
      ...group,
      overrides: {
        '2026-11-23': { skippedTimeIds: ['morning'] },
        '2026-11-25': { times: [] },
        '2026-11-27': { extraTimes: [late] },
      },
    };
    assert.deepEqual(expandGroup(changed, empty, '2026-11-23', 5).map((item) => [item.date, item.timeId, item.reason]), [
      ['2026-11-23', 'morning2', 'override'],
      ['2026-11-24', 'morning', 'rule'],
      ['2026-11-24', 'morning2', 'rule'],
      ['2026-11-26', 'late', 'rule'],
      ['2026-11-27', 'late', 'override'],
    ]);
    assert.equal(expandGroup({ ...changed, enabled: false }, empty, '2026-11-23', 5).length, 0);
    assert.equal(expandGroup(group, empty, '2026-11-23', 1).length, 2);
  });

  it('keeps overlapping groups separate and advances past elapsed alarms', () => {
    const other: AlarmGroup = { ...group, id: 'other', name: '另一个班组' };
    assert.equal(expandGroups([group, other], empty, '2026-11-23', 1).length, 4);
    assert.deepEqual(nextUpcomingOccurrences([group, other], empty, new Date('2026-11-23T07:02:00')).map((item) =>
      [item.groupId, item.date, item.minute]), [['other', '2026-11-23', 5], ['shift', '2026-11-23', 5]]);
    assert.equal(nextUpcomingOccurrences([group], empty, new Date('2026-11-23T07:05:00'))[0]?.date, '2026-11-24');
  });

  it('materializes the selected local clock time on daylight saving transition days', () => {
    const date = new Date(occurrenceEpoch({ date: '2026-03-08', hour: 7, minute: 15 }));
    assert.equal(date.getHours(), 7);
    assert.equal(date.getMinutes(), 15);
  });
});
