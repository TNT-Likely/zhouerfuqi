import { create } from 'zustand';
import { gateway } from '../gateway';
import type { AlarmDelivery, AlarmPermissionStatus } from '../gateway/types';
import { HORIZON_DAYS, materialize, todayISO } from './materialize';
import { registry, type RegistryEntry } from './registry';
import { useGroups } from '../stores/groups';
import { publishWidgetPlan } from '../services/widgets';
import { setRefresherEnabled } from '../../modules/zf-alarm/src';
import { getLocale } from '../i18n';
import { systemMessages } from '../i18n/system';

type Trial = { id: string; epochMs: number; delivery: AlarmDelivery };
type ScheduleState = {
  syncing: boolean;
  error: string | null;
  syncedAt: number | null;
  entries: Record<string, RegistryEntry>;
  permissions: AlarmPermissionStatus | null;
  trial: Trial | null;
};

function savedTrial(recent = false): Trial | null {
  const cutoff = Date.now() - (recent ? 120_000 : 0);
  const entry = Object.entries(registry.get()).filter(([id, alarm]) => id.startsWith('test:') && alarm.epochMs > cutoff)
    .sort((a, b) => b[1].epochMs - a[1].epochMs)
    .find(([, alarm]) => alarm.delivery === 'system' || alarm.delivery === 'notification');
  if (!entry || !entry[1].delivery) return null;
  return { id: entry[0], epochMs: entry[1].epochMs, delivery: entry[1].delivery };
}

export const useScheduleState = create<ScheduleState>(() => ({
  syncing: false,
  error: null,
  syncedAt: null,
  entries: {},
  permissions: null,
  trial: savedTrial(true),
}));

let queue: Promise<unknown> = Promise.resolve();
let pendingSync: Promise<void> | undefined;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation);
  queue = next.catch(() => {});
  return next;
}

export function syncAll(): Promise<void> {
  if (pendingSync) return pendingSync;
  useScheduleState.setState({ syncing: true });
  pendingSync = enqueue(async () => {
    pendingSync = undefined;
    const groups = useGroups.getState().groups;
    try {
      await syncSchedule(groups);
    } catch (error) {
      useScheduleState.setState({ error: error instanceof Error ? error.message : String(error), entries: {} });
      throw error;
    } finally {
      useScheduleState.setState({ syncing: !!pendingSync });
      publishWidgetPlan(groups);
    }
  });
  return pendingSync;
}

async function syncSchedule(groups: ReturnType<typeof useGroups.getState>['groups']): Promise<void> {
  setRefresherEnabled(groups.some((group) => group.enabled));
  const permissions = await gateway.status();
  useScheduleState.setState({ permissions });
  const desired = materialize(groups, todayISO(), HORIZON_DAYS);
  const current = registry.get();
  const ids = new Set(desired.map((alarm) => alarm.id));
  const now = Date.now();
  const keep = Object.fromEntries(Object.entries(current).filter(([id, alarm]) => (
    !ids.has(id) && /^(snooze|test):\d+$/.test(id) && alarm.epochMs > now
  )));
  const toCancel = Object.keys(current).filter((id) => !ids.has(id) && !(id in keep));
  await gateway.pruneOrphanedAlarms?.();
  if (toCancel.length) await gateway.cancel(toCancel);

  // 先记录将尝试的标识。部分注册成功或进程中途退出时，下次仍能清理相应响铃。
  const entries: Record<string, RegistryEntry> = { ...keep };
  for (const alarm of desired) entries[alarm.id] = { epochMs: alarm.epochMs, title: alarm.title };
  registry.set(entries);

  const delivery = desired.length ? await gateway.schedule(desired) : {};
  for (const alarm of desired) entries[alarm.id]!.delivery = delivery[alarm.id] ?? 'skipped';
  registry.set(entries);
  useScheduleState.setState({ entries, syncedAt: Date.now(), error: null });
}

export function snooze(minutes: number, title: string): Promise<Trial> {
  return enqueue(() => scheduleOneShot('snooze', minutes * 60_000, title, systemMessages[getLocale()].snoozedAlarm));
}

export function scheduleTestRing(): Promise<Trial> {
  return enqueue(async () => {
    const existing = savedTrial();
    if (existing) return existing;
    const copy = systemMessages[getLocale()];
    const trial = await scheduleOneShot('test', 30_000, copy.trialTitle, copy.appName);
    useScheduleState.setState({ trial });
    return trial;
  });
}

export function cancelTestRing(id: string): Promise<void> {
  return enqueue(async () => {
    if (!id.startsWith('test:')) return;
    await gateway.cancel([id]);
    const map = registry.get();
    delete map[id];
    registry.set(map);
    useScheduleState.setState({ trial: savedTrial() });
  });
}

async function scheduleOneShot(kind: 'snooze' | 'test', delay: number, title: string, body: string): Promise<Trial> {
  const epochMs = Date.now() + delay;
  const id = `${kind}:${epochMs}`;
  const clock = new Date(epochMs);
  const timeLabel = [clock.getHours(), clock.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
  const map = registry.get();
  map[id] = { epochMs, title };
  registry.set(map);
  const result = await gateway.schedule([{ id, epochMs, groupId: kind, timeId: kind, timeLabel, title, body }]);
  const delivery = result[id] ?? 'skipped';
  if (delivery === 'skipped') {
    await gateway.cancel([id]);
    delete map[id];
    registry.set(map);
    throw new Error(systemMessages[getLocale()].enableBeforeTrial);
  }
  map[id] = { epochMs, title, delivery };
  registry.set(map);
  return { id, epochMs, delivery };
}
