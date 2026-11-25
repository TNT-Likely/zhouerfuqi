import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { addDays, expandGroup, isoWeekday, localDateISO, nextUpcomingOccurrences, type AlarmGroup, type AlarmTime, type RepeatRule, type Weekday } from '@core';
import { AlarmTimeRows } from '@/components/AlarmTimeRows';
import { AppDialog, DialogCopy, DialogSummary } from '@/components/AppDialog';
import { useFeedback } from '@/components/Feedback';
import { DateDialog, firstOfMonth, MonthGrid } from '@/components/MonthGrid';
import { PanelButton, PanelList, PanelRow } from '@/components/Panel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { TimeGridPicker, type DraftTime } from '@/components/TimeWheel';
import { useLocale } from '@/i18n';
import { planningMessages } from '@/i18n/planning';
import { clockLabel } from '@/lib/clock';
import { dateLabel, ruleDesc, weekdayNames } from '@/lib/labels';
import { cycleRule, makeId, templateGroup } from '@/lib/templates';
import { syncAll, useScheduleState } from '@/scheduler/sync';
import { getHolidayCalendar } from '@/services/holidays';
import { requestAlarmPermissions } from '@/services/permissions';
import { useGroups } from '@/stores/groups';
import { useTheme } from '@/theme';

const RULES = [
  'weekly', 'everyNWeeks', 'everyNDays', 'cycle', 'customDates',
] as const satisfies readonly RepeatRule['kind'][];

const PRESETS: ReadonlyArray<{ hour: number; minute: number; label?: keyof typeof planningMessages.en.editor.presets }> = [
  { hour: 6, minute: 40, label: 'first' },
  { hour: 6, minute: 50, label: 'second' },
  { hour: 7, minute: 0, label: 'last' },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 55, label: 'nap' },
];

type Editing = DraftTime & { id: string; shiftId?: string; creating?: boolean };
const newTime = (shiftId?: string): Editing => ({ id: makeId('t'), hour: 7, minute: 0, label: '', shiftId, creating: true });

