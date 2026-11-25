import { expandGroups, localDateISO, occurrenceEpoch, pad2, type AlarmGroup, type Occurrence } from '@core';
import { getHolidayCalendar } from '../services/holidays';
import type { MaterializedAlarm } from '../gateway/types';
import { cnDate } from '../lib/labels';

/** 视野:原生层只注册未来 N 天的具体响铃(架构 §4.1) */
export const HORIZON_DAYS = 14;

export const todayISO = localDateISO;

export function alarmId({ groupId, timeId, date }: Pick<Occurrence, 'groupId' | 'timeId' | 'date'>): string {
  return `${groupId}:${timeId}:${date}`;
}

/**
 * 规则 → 未来 N 天的具体响铃事件(引擎唯一事实源的物化投影)。
 * epoch 按本地时区换算;时区变更后由 syncAll 全量重排。
 */
export function materialize(groups: AlarmGroup[], today: string, horizon = HORIZON_DAYS): MaterializedAlarm[] {
  const occ = expandGroups(groups, getHolidayCalendar(), today, horizon);
  const now = Date.now();
  const names = new Map(groups.map((group) => [group.id, group.name]));
  return occ
    .map((o) => {
      const timeLabel = `${pad2(o.hour)}:${pad2(o.minute)}`;
      const groupName = [names.get(o.groupId), o.shiftName].filter(Boolean).join(' · ');
      const title = [groupName, o.label].filter(Boolean).join(' · ');
      const reason = o.reason === 'swap-workday' ? ' · 补班' : '';
      return {
        id: alarmId(o),
        epochMs: occurrenceEpoch(o),
        date: o.date,
        groupId: o.groupId,
        groupName,
        timeId: o.timeId,
        label: o.label,
        timeLabel,
        title: title || '周而复起',
        body: `${cnDate(o.date)} ${timeLabel}${reason}`,
      };
    })
    .filter((a) => a.epochMs > now);
}
