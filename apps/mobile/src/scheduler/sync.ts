import { gateway } from '../gateway';
import { materialize, todayISO, HORIZON_DAYS } from './materialize';
import { registry } from './registry';
import { useGroups } from '../stores/groups';

let queue = Promise.resolve();

function enqueue(operation: () => Promise<void>): Promise<void> {
  const next = queue.then(operation);
  queue = next.catch(() => {});
  return next;
}

/**
 * 统一重排入口。触发点:规则变更 / 闹钟触发 / 关闭响铃 /
 * BOOT_COMPLETED / TIME_SET / TIMEZONE_CHANGED / App 回前台 / 每日 03:30。
 *
 * ⚠️ 强制全量重排:App 更新/重装会清空系统闹钟,而注册表(mmkv)无感——
 * 若按 diff 增量,「registry 说有、系统里没有」的洞永远填不上。
 * 原生 setAlarmClock 用 FLAG_UPDATE_CURRENT + 确定性 requestCode,
 * 同 id 同时刻原地更新(无重复),所以全量重排是幂等且便宜的。
 */
export function syncAll(): Promise<void> {
  return enqueue(syncSchedule);
}

async function syncSchedule(): Promise<void> {
  const groups = useGroups.getState().groups;
  const desired = materialize(groups, todayISO(), HORIZON_DAYS);
  const current = registry.get();

  // 全量重排:desired 原地更新(幂等),registry 里多余的取消
  if (desired.length) await gateway.schedule(desired);
  const desiredIds = new Set(desired.map((a) => a.id));
  const map: Record<string, { epochMs: number; title: string }> = {};
  for (const a of desired) map[a.id] = { epochMs: a.epochMs, title: a.title };
  const now = Date.now();
  const toCancel = [];
  for (const [id, alarm] of Object.entries(current)) {
    if (desiredIds.has(id)) continue;
    if (/^(snooze|test):\d+$/.test(id) && alarm.epochMs > now) {
      map[id] = alarm;
    } else {
      toCancel.push(id);
    }
  }
  if (toCancel.length) await gateway.cancel(toCancel);
  registry.set(map);
}

/** 注册一次性贪睡闹钟，定时到期前由重排保留。 */
export function snooze(minutes: number, title: string): Promise<void> {
  return enqueue(() => scheduleOneShot('snooze', minutes * 60_000, title, '贪睡重排 · 周而复起'));
}

/** 设置页「试响」:注册一枚 30 秒后的一次性闹钟,用于真机/模拟器验证触发链 */
export function scheduleTestRing(): Promise<void> {
  return enqueue(() => scheduleOneShot('test', 30_000, '试响 · 周而复起', '锁屏试响'));
}

async function scheduleOneShot(kind: 'snooze' | 'test', delay: number, title: string, body: string): Promise<void> {
  const epochMs = Date.now() + delay;
  const clock = new Date(epochMs);
  const timeLabel = [clock.getHours(), clock.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
  const alarm = {
    id: `${kind}:${epochMs}`,
    epochMs,
    groupId: kind,
    timeId: kind,
    timeLabel,
    title,
    body,
  };
  await gateway.schedule([alarm]);
  const map = registry.get();
  map[alarm.id] = { epochMs: alarm.epochMs, title: alarm.title };
  registry.set(map);
}
