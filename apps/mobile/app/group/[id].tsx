import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Switch, Alert, Modal, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { AlarmGroup, Weekday } from '@core';
import { useGroups } from '@/stores/groups';
import { syncAll } from '@/scheduler/sync';
import { todayISO } from '@/scheduler/materialize';
import { cnDate, WD } from '@/lib/labels';
import { useTheme, type Tokens } from '@/theme';
import { TimeGridPicker } from '@/components/TimeWheel';
import { checkNotificationPermission, requestNotificationPermission } from '@/services/permissions';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useGroups((s) => s.groups.find((g) => g.id === id));
  const upsert = useGroups((s) => s.upsert);
  const remove = useGroups((s) => s.remove);

  const [draft, setDraft] = useState<AlarmGroup>(() => (isNew || !existing ? newGroup() : JSON.parse(JSON.stringify(existing)) as AlarmGroup));
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

  const save = () => {
    if (!draft.times.length) {
      Alert.alert('至少保留一个响铃时间');
      return;
    }
    // 主动权限机制:保存启用中的班组前,缺通知权限就先拉系统弹窗(而不是让用户去设置里找)
    if (draft.enabled) {
      void checkNotificationPermission().then((ok) => {
        if (ok === false) {
          void requestNotificationPermission().finally(() => {
            upsert(draft);
            void syncAll();
            router.back();
          });
          return;
        }
        upsert(draft);
        void syncAll();
        router.back();
      });
      return;
    }
    upsert(draft);
    void syncAll();
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()}><Text style={{ color: t.text2, fontSize: 18 }}>‹</Text></Pressable>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{isNew ? '新建班组' : '编辑班组'}</Text>
        <Pressable onPress={save} style={{ marginLeft: 'auto' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 14 }}>保存</Text>
        </Pressable>
      </View>

      <TextInput
        value={draft.name}
        onChangeText={(v) => patch({ name: v })}
        style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.text }]}
        placeholder="班组名称,如「上班」"
        placeholderTextColor={t.text3}
      />

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

      {/* 时间列表 */}
      <FieldCard t={t} title={`响铃时间(${draft.times.length} 条)`}>
        {draft.times.map((tm) => (
          <View key={tm.id} style={[styles.timeRow, { backgroundColor: t.surface2, borderColor: t.line }]}>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>
              {String(tm.hour).padStart(2, '0')}:{String(tm.minute).padStart(2, '0')}
              {tm.label ? <Text style={{ fontSize: 11, color: t.text3, fontWeight: '500' }}> {tm.label}</Text> : null}
            </Text>
            <Pressable onPress={() => setDraft((d) => ({ ...d, times: d.times.filter((x) => x.id !== tm.id) }))}>
              <Text style={{ color: t.red, fontSize: 14 }}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {PRESETS.map((p) => {
            const key = `t${p.hour}${String(p.minute).padStart(2, '0')}`;
            const exists = draft.times.some((x) => x.id === key);
            return (
              <Chip key={key} t={t} on={exists} onPress={() => {
                if (exists || draft.rule.kind === undefined) {
                  setDraft((d) => ({ ...d, times: d.times.filter((x) => x.id !== key) }));
                  return;
                }
                setDraft((d) => ({ ...d, times: [...d.times, { id: key, hour: p.hour, minute: p.minute, label: p.label || undefined }] }));
              }}>
                {String(p.hour).padStart(2, '0')}:{String(p.minute).padStart(2, '0')}
              </Chip>
            );
          })}
        </View>
        <CustomTimeAdder t={t} draft={draft} setDraft={setDraft} />
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

      <Pressable onPress={save} style={[styles.primaryBtn, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontWeight: '800', letterSpacing: 2 }}>保 存</Text>
      </Pressable>
      {!isNew ? (
        <Pressable
          onPress={() => {
            Alert.alert('删除班组', `确定删除「${draft.name}」?`, [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => { remove(draft.id); void syncAll(); router.back(); } },
            ]);
          }}
          style={{ alignItems: 'center', padding: 12 }}
        >
          <Text style={{ color: t.red, fontSize: 13 }}>删除该班组</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function switchRule(rule: AlarmGroup['rule'], kind: string): AlarmGroup['rule'] {
  if (kind === 'weekly') return { kind: 'weekly', weekdays: rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? rule.weekdays : [1, 2, 3, 4, 5] };
  if (kind === 'everyNWeeks') return { kind: 'everyNWeeks', n: 2, weekdays: rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? rule.weekdays : [1, 2, 3, 4, 5, 6], anchor: nextSaturdays(1)[0]! };
  if (kind === 'everyNDays') return { kind: 'everyNDays', n: 3, anchor: nextSaturdays(1)[0]! };
  return { kind: 'customDates', dates: [nextSaturdays(1)[0]!] };
}

/** 自定义时间:滚轮选择任意时:分 + 标签,与快捷项并存 */
function CustomTimeAdder({
  t,
  draft,
  setDraft,
}: {
  t: Tokens;
  draft: AlarmGroup;
  setDraft: (fn: (d: AlarmGroup) => AlarmGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState({ hour: 7, minute: 0, label: '' });

  const add = () => {
    const { hour, minute, label } = pending;
    const key = `t${hour}${String(minute).padStart(2, '0')}`;
    setDraft((d) => {
      if (d.times.some((x) => x.hour === hour && x.minute === minute)) return d;
      return { ...d, times: [...d.times, { id: key, hour, minute, label: label || undefined }] };
    });
    setOpen(false);
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.customBtn, { borderColor: t.primary }]}
      >
        <Text style={{ color: t.primary, fontSize: 13, fontWeight: '700' }}>＋ 自定义时间</Text>
        <Text style={{ color: t.text3, fontSize: 11 }}>弹窗选择任意时刻</Text>
      </Pressable>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={styles.modalHead}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>自定义响铃时间</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={{ color: t.text3, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
          <TimeGridPicker
            t={t}
            hour={pending.hour}
            minute={pending.minute}
            label={pending.label}
            onChange={setPending}
            onSubmit={add}
            submitLabel="加入并关闭"
          />
        </View>
      </View>
    </Modal>
  );
}

function Centered({ children, t }: { children: React.ReactNode; t: Tokens }) {
  return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

function FieldCard({ t, title, children }: { t: Tokens; title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text style={{ color: t.text3, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ t, on, onPress, children }: { t: Tokens; on?: boolean; onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? 'rgba(255,122,69,0.14)' : t.surface2, borderColor: on ? t.primary : t.line }]}
    >
      <Text style={{ fontSize: 12, color: on ? t.primary : t.text2, fontWeight: on ? '700' : '400' }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 52 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15 },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  wd: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  customBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 12, marginTop: 14,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 22, padding: 16, maxHeight: '88%' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  primaryBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
});
