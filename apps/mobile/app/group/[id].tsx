import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addDays, expandGroup, isoWeekday, localDateISO, nextUpcomingOccurrences, type AlarmGroup, type AlarmTime, type RepeatRule, type Weekday } from '@core';
import { AlarmTimeRows } from '@/components/AlarmTimeRows';
import { AppDialog, DialogCopy, DialogSummary } from '@/components/AppDialog';
import { useFeedback } from '@/components/Feedback';
import { DateDialog, firstOfMonth, MonthGrid } from '@/components/MonthGrid';
import { PanelButton, PanelList, PanelRow } from '@/components/Panel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { TimeGridPicker, type DraftTime } from '@/components/TimeWheel';
import { clockLabel } from '@/lib/clock';
import { cnDate, ruleDesc, WD } from '@/lib/labels';
import { cycleRule, makeId, templateGroup } from '@/lib/templates';
import { syncAll, useScheduleState } from '@/scheduler/sync';
import { getHolidayCalendar } from '@/services/holidays';
import { requestAlarmPermissions } from '@/services/permissions';
import { useGroups } from '@/stores/groups';
import { useTheme } from '@/theme';

const RULES = [
  ['weekly', '每周'], ['everyNWeeks', '大小周'], ['everyNDays', '按天间隔'], ['cycle', '轮班循环'], ['customDates', '手动'],
] as const;

const PRESETS = [
  { hour: 6, minute: 40, label: '第一道' },
  { hour: 6, minute: 50, label: '第二道' },
  { hour: 7, minute: 0, label: '底线' },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 55, label: '午休' },
];

type Editing = DraftTime & { id: string; shiftId?: string; creating?: boolean };
const newTime = (shiftId?: string): Editing => ({ id: makeId('t'), hour: 7, minute: 0, label: '', shiftId, creating: true });