export default function GroupEditScreen() {
  const router = useRouter();
  const t = useTheme();
  const locale = useLocale();
  const { common, editor } = planningMessages[locale];
  const weekdays = weekdayNames(locale);
  const notify = useFeedback();
  const { id, template, timeId } = useLocalSearchParams<{ id: string; template?: string; timeId?: string }>();
  const isNew = id === 'new';
  const existing = useGroups((s) => s.groups.find((group) => group.id === id));
  const [draft, setDraft] = useState(() => existing ?? templateGroup(template, locale));
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
      before.filter((item) => item.date === date).map((item) => item.hour * 60 + item.minute).join(',') !==
      preview.filter((item) => item.date === date).map((item) => item.hour * 60 + item.minute).join(',')
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
      case 'everyNWeeks': setRule(templateGroup('alternating', locale).rule); break;
      case 'everyNDays': setRule({ kind, n: 2, anchor: today }); break;
      case 'cycle': patch({ rule: cycleRule('two', today, draft.times, locale), holidayMode: 'raw' }); break;
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
      setTimeError(editor.duplicateTime);
      return;
    }
    const { id, hour, minute, label } = pending;
    updateTimes([...list, { id, hour, minute, label: label.trim() || undefined }]
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)), pending.shiftId);
    setPending(null);
    setTimeError('');
  }

  function validate() {
    if (!draft.name.trim()) return editor.needName;
    if (!draft.times.length && !cycle) return editor.needAlarm;
    if ((rule.kind === 'weekly' || rule.kind === 'everyNWeeks') && !rule.weekdays.length) return editor.needWeekdays;
    if (isNew && rule.kind === 'customDates' && !rule.dates.length) return editor.needDates;
    if (cycle && (!cycle.days.some(Boolean) || cycle.shifts.some((item) => cycle.days.includes(item.id) && (!item.name.trim() || !item.times.length)))) {
      return editor.needShifts;
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
        notify(editor.saved, firstEntry ? editor.synced : editor.checkStatus);
      } catch {
        notify(editor.saved, editor.savedSyncFailed, 'warning', 'alert-circle-outline');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editor.saveFailed);
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
      () => notify(editor.deleted, draft.name),
      () => notify(editor.deleted, editor.savedSyncFailed, 'warning'),
    );
  }

  if (!isNew && !existing) {
    return <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.screen}>
      <Text style={{ color: t.text }}>{editor.scheduleGone}</Text>
      <PanelButton label={editor.back} onPress={() => router.back()} />
    </SafeAreaScrollView>;
  }

  return (
    <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.nav}>
        <PanelButton label={editor.back} variant="text" icon="chevron-back" onPress={() => dirty ? setDialog('discard') : router.back()} />
        <Text accessibilityRole="header" style={[styles.heading, { color: t.text }]}>{isNew ? common.newSchedule : editor.editSchedule}</Text>
        <PanelButton label={isNew ? editor.review : editor.save} variant="primary" disabled={busy} onPress={() => void save()} />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>{error}</Text> : null}
      <Card title={editor.scheduleName}>
        <TextInput accessibilityLabel={editor.scheduleName} value={draft.name} maxLength={36}
          onChangeText={(name) => patch({ name })} style={[styles.input, { backgroundColor: t.panel.raised, borderColor: t.panel.border, color: t.text }]} />
      </Card>
      <Card title={editor.repeatRule}>
        <View style={styles.wrap}>
          {RULES.map((kind) => <Choice key={kind} selected={kind === rule.kind} label={editor.rules[kind]} onPress={() => choose(kind)} />)}
        </View>
        {rule.kind === 'weekly' || rule.kind === 'everyNWeeks' ? (
          <View style={styles.wrap}>
            {weekdays.map((label, index) => {
              const day = (index + 1) as Weekday;
              const enabled = rule.weekdays.includes(day);
              return <Choice key={day} label={common.weekday(label)} selected={enabled} onPress={() => setRule({
                ...rule, weekdays: enabled ? rule.weekdays.filter((item) => item !== day) : [...rule.weekdays, day].sort(),
              })} />;
            })}
          </View>
        ) : null}
        {rule.kind === 'everyNWeeks' || rule.kind === 'everyNDays' ? (
          <View style={styles.adjustment}>
            <PanelButton label="−" variant="secondary" disabled={rule.n <= 2} onPress={() => setRule({ ...rule, n: rule.n - 1 })} />
            <Text style={{ color: t.text, fontWeight: '800' }}>{rule.kind === 'everyNWeeks' ? editor.everyNWeeks(rule.n) : editor.everyNDays(rule.n)}</Text>
            <PanelButton label="+" variant="secondary" disabled={rule.n >= 30} onPress={() => setRule({ ...rule, n: rule.n + 1 })} />
          </View>
        ) : null}
        {'anchor' in rule ? (
          <PanelButton label={(rule.kind === 'everyNWeeks' ? editor.alternatingAnchor : editor.cycleAnchor)(dateLabel(rule.anchor, locale))}
            icon="calendar-outline" onPress={() => setDialog('anchor')} />
        ) : null}
        {rule.kind === 'everyNWeeks' ? (
          <Text style={{ color: t.panel.muted, fontSize: 13 }}>
            {editor.alternatingDetail(weekdays[isoWeekday(rule.anchor) - 1]!, rule.n)}
          </Text>
        ) : null}
        {cycle ? (
          <>
            <View style={styles.wrap}>
              <PanelButton label={editor.twoOnTwoOff} onPress={() => setRule(cycleRule('two', cycle.anchor, draft.times, locale))} />
              <PanelButton label={editor.earlyLateOff} onPress={() => setRule(cycleRule('shifts', cycle.anchor, draft.times, locale))} />
            </View>
            <View style={styles.wrap}>
              {cycle.days.map((item, index) => (
                <Choice key={index} selected={!!item}
                  label={editor.cycleDay(index + 1, cycle.shifts.find((entry) => entry.id === item)?.name || editor.rest)}
                  onPress={() => setCycleDay(index)} />
              ))}
              {cycle.days.length < 42 ? <PanelButton label={editor.addDay} icon="add" variant="text"
                onPress={() => setRule({ ...cycle, days: [...cycle.days, null] })} /> : null}
            </View>
          </>
        ) : null}
        {rule.kind === 'customDates' ? (
          <PanelButton label={editor.chooseDates(rule.dates.length)} icon="calendar-outline" onPress={() => setDialog('dates')} />
        ) : null}
      </Card>
      <Card title={shift ? editor.shiftAndAlarmTimes : editor.alarmTimes}>
        {cycle && shift ? (
          <>
            <View style={styles.wrap}>
              {cycle.shifts.map((item) => <Choice key={item.id} label={item.name || editor.unnamedShift}
                selected={item.id === shift.id} onPress={() => setSelectedShift(item.id)} />)}
              {cycle.shifts.length < 12 ? <PanelButton label={editor.addShift} icon="add" variant="text" onPress={() => {
                const id = makeId('s');
                setRule({ ...cycle, shifts: [...cycle.shifts, { id, name: editor.shiftNumber(cycle.shifts.length + 1), times: [{ id: makeId('t'), hour: 7, minute: 0 }] }] });
                setSelectedShift(id);
              }} /> : null}
            </View>
            <TextInput accessibilityLabel={editor.shiftName} value={shift.name} maxLength={24} onChangeText={(name) => {
              setRule({ ...cycle, shifts: cycle.shifts.map((item) => item.id === shift.id ? { ...item, name } : item) });
            }} style={[styles.input, { backgroundColor: t.panel.raised, borderColor: t.panel.border, color: t.text }]} />
          </>
        ) : null}
        <View style={styles.wrap}>
          {PRESETS.map(({ hour, minute, label }) => {
            const used = times.some((time) => time.hour === hour && time.minute === minute);
            return <Choice key={hour * 60 + minute} label={clockLabel({ hour, minute }, locale)} selected={used} disabled={used}
              onPress={() => updateTimes([...times, { hour, minute, label: label ? editor.presets[label] : undefined, id: makeId('t') }]
                .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)))} />;
          })}
        </View>
        <AlarmTimeRows times={times} onAdd={() => setPending(newTime(shift?.id))}
          onEdit={(time) => setPending({ ...time, label: time.label ?? '', shiftId: shift?.id })}
          onRemove={(id) => {
            if (times.length <= 1) { setError(editor.keepAlarm); return; }
            updateTimes(times.filter((item) => item.id !== id));
          }} />
      </Card>
      {rule.kind !== 'customDates' ? (
        <Card title={editor.holidays}>
          <View style={styles.nav}>
            <View style={styles.flex}>
              <Text style={[styles.text, { color: t.text }]}>{editor.followHolidays}</Text>
              <Text style={{ color: t.panel.muted, fontSize: 13 }}>{cycle ? editor.cycleHolidayDetail : editor.holidayDetail}</Text>
            </View>
            <Switch accessibilityLabel={editor.followHolidays} value={draft.holidayMode !== 'raw'}
              onValueChange={(on) => patch({ holidayMode: on ? 'china-smart' : 'raw' })} />
          </View>
        </Card>
      ) : null}
      <Card title={editor.preview}>
        <Text style={{ color: t.panel.muted, lineHeight: 19 }}>{ruleDesc(draft, locale)}</Text>
        {first ? <Text style={[styles.text, { color: t.text }]}>{editor.firstAlarm(dateLabel(first.date, locale), clockLabel(first, locale))}</Text>
          : <Text style={{ color: t.panel.muted }}>{editor.noUpcoming}</Text>}
        {previewDates.slice(0, 14).map((date) => {
          const items = preview.filter((item) => item.date === date);
          return <View key={date} style={styles.previewRow}>
            <Text style={{ color: t.panel.muted }}>{dateLabel(date, locale)}</Text>
            <Text style={[styles.flex, { color: t.text }]}>{[
              items[0]?.shiftName, common.dateContext(items.map((item) => clockLabel(item, locale))),
            ].filter(Boolean).join(' · ')}</Text>
          </View>;
        })}
      </Card>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.panel.danger }]}>{error}</Text> : null}
      {!isNew ? <PanelButton label={editor.deleteSchedule} variant="text" icon="trash-outline" onPress={() => setDialog('delete')} /> : null}

      {pending ? (
        <AppDialog title={pending.creating ? editor.addAlarm : editor.editAlarm} cancel confirm={editor.saveTime} onConfirm={confirmTime}
          onClose={() => { setPending(null); setTimeError(''); }}>
          <TimeGridPicker value={pending} onChange={(value) => { setPending({ ...pending, ...value }); setTimeError(''); }} />
          {timeError ? <Text accessibilityLiveRegion="polite" style={{ color: t.panel.danger }}>{timeError}</Text> : null}
        </AppDialog>
      ) : null}
      {dialog === 'anchor' && 'anchor' in rule ? <DateDialog title={editor.chooseStart} date={rule.anchor}
        onSelect={(anchor) => { setRule({ ...rule, anchor }); setDialog(null); }} onClose={() => setDialog(null)} /> : null}
      {dialog === 'dates' && rule.kind === 'customDates' ? <ManualDates dates={rule.dates} today={today}
        onSave={(dates) => { setRule({ kind: 'customDates', dates }); setDialog(null); }} onClose={() => setDialog(null)} /> : null}
      {cycleDay !== null && cycle ? (
        <AppDialog title={editor.pickShift(cycleDay + 1)} onClose={() => setCycleDay(null)}>
          <PanelList inset>
            {[...cycle.shifts.map((item) => ({ id: item.id as string | null, name: item.name })), { id: null, name: editor.rest }].map((item) => (
              <PanelRow key={item.id ?? 'rest'} icon={item.id ? 'alarm-outline' : 'moon-outline'} title={item.name}
                value={cycle.days[cycleDay] === item.id ? editor.current : undefined} onPress={() => {
                  setRule({ ...cycle, days: cycle.days.map((day, index) => index === cycleDay ? item.id : day) });
                  setCycleDay(null);
                }} />
            ))}
          </PanelList>
          {cycle.days.length > 1 ? <PanelButton label={editor.removeDay} variant="text" onPress={() => {
            setRule({ ...cycle, days: cycle.days.filter((_, index) => index !== cycleDay) });
            setCycleDay(null);
          }} /> : null}
        </AppDialog>
      ) : null}
      {dialog === 'enable' ? (
        <AppDialog title={editor.confirmFirst} confirm={editor.enableSchedule} onConfirm={() => void save(true)} cancel busy={busy}
          onClose={() => setDialog(null)}>
          <DialogSummary value={first ? clockLabel(first, locale) : '—'} detail={first ? dateLabel(first.date, locale) + ' · ' + draft.name : editor.noFirst} />
          <DialogCopy>{ruleDesc(draft, locale)}</DialogCopy>
        </AppDialog>
      ) : null}
      {dialog === 'changes' ? (
        <AppDialog title={editor.reviewChanges} confirm={editor.saveRule} onConfirm={() => void save(true)} cancel busy={busy}
          onClose={() => setDialog(null)}>
          <DialogCopy>{editor.changes(editedDates.length)}</DialogCopy>
          {editedDates.length ? <DialogCopy>{common.dateList(editedDates.slice(0, 5).map((date) => dateLabel(date, locale)), editedDates.length > 5)}</DialogCopy> : null}
          <DialogCopy>{ruleDesc(draft, locale)}</DialogCopy>
        </AppDialog>
      ) : null}
      {dialog === 'discard' ? <AppDialog title={editor.discardTitle} layout="center" cancel confirm={common.discard}
        onConfirm={() => { setDialog(null); router.back(); }} onClose={() => setDialog(null)}>
        <DialogCopy centered>{editor.discardDetail}</DialogCopy>
      </AppDialog> : null}
      {dialog === 'delete' ? <AppDialog title={editor.deleteTitle(draft.name)} layout="center" cancel tone="danger"
        icon="trash-outline" confirm={editor.deleteSchedule} onConfirm={deleteGroup} onClose={() => setDialog(null)}>
        <DialogCopy centered>{editor.deleteDetail}</DialogCopy>
      </AppDialog> : null}
    </SafeAreaScrollView>
  );
}

function ManualDates({ dates, today, onSave, onClose }: {
  dates: string[]; today: string; onSave: (value: string[]) => void; onClose: () => void;
}) {
  const { editor } = planningMessages[useLocale()];
  const [selection, setSelection] = useState(() => new Set(dates));
  const [selected, setSelected] = useState(dates.find((date) => date >= today) ?? today);
  const [month, setMonth] = useState(firstOfMonth(selected));
  return (
    <AppDialog title={editor.manualTitle} cancel confirm={editor.useDates(selection.size)} onClose={onClose}
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
