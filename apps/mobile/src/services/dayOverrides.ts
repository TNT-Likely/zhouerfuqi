import { type AlarmGroup, type DayOverride, type Occurrence, occurrenceEpoch } from '@core';
import { useGroups } from '../stores/groups';
import { syncAll } from '../scheduler/sync';
import { getLocale } from '../i18n';
import { systemMessages } from '../i18n/system';

function setOverride(group: AlarmGroup, date: string, value: DayOverride | undefined): void {
  const overrides = { ...group.overrides };
  if (value) overrides[date] = value;
  else delete overrides[date];
  useGroups.getState().upsert({ ...group, overrides });
}

export function changeDay(
  groupId: string, date: string, change: (previous: DayOverride | undefined) => DayOverride | undefined,
): () => boolean {
  const group = useGroups.getState().groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(systemMessages[getLocale()].missingGroup);
  const previous = group.overrides?.[date];
  const next = change(previous);
  setOverride(group, date, next);
  void syncAll().catch(() => {});
  return () => {
    const latest = useGroups.getState().groups.find((candidate) => candidate.id === groupId);
    if (!latest || latest.overrides?.[date] !== next) return false;
    setOverride(latest, date, previous);
    void syncAll().catch(() => {});
    return true;
  };
}

export function skipOccurrence(item: Occurrence): () => boolean {
  if (occurrenceEpoch(item) <= Date.now()) throw new Error(systemMessages[getLocale()].occurrencePassed);
  return changeDay(item.groupId, item.date, (previous) => ({
    ...previous,
    skippedTimeIds: [...new Set([...(previous?.skippedTimeIds ?? []), item.timeId])],
  }));
}
