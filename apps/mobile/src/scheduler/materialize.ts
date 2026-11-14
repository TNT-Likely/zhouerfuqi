import { expandGroups, type AlarmGroup } from '@core';
import { getHolidayCalendar } from '../services/holidays';
import type { MaterializedAlarm } from '../gateway/types';

/** 视野:原生层只注册未来 N 天的具体响铃(架构 §4.1) */
export const HORIZON_DAYS = 14;

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 规则 → 未来 N 天的具体响铃事件(引擎唯一事实源的物化投影)。
 * epoch 按本地时区换算;时区变更后由 syncAll 全量重排。
 */
export function materialize(groups: AlarmGroup[], today: string, horizon = HORIZON_DAYS): MaterializedAlarm[] {
  const occ = expandGroups(
    groups.filter((g) => g.enabled),
    getHolidayCalendar(),
    today,
    horizon,
  );
  const now = Date.now();
  return occ
    .map((o) => {
      const epochMs = new Date(`${o.date}T00:00:00`).getTime() + o.hour * 3600e3 + o.minute * 60e3;
      const label = o.label ? ` · ${o.label}` : '';
      const reason = o.reason === 'swap-workday' ? '(补班)' : '';
      return {
        id: `${o.groupId}:${o.timeId}:${o.date}`,
        epochMs,
        groupId: o.groupId,
        timeId: o.timeId,
        timeLabel: `${pad(o.hour)}:${pad(o.minute)}`,
        title: `⏰ ${pad(o.hour)}:${pad(o.minute)}${label}`,
        body: `${cnDate(o.date)}${reason} · 周而复起`,
      };
    })
    .filter((a) => a.epochMs > now);
}

function cnDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${parseInt(m!, 10)}月${parseInt(d!, 10)}日`;
}
