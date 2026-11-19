import { gateway } from '../gateway';
import { materialize, todayISO, HORIZON_DAYS } from './materialize';
import { registry } from './registry';
import { useGroups } from '../stores/groups';

/**
 * 统一重排入口。触发点:规则变更 / 闹钟触发 / 关闭响铃 /
 * BOOT_COMPLETED / TIME_SET / TIMEZONE_CHANGED / App 回前台 / 每日 03:30。
 *
 * ⚠️ 强制全量重排:App 更新/重装会清空系统闹钟,而注册表(mmkv)无感——
 * 若按 diff 增量,「registry 说有、系统里没有」的洞永远填不上。
 * 原生 setAlarmClock 用 FLAG_UPDATE_CURRENT + 确定性 requestCode,
 * 同 id 同时刻原地更新(无重复),所以全量重排是幂等且便宜的。
 */
export async function syncAll(): Promise<void> {
  const groups = useGroups.getState().groups;
  const desired = materialize(groups, todayISO(), HORIZON_DAYS);
  const current = registry.get();

  // 全量重排:desired 原地更新(幂等),registry 里多余的取消
  if (desired.length) await gateway.schedule(desired);
  const desiredIds = new Set(desired.map((a) => a.id));
  const toCancel = Object.keys(current).filter((id) => !desiredIds.has(id));
  if (toCancel.length) await gateway.cancel(toCancel);

  const map: Record<string, { epochMs: number; title: string }> = {};
  for (const a of desired) map[a.id] = { epochMs: a.epochMs, title: a.title };
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
  map[alarm.id] = { epochMs: alarm.epochMs, title: alarm.title };
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
  map[alarm.id] = { epochMs: alarm.epochMs, title: alarm.title };
  registry.set(map);
}
