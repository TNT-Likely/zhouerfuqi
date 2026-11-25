import { expandGroups, localDateISO, occurrenceEpoch, pad2, type AlarmGroup, type Occurrence } from '@core';
import { getHolidayCalendar } from '../services/holidays';
import type { MaterializedAlarm } from '../gateway/types';
import { dateLabel } from '../lib/labels';
import { clockLabel } from '../lib/clock';
import { getLocale } from '../i18n';
import { systemMessages } from '../i18n/system';

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
  const locale = getLocale();
  const copy = systemMessages[locale];
  return occ
    .map((o) => {
      // Android uses the wall clock time to restore saved alarms after timezone changes.
      const timeLabel = `${pad2(o.hour)}:${pad2(o.minute)}`;
      const groupName = [names.get(o.groupId), o.shiftName].filter(Boolean).join(' · ');
      const title = [groupName, o.label].filter(Boolean).join(' · ');
      const reason = o.reason === 'swap-workday' ? ` · ${copy.makeupWorkday}` : '';
      return {
        id: alarmId(o),
        epochMs: occurrenceEpoch(o),
        date: o.date,
        groupId: o.groupId,
        groupName,
        timeId: o.timeId,
        label: o.label,
        timeLabel,
        title: title || copy.appName,
        body: `${dateLabel(o.date, locale)} ${clockLabel(o, locale)}${reason}`,
      };
    })
    .filter((a) => a.epochMs > now);
}
