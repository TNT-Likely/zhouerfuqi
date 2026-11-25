import { useMemo } from 'react';
import { Platform } from 'react-native';
import { diffDays, nextUpcomingOccurrences, occurrenceEpoch, type Occurrence } from '@core';
import { useClock } from '../lib/clock';
import { getHolidayCalendar } from '../services/holidays';
import { useGroups } from '../stores/groups';
import { alarmId, HORIZON_DAYS, todayISO } from './materialize';
import { useScheduleState } from './sync';

export function useFutureSchedule() {
  const groups = useGroups((state) => state.groups);
  const now = useClock();
  const state = useScheduleState();
  const calendar = getHolidayCalendar();
  const upcoming = useMemo(() => nextUpcomingOccurrences(groups, calendar, new Date(now)), [groups, calendar, now]);
  return { groups, now, calendar, upcoming, state };
}

export function scheduleMessage(item: Occurrence | undefined, now: number, state: ReturnType<typeof useScheduleState.getState>) {
  if (!item) return { title: '暂无响铃安排', tone: 'muted' } as const;
  if (state.syncing) return { title: '正在同步响铃', tone: 'muted' } as const;
  if (state.error) return { title: '响铃同步失败', tone: 'warning' } as const;
  const permissions = state.permissions;
  const ready = permissions && (Platform.OS === 'android'
    ? permissions.notifications && permissions.exactAlarms
    : permissions.exactAlarms || permissions.notifications);
  if (ready === false) {
    return { title: '需处理响铃权限', tone: 'warning' } as const;
  }
  const entry = state.entries[alarmId(item)];
  if (entry && entry.epochMs === occurrenceEpoch(item)) {
    if (entry.delivery === 'system') return { title: '已登记系统闹钟', tone: 'success' } as const;
    if (entry.delivery === 'notification') return { title: '将通过通知提醒', tone: 'accent' } as const;
  }
  if (diffDays(item.date, todayISO(new Date(now))) >= HORIZON_DAYS) return { title: '计划已生成 · 待登记', tone: 'muted' } as const;
  return { title: '待登记响铃', tone: 'muted' } as const;
}
