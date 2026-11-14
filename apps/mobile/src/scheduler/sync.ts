import { gateway } from '../gateway';
import { materialize, todayISO, HORIZON_DAYS } from './materialize';
import { registry } from './registry';
import { useGroups } from '../stores/groups';

/**
 * 统一重排入口。触发点:规则变更 / 闹钟触发 / 关闭响铃 /
 * BOOT_COMPLETED / TIME_SET / TIMEZONE_CHANGED / App 回前台 / 每日 03:30。
 */
export async function syncAll(): Promise<void> {
  const groups = useGroups.getState().groups;
  const desired = materialize(groups, todayISO(), HORIZON_DAYS);
  const current = registry.get();
  const desiredIds = new Set(desired.map((a) => a.id));

  const toAdd = desired.filter((a) => !current[a.id] || current[a.id].epochMs !== a.epochMs);
  const toCancel = Object.keys(current).filter((id) => !desiredIds.has(id));

  if (toCancel.length) await gateway.cancel(toCancel);
  if (toAdd.length) await gateway.schedule(toAdd);

  const map = { ...current };
  for (const id of toCancel) delete map[id];
  for (const a of toAdd) map[a.id] = { epochMs: a.epochMs, title: a.title };
  registry.set(map);
}

/** 贪睡:注册一枚一次性闹钟,并进注册表(下次 syncAll 若仍在视野内会保留) */
export async function snooze(minutes: number, title: string): Promise<void> {
  const epochMs = Date.now() + minutes * 60e3;
  const alarm = {
    id: `snooze:${epochMs}`,
    epochMs,
    groupId: 'snooze',
    timeId: 'snooze',
    timeLabel: '',
    title,
    body: '贪睡重排 · 周而复起',
  };
  await gateway.schedule([alarm]);
  const map = registry.get();
  map[alarm.id] = { epochMs, title: alarm.title };
  registry.set(map);
}

/** 设置页「试响」:注册一枚 90 秒后的一次性闹钟,用于真机/模拟器验证触发链 */
export async function scheduleTestRing(): Promise<void> {
  const epochMs = Date.now() + 90e3;
  const alarm = {
    id: `test:${epochMs}`,
    epochMs,
    groupId: 'test',
    timeId: 'test',
    timeLabel: '',
    title: '⏰ 试响 · 周而复起',
    body: '90 秒后触发,验证精确闹钟与全屏意图',
  };
  await gateway.schedule([alarm]);
  const map = registry.get();
  map[alarm.id] = { epochMs, title: alarm.title };
  registry.set(map);
}