export default function GroupEditScreen() {
  const t = useTheme();
  const notify = useFeedback();
  const { id, template, timeId } = useLocalSearchParams<{ id: string; template?: string; timeId?: string }>();
  const isNew = id === 'new';
  const existing = useGroups((s) => s.groups.find((group) => group.id === id));
  const [draft, setDraft] = useState(() => existing ?? templateGroup(template));
  const original = useRef(draft);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'enable' | 'discard' | 'delete' | 'anchor' | 'dates' | 'changes' | null>(null);
  const [pending, setPending] = useState<Editing | null>(() => {
    const shift = existing?.rule.kind === 'cycle' ? existing.rule.shifts.find((item) => item.times.some((time) => time.id === timeId)) : undefined;
    const time = (shift?.times ?? existing?.times)?.find((item) => item.id === timeId);
    return time ? { ...time, label: time.label ?? '', shiftId: shift?.id } : null;
  });
  const [timeError, setTimeError] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>();
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const calendar = getHolidayCalendar();
  const today = localDateISO();
  const rule = draft.rule;
  const cycle = rule.kind === 'cycle' ? rule : undefined;
  const shift = cycle?.shifts.find((item) => item.id === selectedShift) ?? cycle?.shifts[0];
  const times = shift?.times ?? draft.times;
  const previewGroup = useMemo(() => ({ ...draft, enabled: true }), [draft]);
  const preview = useMemo(() => expandGroup(previewGroup, calendar, today, 14), [previewGroup, calendar, today]);
  const previewDates = [...new Set(preview.map((item) => item.date))];
  const first = nextUpcomingOccurrences([previewGroup], calendar, new Date())[0];
  const ruleChanged = JSON.stringify(rule) !== JSON.stringify(original.current.rule) || draft.holidayMode !== original.current.holidayMode;
  const editedDates = useMemo(() => {
    if (!ruleChanged) return [];
    const before = expandGroup({ ...original.current, enabled: true }, calendar, today, 14);
    return Array.from({ length: 14 }, (_, index) => addDays(today, index)).filter((date) => (
      before.filter((item) => item.date === date).map(clockLabel).join(',') !==
      preview.filter((item) => item.date === date).map(clockLabel).join(',')
    ));
  }, [ruleChanged, calendar, today, preview]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original.current);
  const patch = (next: Partial<AlarmGroup>) => {
    setError('');
    setDraft((value) => ({ ...value, ...next }));
  };
  const setRule = (next: RepeatRule) => patch({ rule: next });

  function choose(kind: RepeatRule['kind']) {
    if (kind === rule.kind) return;
    switch (kind) {
      case 'weekly': setRule({ kind, weekdays: [1, 2, 3, 4, 5] }); break;
      case 'everyNWeeks': setRule(templateGroup('alternating').rule); break;
      case 'everyNDays': setRule({ kind, n: 2, anchor: today }); break;
      case 'cycle': patch({ rule: cycleRule('two', today, draft.times), holidayMode: 'raw' }); break;
      case 'customDates': setRule({ kind, dates: [] }); break;
    }
  }

  function updateTimes(next: AlarmTime[], shiftId = shift?.id) {
    if (cycle && shiftId) setRule({ ...cycle, shifts: cycle.shifts.map((item) => item.id === shiftId ? { ...item, times: next } : item) });
    else patch({ times: next });
  }

  function confirmTime() {
    if (!pending) return;
    const list = (cycle?.shifts.find((item) => item.id === pending.shiftId)?.times ?? draft.times)
      .filter((time) => time.id !== pending.id);
    if (list.some((time) => time.hour === pending.hour && time.minute === pending.minute)) {
      setTimeError('这个时间已经在当前班次里。');
      return;
    }
    const { id, hour, minute, label } = pending;
    updateTimes([...list, { id, hour, minute, label: label.trim() || undefined }]
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)), pending.shiftId);
    setPending(null);
    setTimeError('');
  }

  function validate() {
    if (!draft.name.trim()) return '请输入班组名称。';
    if (!draft.times.length && !cycle) return '请至少添加一个响铃时间。';
    if ((rule.kind === 'weekly' || rule.kind === 'everyNWeeks') && !rule.weekdays.length) return '请选择响铃的星期。';
    if (isNew && rule.kind === 'customDates' && !rule.dates.length) return '请先在月历选择响铃日期。';
    if (cycle && (!cycle.days.some(Boolean) || cycle.shifts.some((item) => cycle.days.includes(item.id) && (!item.name.trim() || !item.times.length)))) {
      return '循环至少需要一个班次，使用中的班次要有名称和响铃时间。';
    }
    return '';
  }

  async function save(confirmed = false) {
    if (saving.current) return;
    const problem = validate();
    if (problem) { setError(problem); return; }
    if (!confirmed && (isNew || ruleChanged)) {
      setDialog(isNew ? 'enable' : 'changes');
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      if (isNew) await requestAlarmPermissions();
      useGroups.getState().upsert({ ...draft, name: draft.name.trim() });
      setDialog(null);
      router.back();
      try {
        await syncAll();
        const next = useScheduleState.getState();
        const firstEntry = Object.entries(next.entries).filter(([key]) => key.startsWith(draft.id + ":")).some(([, item]) => item.delivery === 'system' || item.delivery === 'notification');
        notify('班组已保存', firstEntry ? '已同步响铃计划。' : '可在设置查看响铃登记状态。');
      } catch {
        notify('班组已保存', '响铃同步失败，可在设置中重试。', 'warning', 'alert-circle-outline');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存班组失败。');
      setDialog(null);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function deleteGroup() {
    useGroups.getState().remove(draft.id);
    setDialog(null);
    router.back();
    void syncAll().then(
      () => notify('班组已删除', draft.name),
      () => notify('班组已删除', '响铃同步失败，可在设置中重试。', 'warning'),
    );
  }

  if (!isNew && !existing) {
    return <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.screen}>
      <Text style={{ color: t.text }}>该班组已删除。</Text>
      <PanelButton label="返回" onPress={() => router.back()} />
    </SafeAreaScrollView>;
  }

  return (
    <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.nav}>
        <PanelButton label="返回" variant="text" icon="chevron-back" onPress={() => dirty ? setDialog('discard') : router.back()} />
        <Text accessibilityRole="header" style={[styles.heading, { color: t.text }]}>{isNew ? '新建班组' : '编辑班组'}</Text>
        <PanelButton label={isNew ? '核对班组' : '保存'} variant="primary" disabled={busy} onPress={() => void save()} />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>{error}</Text> : null}
      <Card title="班组名称">
        <TextInput accessibilityLabel="班组名称" value={draft.name} maxLength={36}
          onChangeText={(name) => patch({ name })} style={[styles.input, { backgroundColor: t.panel.raised, borderColor: t.panel.border, color: t.text }]} />
      </Card>
      <Card title="排班规则">
        <View style={styles.wrap}>
          {RULES.map(([kind, label]) => <Choice key={kind} selected={kind === rule.kind} label={label} onPress={() => choose(kind)} />)}
        </View>
        {rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? (
          <View style={styles.wrap}>
            {WD.map((label, index) => {
              const day = (index + 1) as Weekday;
              const enabled = rule.weekdays.includes(day);
              return <Choice key={day} label={'周' + label} selected={enabled} onPress={() => setRule({
                ...rule, weekdays: enabled ? rule.weekdays.filter((item) => item !== day) : [...rule.weekdays, day].sort(),
              })} />;
            })}
          </View>
        ) : null}
        {rule.kind === 'everyNWeeks' || rule.kind === 'everyNDays' ? (
          <View style={styles.adjustment}>
            <PanelButton label="−" variant="secondary" disabled={rule.n <= 2} onPress={() => setRule({ ...rule, n: rule.n - 1 })} />
            <Text style={{ color: t.text, fontWeight: '800' }}>每 {rule.n} {rule.kind === 'everyNWeeks' ? '周' : '天'}</Text>
            <PanelButton label="+" variant="secondary" disabled={rule.n >= 30} onPress={() => setRule({ ...rule, n: rule.n + 1 })} />
          </View>
        ) : null}
        {'anchor' in rule ? (
          <PanelButton label={(rule.kind === 'everyNWeeks' ? '循环周起点 · ' : '循环起始日 · ') + cnDate(rule.anchor)}
            icon="calendar-outline" onPress={() => setDialog('anchor')} />
        ) : null}
        {rule.kind === 'everyNWeeks' ? (
          <Text style={{ color: t.panel.muted, fontSize: 13 }}>
            周{WD[isoWeekday(rule.anchor) - 1]}隔 {rule.n} 周响一次，其他选中的星期每周响。
          </Text>
        ) : null}
        {cycle ? (
          <>
            <View style={styles.wrap}>
              <PanelButton label="上二休二" onPress={() => setRule(cycleRule('two', cycle.anchor, draft.times))} />
              <PanelButton label="早早晚晚休休" onPress={() => setRule(cycleRule('shifts', cycle.anchor, draft.times))} />
            </View>
            <View style={styles.wrap}>
              {cycle.days.map((item, index) => (
                <Choice key={index} selected={!!item}
                  label={'第 ' + (index + 1) + ' 天 · ' + (cycle.shifts.find((entry) => entry.id === item)?.name || '休息')}
                  onPress={() => setCycleDay(index)} />
              ))}
              {cycle.days.length < 42 ? <PanelButton label="加一天" icon="add" variant="text"
                onPress={() => setRule({ ...cycle, days: [...cycle.days, null] })} /> : null}
            </View>
          </>
        ) : null}
        {rule.kind === 'customDates' ? (
          <PanelButton label={'选择日期 · 已选 ' + rule.dates.length + ' 天'} icon="calendar-outline" onPress={() => setDialog('dates')} />
        ) : null}
      </Card>
      <Card title={shift ? '班次和响铃时间' : '响铃时间'}>
        {cycle && shift ? (
          <>
            <View style={styles.wrap}>
              {cycle.shifts.map((item) => <Choice key={item.id} label={item.name || '未命名班次'}
                selected={item.id === shift.id} onPress={() => setSelectedShift(item.id)} />)}
              {cycle.shifts.length < 12 ? <PanelButton label="加班次" icon="add" variant="text" onPress={() => {
                const id = makeId('s');
                setRule({ ...cycle, shifts: [...cycle.shifts, { id, name: '班次 ' + (cycle.shifts.length + 1), times: [{ id: makeId('t'), hour: 7, minute: 0 }] }] });
                setSelectedShift(id);
              }} /> : null}
            </View>
            <TextInput accessibilityLabel="班次名称" value={shift.name} maxLength={24} onChangeText={(name) => {
              setRule({ ...cycle, shifts: cycle.shifts.map((item) => item.id === shift.id ? { ...item, name } : item) });
            }} style={[styles.input, { backgroundColor: t.panel.raised, borderColor: t.panel.border, color: t.text }]} />
          </>
        ) : null}
        <View style={styles.wrap}>
          {PRESETS.map((preset) => {
            const used = times.some((time) => time.hour === preset.hour && time.minute === preset.minute);
            return <Choice key={clockLabel(preset)} label={clockLabel(preset)} selected={used} disabled={used}
              onPress={() => updateTimes([...times, { ...preset, id: makeId('t') }].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)))} />;
          })}
        </View>
        <AlarmTimeRows times={times} onAdd={() => setPending(newTime(shift?.id))}
          onEdit={(time) => setPending({ ...time, label: time.label ?? '', shiftId: shift?.id })}
          onRemove={(id) => {
            if (times.length <= 1) { setError('请至少保留一个响铃时间。'); return; }
            updateTimes(times.filter((item) => item.id !== id));
          }} />
      </Card>
      {rule.kind !== 'customDates' ? (
        <Card title="节假日">
          <View style={styles.nav}>
            <View style={styles.flex}>
              <Text style={[styles.text, { color: t.text }]}>节假日联动</Text>
              <Text style={{ color: t.panel.muted, fontSize: 13 }}>{cycle ? '法定假日跳过，轮班休息日按循环。' : '法定假日跳过，调休补班日自动响铃。'}</Text>
            </View>
            <Switch accessibilityLabel="节假日联动" value={draft.holidayMode !== 'raw'}
              onValueChange={(on) => patch({ holidayMode: on ? 'china-smart' : 'raw' })} />
          </View>
        </Card>
      ) : null}
      <Card title="未来两周预览">
        <Text style={{ color: t.panel.muted, lineHeight: 19 }}>{ruleDesc(draft)}</Text>
        {first ? <Text style={[styles.text, { color: t.text }]}>首响 · {cnDate(first.date)} {clockLabel(first)}</Text>
          : <Text style={{ color: t.panel.muted }}>暂无未来响铃。</Text>}
        {previewDates.slice(0, 14).map((date) => {
          const items = preview.filter((item) => item.date === date);
          return <View key={date} style={styles.previewRow}>
            <Text style={{ color: t.panel.muted }}>{cnDate(date)}</Text>
            <Text style={[styles.flex, { color: t.text }]}>{[items[0]?.shiftName, items.map(clockLabel).join('、')].filter(Boolean).join(' · ')}</Text>
          </View>;
        })}
      </Card>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>{error}</Text> : null}
      {!isNew ? <PanelButton label="删除班组" variant="text" icon="trash-outline" onPress={() => setDialog('delete')} /> : null}

      {pending ? (
        <AppDialog title={pending.creating ? '添加响铃' : '编辑响铃'} cancel confirm="保存时间" onConfirm={confirmTime}
          onClose={() => { setPending(null); setTimeError(''); }}>
          <TimeGridPicker value={pending} onChange={(value) => { setPending({ ...pending, ...value }); setTimeError(''); }} />
          {timeError ? <Text accessibilityLiveRegion="polite" style={{ color: t.panel.danger }}>{timeError}</Text> : null}
        </AppDialog>
      ) : null}
      {dialog === 'anchor' && 'anchor' in rule ? <DateDialog title="选择循环起始日" date={rule.anchor}
        onSelect={(anchor) => { setRule({ ...rule, anchor }); setDialog(null); }} onClose={() => setDialog(null)} /> : null}
      {dialog === 'dates' && rule.kind === 'customDates' ? <ManualDates dates={rule.dates} today={today}
        onSave={(dates) => { setRule({ kind: 'customDates', dates }); setDialog(null); }} onClose={() => setDialog(null)} /> : null}
      {cycleDay !== null && cycle ? (
        <AppDialog title={'第 ' + (cycleDay + 1) + ' 天的班次'} onClose={() => setCycleDay(null)}>
          <PanelList inset>
            {[...cycle.shifts.map((item) => ({ id: item.id as string | null, name: item.name })), { id: null, name: '休息' }].map((item) => (
              <PanelRow key={item.id ?? 'rest'} icon={item.id ? 'alarm-outline' : 'moon-outline'} title={item.name}
                value={cycle.days[cycleDay] === item.id ? '当前' : undefined} onPress={() => {
                  setRule({ ...cycle, days: cycle.days.map((day, index) => index === cycleDay ? item.id : day) });
                  setCycleDay(null);
                }} />
            ))}
          </PanelList>
          {cycle.days.length > 1 ? <PanelButton label="移除这一天" variant="text" onPress={() => {
            setRule({ ...cycle, days: cycle.days.filter((_, index) => index !== cycleDay) });
            setCycleDay(null);
          }} /> : null}
        </AppDialog>
      ) : null}
      {dialog === 'enable' ? (
        <AppDialog title="确认首响" confirm="启用班组" onConfirm={() => void save(true)} cancel busy={busy}
          onClose={() => setDialog(null)}>
          <DialogSummary value={first ? clockLabel(first) : '—'} detail={first ? cnDate(first.date) + ' · ' + draft.name : '尚无未来响铃'} />
          <DialogCopy>{ruleDesc(draft)}</DialogCopy>
        </AppDialog>
      ) : null}
      {dialog === 'changes' ? (
        <AppDialog title="核对排班变更" confirm="保存规则" onConfirm={() => void save(true)} cancel busy={busy}
          onClose={() => setDialog(null)}>
          <DialogCopy>{'未来两周有 ' + editedDates.length + ' 天的响铃时间会变化。'}</DialogCopy>
          {editedDates.length ? <DialogCopy>{editedDates.slice(0, 5).map(cnDate).join('、') + (editedDates.length > 5 ? ' 等' : '')}</DialogCopy> : null}
          <DialogCopy>{ruleDesc(draft)}</DialogCopy>
        </AppDialog>
      ) : null}
      {dialog === 'discard' ? <AppDialog title="舍弃班组修改？" layout="center" cancel confirm="舍弃修改"
        onConfirm={() => { setDialog(null); router.back(); }} onClose={() => setDialog(null)}>
        <DialogCopy centered>当前编辑的时间和规则还未保存。</DialogCopy>
      </AppDialog> : null}
      {dialog === 'delete' ? <AppDialog title={'删除「' + draft.name + '」？'} layout="center" cancel tone="danger"
        icon="trash-outline" confirm="删除班组" onConfirm={deleteGroup} onClose={() => setDialog(null)}>
        <DialogCopy centered>此班组的排班、临时调整和后续响铃都会移除。</DialogCopy>
      </AppDialog> : null}
    </SafeAreaScrollView>
  );
}

