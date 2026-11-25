import { useMemo } from 'react';
import { Platform } from 'react-native';
import { diffDays, nextUpcomingOccurrences, occurrenceEpoch, type Occurrence } from '@core';
import { useClock } from '../lib/clock';
import { getLocale } from '../i18n';
import { systemMessages } from '../i18n/system';
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
  const copy = systemMessages[getLocale()];
  if (!item) return { title: copy.noneScheduled, tone: 'muted' } as const;
  if (state.syncing) return { title: copy.syncing, tone: 'muted' } as const;
  if (state.error) return { title: copy.syncFailed, tone: 'warning' } as const;
  const permissions = state.permissions;
  const ready = permissions && (Platform.OS === 'android'
    ? permissions.notifications && permissions.exactAlarms
    : permissions.exactAlarms || permissions.notifications);
  if (ready === false) {
    return { title: copy.alarmPermissionMissing, tone: 'warning' } as const;
  }
  const entry = state.entries[alarmId(item)];
  if (entry && entry.epochMs === occurrenceEpoch(item)) {
    if (entry.delivery === 'system') return { title: copy.systemAlarmScheduled, tone: 'success' } as const;
    if (entry.delivery === 'notification') return { title: copy.notificationScheduled, tone: 'accent' } as const;
  }
  if (diffDays(item.date, todayISO(new Date(now))) >= HORIZON_DAYS) return { title: copy.beyondRegistrationWindow, tone: 'muted' } as const;
  return { title: copy.awaitingRegistration, tone: 'muted' } as const;
}
