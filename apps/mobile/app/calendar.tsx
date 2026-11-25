import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { expandGroups, isoWeekday, isRuleDay, localDateISO, occurrenceEpoch, type AlarmGroup } from '@core';
import { Sheet } from '@/components/Sheet';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { DayEditor } from '@/components/DayEditor';
import { useFeedback } from '@/components/Feedback';
import { daysInMonth, firstOfMonth, MonthGrid } from '@/components/MonthGrid';
import { PanelButton } from '@/components/Panel';
import { clockLabel, useClock } from '@/lib/clock';
import { cnDate, WD } from '@/lib/labels';
import { alarmId } from '@/scheduler/materialize';
import { syncAll, useScheduleState } from '@/scheduler/sync';
import { exportCalendar } from '@/services/calendarExport';
import { changeDay } from '@/services/dayOverrides';
import { getHolidayCalendar } from '@/services/holidays';
import { useGroups } from '@/stores/groups';
import { useTheme } from '@/theme';

type Draft = { original: string[]; dates: string[] };

export default function CalendarScreen() {
  const router = useRouter();
  const t = useTheme();
  const notify = useFeedback();
  const params = useLocalSearchParams<{ date?: string; group?: string }>();
  const now = useClock();
  const today = localDateISO(new Date(now));
  const initialDate = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    && Number.isFinite(Date.parse(params.date)) ? params.date : today;
  const [selected, setSelected] = useState(initialDate);
  const [month, setMonth] = useState(firstOfMonth(initialDate));
  const [filter, setFilter] = useState(params.group ?? '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<'save' | 'discard' | null>(null);
  const [dayMode, setDayMode] = useState<'extra' | 'replace' | null>(null);
  const [exporting, setExporting] = useState(false);
  const groups = useGroups((state) => state.groups);
  // 节假日缓存更新后，重排状态会触发一次重新渲染。
  useScheduleState((state) => state.syncedAt);
  const calendar = getHolidayCalendar();
  const active = groups.find((group) => group.id === filter);
  const target = active ?? (groups.length === 1 ? groups[0] : undefined);
  const shown = useMemo(() => active ? [active] : groups, [active, groups]);
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const monthItems = useMemo(() => expandGroups(shown, calendar, month, daysInMonth(month)), [shown, calendar, month]);
  const counts = new Map<string, number>();
  for (const item of monthItems) counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  const items = monthItems.filter((item) => item.date === selected);
  const originally = new Set(draft?.original);
  const selectedDates = new Set(draft?.dates);
  const added = draft?.dates.filter((date) => !originally.has(date)) ?? [];
  const removed = draft?.original.filter((date) => !selectedDates.has(date)) ?? [];
  const changed = added.length + removed.length;
  const adjusted = shown.some((group) => group.overrides?.[selected]);
  const isPastDay = selected < today;

  function selectDate(date: string) {
    setSelected(date);
    if (!draft) return;
    const dates = new Set(draft.dates);
    if (dates.has(date)) dates.delete(date);
    else dates.add(date);
    setDraft({ ...draft, dates: [...dates].sort() });
  }

  function editManual(group: AlarmGroup) {
    if (group.rule.kind !== 'customDates') return;
    setFilter(group.id);
    setDraft({ original: group.rule.dates, dates: group.rule.dates });
  }

  function saveManual() {
    if (!draft || !target) return;
    const current = useGroups.getState().groups.find((group) => group.id === target.id);
    if (!current || current.rule.kind !== 'customDates' || current.rule.dates !== draft.original) {
      notify('排班已更新', '请重新打开编辑查看当前日期。', 'warning');
      setDraft(null);
      setConfirm(null);
      return;
    }
    useGroups.getState().upsert({ ...current, rule: { kind: 'customDates', dates: draft.dates } });
    setConfirm(null);
    setDraft(null);
    notify('已保存手动排班', '新增 ' + added.length + ' 天 · 移除 ' + removed.length + ' 天');
    void syncAll().catch(() => notify('响铃同步失败', '可在设置中重试。', 'warning'));
  }

  function clearOverride(group: AlarmGroup) {
    const undo = changeDay(group.id, selected, () => undefined);
    notify('已恢复当天规则', cnDate(selected) + ' · ' + group.name, 'success', 'checkmark',
      { label: '撤销', run: () => { if (undo()) notify('已撤销恢复'); } });
  }

  async function shareMonth() {
    if (exporting) return;
    setExporting(true);
    try {
      await exportCalendar(shown, month, daysInMonth(month));
    } catch (error) {
      notify('班表导出失败', error instanceof Error ? error.message : undefined, 'error', 'alert-circle-outline');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Sheet title={draft ? '编辑手动日期' : '排班月历'} onClose={draft ? () => changed ? setConfirm('discard') : setDraft(null) : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!draft && groups.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <PanelButton label="全部班组" variant={!active ? 'primary' : 'secondary'} onPress={() => setFilter('')} />
              {groups.map((group) => (
                <PanelButton key={group.id} label={group.name} variant={active?.id === group.id ? 'primary' : 'secondary'}
                  onPress={() => setFilter(group.id)} />
              ))}
            </ScrollView>
          ) : null}
          <MonthGrid month={month} selected={selected} onMonth={(date) => { setMonth(date); setSelected(date); }}
            onSelect={selectDate} isMarked={draft ? (date) => selectedDates.has(date) : undefined}
            badge={(date) => {
              const flag = calendar.statusOf(date);
              const count = counts.get(date) ?? 0;
              if (draft) return flag === true ? { text: '假', tone: 'warning' } : flag === false ? { text: '补', tone: 'success' } : undefined;
              if (shown.some((group) => group.overrides?.[date])) return { text: count ? '调 ' + count : '调休', tone: 'accent' };
              const rule = target?.rule;
              if (rule?.kind === 'everyNWeeks' && rule.n === 2 && isoWeekday(date) === 6 &&
                isoWeekday(rule.anchor) === 6 && rule.weekdays.includes(6) && flag === undefined) {
                return isRuleDay(rule, date) ? { text: '大周', tone: 'accent' } : { text: '小周' };
              }
              if (count) return { text: (flag === false ? '补 ' : '响 ') + count, tone: flag === false ? 'success' : 'accent' };
              return flag === true ? { text: '假', tone: 'warning' } : { text: '休' };
            }} />
          <View style={styles.actions}>
            <PanelButton label="回到今天" variant="text" onPress={() => { setMonth(firstOfMonth(today)); setSelected(today); }} />
            {!draft ? <PanelButton label="导出本月" variant="text" icon="share-outline" disabled={exporting}
              onPress={() => void shareMonth()} /> : null}
          </View>
          {draft ? (
            <View style={[styles.detail, { backgroundColor: t.surface2 }]}>
              <Text style={[styles.title, { color: t.text }]}>{target?.name} · 已选 {draft.dates.length} 天</Text>
              <Text style={{ color: t.panel.muted }}>{changed ? '新增 ' + added.length + ' 天 · 移除 ' + removed.length + ' 天' : '点击日期选中或移除。'}</Text>
              <View style={styles.actions}>
                <PanelButton label="取消编辑" onPress={() => changed ? setConfirm('discard') : setDraft(null)} grow />
                <PanelButton label="核对并保存" variant="primary" disabled={!changed} onPress={() => setConfirm('save')} grow />
              </View>
            </View>
          ) : (
            <View style={[styles.detail, { backgroundColor: t.surface, borderColor: t.line }]}>
              <View style={styles.detailHeader}>
                <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{cnDate(selected)} · 周{WD[isoWeekday(selected) - 1]}</Text>
                <Text style={{ color: t.panel.muted }}>{items.length ? items.length + ' 次响铃' : '休息'}</Text>
              </View>
              {adjusted ? <Text style={{ color: t.panel.accent, fontSize: 13 }}>当天有临时调整</Text> : null}
              {items.map((item) => {
                const past = occurrenceEpoch(item) <= now;
                return (
                  <View key={alarmId(item)} style={[styles.item, { borderColor: t.line }]}>
                    <Text style={[styles.clock, { color: past ? t.panel.muted : t.text }]}>{clockLabel(item)}</Text>
                    <Text style={[styles.source, { color: t.text }]}>{[names.get(item.groupId), item.shiftName, item.label].filter(Boolean).join(' · ')}</Text>
                    {past ? <Text style={{ color: t.panel.muted, fontSize: 12 }}>已过</Text> : null}
                  </View>
                );
              })}
              {target && !isPastDay ? (
                <>
                  <View style={styles.actions}>
                    <PanelButton label="仅改当天" onPress={() => setDayMode('replace')} grow />
                    <PanelButton label="补一次" icon="add" onPress={() => setDayMode('extra')} grow />
                  </View>
                  {target.overrides?.[selected] ? <PanelButton label="恢复当天规则" variant="text"
                    onPress={() => clearOverride(target)} /> : null}
                </>
              ) : shown.length > 1 && !isPastDay ? (
                <Text style={{ color: t.panel.muted, fontSize: 13 }}>选择一个班组，即可调整这一天。</Text>
              ) : null}
              {target?.rule.kind === 'customDates' ? <PanelButton label="编辑手动日期" variant="text" onPress={() => editManual(target)} /> : null}
              {target && !target.enabled ? <Text style={{ color: t.panel.muted, fontSize: 13 }}>此班组已暂停。</Text> : null}
              {!groups.length ? <PanelButton label="新建班组" onPress={() => router.push('/group/new')} /> : null}
            </View>
          )}
        </ScrollView>
      </Sheet>
      {dayMode && target ? <DayEditor group={target} date={selected} mode={dayMode} onClose={() => setDayMode(null)} /> : null}
      {confirm ? (
        <AppDialog title={confirm === 'save' ? '保存这些日期？' : '舍弃排班修改？'} cancel layout="center" tone="warning"
          confirm={confirm === 'save' ? '保存日期' : '舍弃修改'} onClose={() => setConfirm(null)}
          onConfirm={confirm === 'save' ? saveManual : () => { setConfirm(null); setDraft(null); }}>
          {confirm === 'save' ? (
            <>
              <DialogCopy centered>新增 {added.length} 天 · 移除 {removed.length} 天</DialogCopy>
              {added.length ? <DialogCopy>{'新增 ' + added.slice(0, 4).map(cnDate).join('、') + (added.length > 4 ? ' 等' : '')}</DialogCopy> : null}
              {removed.length ? <DialogCopy>{'移除 ' + removed.slice(0, 4).map(cnDate).join('、') + (removed.length > 4 ? ' 等' : '')}</DialogCopy> : null}
            </>
          ) : <DialogCopy centered>舍弃后恢复到上次保存的日期。</DialogCopy>}
        </AppDialog>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 28, gap: 11 },
  filters: { gap: 6 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  detail: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 8, borderColor: 'transparent' },
  detailHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 5 },
  title: { fontSize: 17, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 43, borderBottomWidth: StyleSheet.hairlineWidth },
  clock: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  source: { fontSize: 14, flex: 1 },
});