function ManualDates({ dates, today, onSave, onClose }: {
  dates: string[]; today: string; onSave: (value: string[]) => void; onClose: () => void;
}) {
  const [selection, setSelection] = useState(() => new Set(dates));
  const [selected, setSelected] = useState(dates.find((date) => date >= today) ?? today);
  const [month, setMonth] = useState(firstOfMonth(selected));
  return (
    <AppDialog title="选择响铃日期" cancel confirm={'使用日期 · ' + selection.size + ' 天'} onClose={onClose}
      onConfirm={() => onSave([...selection].sort())}>
      <MonthGrid month={month} selected={selected} isMarked={(date) => selection.has(date)} onMonth={setMonth} onSelect={(date) => {
        const next = new Set(selection);
        if (next.has(date)) next.delete(date);
        else next.add(date);
        setSelection(next);
        setSelected(date);
      }} />
    </AppDialog>
  );
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, {
      borderColor: selected ? t.heroBorder : t.panel.border,
      backgroundColor: selected ? t.accentSoft : t.panel.raised,
    }]}>
      <Text style={{ fontSize: 13, color: selected ? t.panel.accent : t.text, fontWeight: selected ? '800' : '600' }}>{label}</Text>
    </Pressable>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.panel.surface, borderColor: t.panel.border }]}>
    <Text accessibilityRole="header" style={[styles.text, { color: t.text }]}>{title}</Text>
    {children}
  </View>;
}

const styles = StyleSheet.create({
  screen: { padding: 14, paddingBottom: 32, gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heading: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 13, padding: 10, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 19, padding: 13, gap: 10 },
  text: { fontSize: 15, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  flex: { flex: 1, minWidth: 0 },
  adjustment: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choice: { minHeight: 45, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1 },
  previewRow: { flexDirection: 'row', gap: 9, alignItems: 'baseline' },
  error: { fontSize: 13, lineHeight: 19 },
});
