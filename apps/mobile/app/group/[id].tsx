import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { View, Text, Pressable, TextInput, Switch, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { AlarmGroup, AlarmTime, Weekday } from '@core';
import { useGroups } from '@/stores/groups';
import { syncAll } from '@/scheduler/sync';
import { todayISO } from '@/scheduler/materialize';
import { cnDate, WD } from '@/lib/labels';
import { useTheme, type Tokens } from '@/theme';
import { TimeGridPicker, type DraftTime } from '@/components/TimeWheel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { checkNotificationPermission, requestNotificationPermission } from '@/services/permissions';

import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { PanelButton, PanelList, PanelRow } from '@/components/Panel';
import { useFeedback } from '@/components/Feedback';

const KINDS = [
  { k: 'weekly', label: '每周几' },
  { k: 'everyNWeeks', label: '每 N 周' },
  { k: 'everyNDays', label: '每 N 天' },
  { k: 'customDates', label: '月历' },
] as const;

const PRESETS = [
  { hour: 6, minute: 40, label: '第一道' },
  { hour: 6, minute: 50, label: '第二道' },
  { hour: 7, minute: 0, label: '底线' },
  { hour: 7, minute: 30, label: '' },
  { hour: 8, minute: 0, label: '' },
  { hour: 12, minute: 55, label: '午休' },
];

function nextSaturdays(count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${todayISO()}T00:00:00`);
  while (out.length < count) {
    if (d.getDay() === 6) out.push(fmt(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function newGroup(): AlarmGroup {
  return {
    id: `g${Date.now()}`,
    name: '新班组',
    enabled: true,
    holidayMode: 'china-smart',
    times: [{ id: 't1', hour: 7, minute: 0 }],
    rule: { kind: 'everyNWeeks', n: 2, weekdays: [1, 2, 3, 4, 5], anchor: nextSaturdays(1)[0]! },
  };
}

export default function GroupEditScreen() {
  const t = useTheme();
  const notify = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useGroups((s) => s.groups.find((g) => g.id === id));
  const upsert = useGroups((s) => s.upsert);
  const remove = useGroups((s) => s.remove);

  const [draft, setDraft] = useState<AlarmGroup>(() => (isNew || !existing ? newGroup() : JSON.parse(JSON.stringify(existing)) as AlarmGroup));
  const [nameError, setNameError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [failure, setFailure] = useState<string>();
  const saving = useRef(false);
  const nameField = useRef<ComponentRef<typeof TextInput>>(null);
  const saturdays = useMemo(() => nextSaturdays(4), []);
  const patch = (p: Partial<AlarmGroup>) => setDraft((d) => ({ ...d, ...p }));

  if (!isNew && !existing) {
    return (
      <Centered t={t}>
        <Text style={{ color: t.text2 }}>该班组已被删除</Text>
        <Pressable onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: t.primary, marginTop: 16 }]}>
          <Text style={{ color: t.onPrimary, fontWeight: '800' }}>返回</Text>
        </Pressable>
      </Centered>
    );
  }

  const save = async () => {
    if (saving.current) return;
    const name = draft.name.trim();
    if (!name) {
      setNameError(true);
      nameField.current?.focus();
      return;
    }
    if (!draft.times.length) {
      setTimeError(true);
      return;
    }
    saving.current = true;
    try {
      if (draft.enabled && await checkNotificationPermission() === false) await requestNotificationPermission();
      upsert({ ...draft, name });
      router.back();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      saving.current = false;
    }
  };

  const removeTime = (id: string) => {
    if (draft.times.length <= 1) {
      setTimeError(true);
      return;
    }
    setTimeError(false);
    setDraft((current) => current.times.length > 1
      ? { ...current, times: current.times.filter((time) => time.id !== id) } : current);
  };

  const addTime = ({ hour, minute, label }: DraftTime) => {
    setTimeError(false);
    setDraft((current) => {
      if (current.times.some((time) => time.hour === hour && time.minute === minute)) return current;
      const key = `t${hour}${String(minute).padStart(2, '0')}`;
      const id = current.times.some((time) => time.id === key) ? `${key}-${Date.now()}` : key;
      const times = [...current.times, { id, hour, minute, label: label.trim() || undefined }];
      times.sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
      return { ...current, times };
    });
  };

  const deleteGroup = () => {
    try {
      remove(draft.id);
      setDeleteOpen(false);
      router.back();
      void syncAll().then(
        () => notify('班组已删除', '此班组的后续响铃已取消。'),
        () => notify('班组已删除', '响铃同步失败，可在设置中重新同步。', 'warning', 'alert-circle-outline'),
      );
    } catch (error) {
      setDeleteOpen(false);
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.nav}>
        <PanelButton label="返回" variant="text" icon="chevron-back" onPress={() => router.back()} />
        <Text style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '800' }}>{isNew ? '新建班组' : '编辑班组'}</Text>
        <PanelButton label="保存" variant="primary" onPress={() => void save()} />
      </View>
      <FieldCard t={t} title="班组名称">
        <TextInput
          ref={nameField}
          accessibilityLabel="班组名称"
          value={draft.name}
          onChangeText={(name) => {
            patch({ name });
            if (name.trim()) setNameError(false);
          }}
          style={[styles.input, { backgroundColor: t.panel.raised, borderColor: nameError ? t.panel.danger : t.panel.border, color: t.text }]}
          placeholder="例如早班"
          placeholderTextColor={t.panel.muted}
        />
        {nameError ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>请输入班组名称。</Text> : null}
      </FieldCard>

      {/* 规则类型 */}
      <View style={[styles.seg, { backgroundColor: t.surface, borderColor: t.line }]}>
        {KINDS.map((k) => (
          <Pressable
            key={k.k}
            onPress={() => setDraft((d) => ({ ...d, rule: switchRule(d.rule, k.k) }))}
            style={[styles.segItem, draft.rule.kind === k.k ? { backgroundColor: t.primary } : null]}
          >
            <Text style={{ fontSize: 11.5, color: draft.rule.kind === k.k ? t.onPrimary : t.text3, fontWeight: draft.rule.kind === k.k ? '800' : '400' }}>
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 星期选择(weekly / everyNWeeks) */}
      {draft.rule.kind === 'weekly' || draft.rule.kind === 'everyNWeeks' ? (
        <View style={styles.weekRow}>
          {WD.map((w, i) => {
            const on = draft.rule.kind === 'weekly' || draft.rule.kind === 'everyNWeeks' ? draft.rule.weekdays.includes((i + 1) as Weekday) : false;
            return (
              <Pressable
                key={w}
                onPress={() =>
                  setDraft((d) => {
                    const r = d.rule;
                    if (r.kind !== 'weekly' && r.kind !== 'everyNWeeks') return d;
                    const set = new Set(r.weekdays);
                    if (set.has((i + 1) as Weekday)) set.delete((i + 1) as Weekday);
                    else set.add((i + 1) as Weekday);
                    return { ...d, rule: { ...r, weekdays: [...set].sort() } };
                  })
                }
                style={[styles.wd, { backgroundColor: on ? t.primary : t.surface, borderColor: on ? t.primary : t.line }]}
              >
                <Text style={{ fontSize: 12, color: on ? t.onPrimary : t.text2, fontWeight: on ? '800' : '400' }}>{w}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* 每 N 周:N stepper + 锚点 */}
      {draft.rule.kind === 'everyNWeeks' ? (
        <>
          <FieldCard t={t} title="周期 N(n=2 即大小周)">
            <View style={styles.stepper}>
              <Pressable style={[styles.stepBtn, { backgroundColor: t.surface2, borderColor: t.line }]} onPress={() => setDraft((d) => (d.rule.kind === 'everyNWeeks' ? { ...d, rule: { ...d.rule, n: Math.max(1, d.rule.n - 1) } } : d))}>
                <Text style={{ color: t.text2, fontSize: 16 }}>−</Text>
              </Pressable>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', minWidth: 56, textAlign: 'center' }}>{draft.rule.n} 周</Text>
              <Pressable style={[styles.stepBtn, { backgroundColor: t.surface2, borderColor: t.line }]} onPress={() => setDraft((d) => (d.rule.kind === 'everyNWeeks' ? { ...d, rule: { ...d.rule, n: Math.min(4, d.rule.n + 1) } } : d))}>
                <Text style={{ color: t.text2, fontSize: 16 }}>+</Text>
              </Pressable>
              <Text style={{ color: t.text3, fontSize: 12 }}>1=单休 · 2=大小周</Text>
            </View>
          </FieldCard>
          <FieldCard t={t} title="锚点 · 最近一个大周(选中)日">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {saturdays.map((s) => (
                <Chip key={s} t={t} on={draft.rule.kind === 'everyNWeeks' && draft.rule.anchor === s} onPress={() => setDraft((d) => (d.rule.kind === 'everyNWeeks' ? { ...d, rule: { ...d.rule, anchor: s } } : d))}>
                  {cnDate(s)} 周{WD[new Date(`${s}T00:00:00`).getDay() === 0 ? 6 : 5]}
                </Chip>
              ))}
            </View>
            <Text style={{ color: t.text3, fontSize: 11, marginTop: 10, lineHeight: 18 }}>
              只问一个问题:「最近的这个周六算大周吗?」选中即完成整条规则。
            </Text>
          </FieldCard>
        </>
      ) : null}

      {/* 每 N 天 */}
      {draft.rule.kind === 'everyNDays' ? (
        <FieldCard t={t} title="每 N 天响一天(上 X 休 Y 最简形态)">
          <View style={styles.stepper}>
            <Pressable style={[styles.stepBtn, { backgroundColor: t.surface2, borderColor: t.line }]} onPress={() => setDraft((d) => (d.rule.kind === 'everyNDays' ? { ...d, rule: { ...d.rule, n: Math.max(2, d.rule.n - 1) } } : d))}>
              <Text style={{ color: t.text2, fontSize: 16 }}>−</Text>
            </Pressable>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', minWidth: 56, textAlign: 'center' }}>{draft.rule.n} 天</Text>
            <Pressable style={[styles.stepBtn, { backgroundColor: t.surface2, borderColor: t.line }]} onPress={() => setDraft((d) => (d.rule.kind === 'everyNDays' ? { ...d, rule: { ...d.rule, n: Math.min(7, d.rule.n + 1) } } : d))}>
              <Text style={{ color: t.text2, fontSize: 16 }}>+</Text>
            </Pressable>
          </View>
        </FieldCard>
      ) : null}

      {/* 月历点选 */}
      {draft.rule.kind === 'customDates' ? (
        <FieldCard t={t} title="手动点选的日期(点选即权威,不受节假日影响)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {saturdays.map((s) => {
              const on = draft.rule.kind === 'customDates' && draft.rule.dates.includes(s);
              return (
                <Chip key={s} t={t} on={on} onPress={() => setDraft((d) => {
                  if (d.rule.kind !== 'customDates') return d;
                  const set = new Set(d.rule.dates);
                  if (set.has(s)) set.delete(s); else set.add(s);
                  return { ...d, rule: { ...d.rule, dates: [...set].sort() } };
                })}>
                  {on ? '✓ ' : ''}{cnDate(s)}
                </Chip>
              );
            })}
          </View>
        </FieldCard>
      ) : null}

      <FieldCard t={t} title={`响铃时间 · ${draft.times.length} 次`}>
        {draft.times.map((time) => {
          const label = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
          return (
            <View key={time.id} style={[styles.timeRow, { backgroundColor: t.panel.raised, borderColor: t.panel.border }]}>
              <Text style={styles.timeText}>
                <Text style={{ color: t.text }}>{label}</Text>
                {time.label ? <Text style={{ fontSize: 12, color: t.panel.muted, fontWeight: '500' }}> {time.label}</Text> : null}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={'移除 ' + label} hitSlop={8}
                onPress={() => removeTime(time.id)}>
                <Text style={{ color: t.panel.danger, fontSize: 13, fontWeight: '700' }}>移除</Text>
              </Pressable>
            </View>
          );
        })}
        <View style={styles.presets}>
          {PRESETS.map((preset) => {
            const label = `${String(preset.hour).padStart(2, '0')}:${String(preset.minute).padStart(2, '0')}`;
            const existingTime = draft.times.find((time) => time.hour === preset.hour && time.minute === preset.minute);
            return (
              <Chip key={label} t={t} on={!!existingTime}
                onPress={() => existingTime ? removeTime(existingTime.id) : addTime(preset)}>{label}</Chip>
            );
          })}
        </View>
        <CustomTimeAdder times={draft.times} onAdd={addTime} />
        {timeError ? (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>
            至少保留一个响铃时间。加入新时间后即可移除这条。
          </Text>
        ) : null}
      </FieldCard>

      {/* 节假日联动 */}
      <FieldCard t={t} title="节假日叠加">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>节假日联动</Text>
            <Text style={{ color: t.text3, fontSize: 11, marginTop: 3 }}>法定假日跳过 · 调休补班日自动响</Text>
          </View>
          <Switch
            value={draft.holidayMode !== 'raw'}
            onValueChange={(on) => patch({ holidayMode: on ? 'china-smart' : 'raw' })}
            trackColor={{ true: t.primary, false: t.surface2 }}
            thumbColor="#FFFFFF"
          />
        </View>
      </FieldCard>

      <PanelButton label="保存班组" variant="primary" onPress={() => void save()} />
      {!isNew ? (
        <Pressable accessibilityRole="button" onPress={() => setDeleteOpen(true)} style={styles.delete}>
          <Text style={{ color: t.panel.danger, fontSize: 13.5, fontWeight: '700' }}>删除班组</Text>
        </Pressable>
      ) : null}
      {deleteOpen && existing ? (
        <AppDialog title="删除班组？" icon="trash-outline" layout="center" tone="danger" confirm="删除班组" cancel
          onClose={() => setDeleteOpen(false)} onConfirm={deleteGroup}>
          <DialogCopy centered>此班组的排班规则和响铃时间将被删除，已安排的后续响铃也会取消。</DialogCopy>
          <PanelList inset>
            <PanelRow icon="alarm-outline" title={existing.name} detail={`${existing.times.length} 个响铃时间`} tone="danger" />
          </PanelList>
        </AppDialog>
      ) : null}
      {failure ? (
        <AppDialog title="班组修改失败" layout="center" tone="error" icon="alert-circle-outline" onClose={() => setFailure(undefined)}>
          <DialogCopy centered>{failure}</DialogCopy>
        </AppDialog>
      ) : null}
    </SafeAreaScrollView>
  );
}

function switchRule(rule: AlarmGroup['rule'], kind: string): AlarmGroup['rule'] {
  if (kind === 'weekly') return { kind: 'weekly', weekdays: rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? rule.weekdays : [1, 2, 3, 4, 5] };
  if (kind === 'everyNWeeks') return { kind: 'everyNWeeks', n: 2, weekdays: rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? rule.weekdays : [1, 2, 3, 4, 5, 6], anchor: nextSaturdays(1)[0]! };
  if (kind === 'everyNDays') return { kind: 'everyNDays', n: 3, anchor: nextSaturdays(1)[0]! };
  return { kind: 'customDates', dates: [nextSaturdays(1)[0]!] };
}

function CustomTimeAdder({ times, onAdd }: { times: AlarmTime[]; onAdd: (time: DraftTime) => void }) {
  const t = useTheme();
  const [pending, setPending] = useState<DraftTime | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  return (
    <View style={styles.customTime}>
      <PanelButton label="自定义响铃时间" icon="add" onPress={() => {
        setDuplicate(false);
        setPending({ hour: 7, minute: 0, label: '' });
      }} />
      {pending ? (
        <AppDialog title="自定义响铃时间" confirm="加入响铃" cancel onClose={() => setPending(null)}
          onConfirm={() => {
            if (times.some((time) => time.hour === pending.hour && time.minute === pending.minute)) {
              setDuplicate(true);
              return;
            }
            onAdd(pending);
            setPending(null);
          }}>
          <TimeGridPicker value={pending} onChange={(value) => {
            setDuplicate(false);
            setPending(value);
          }} />
          {duplicate ? (
            <Text accessibilityLiveRegion="polite" style={{ color: t.panel.danger }}>这个时间已经在班组里。</Text>
          ) : null}
        </AppDialog>
      ) : null}
    </View>
  );
}

function Centered({ children, t }: { children: React.ReactNode; t: Tokens }) {
  return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

function FieldCard({ t, title, children }: { t: Tokens; title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: t.panel.surface, borderColor: t.panel.border }]}>
      <Text style={{ color: t.panel.muted, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ t, on, onPress, children }: { t: Tokens; on?: boolean; onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? t.accentSoft : t.surface2, borderColor: on ? t.primary : t.line }]}
    >
      <Text style={{ fontSize: 12, color: on ? t.primary : t.text2, fontWeight: on ? '700' : '400' }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15 },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  wd: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  customTime: { marginTop: 12 },
  error: { marginTop: 8, fontSize: 12, lineHeight: 18 },
  delete: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  timeText: { flex: 1, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  primaryBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
});
