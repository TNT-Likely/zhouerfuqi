import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { addDays, diffDays, expandGroups, isoWeekday, type AlarmGroup, type Occurrence } from '@core';
import { Avatar } from '@/components/Avatar';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { useFeedback } from '@/components/Feedback';
import { PanelButton, PanelIconTile, PanelList, PanelRow } from '@/components/Panel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { TrialStatus } from '@/components/TrialStatus';
import { clockLabel } from '@/lib/clock';
import { cnDate, ruleDesc, WD } from '@/lib/labels';
import { TEMPLATES } from '@/lib/templates';
import { alarmId, todayISO } from '@/scheduler/materialize';
import { scheduleMessage, useFutureSchedule } from '@/scheduler/future';
import { syncAll } from '@/scheduler/sync';
import { skipOccurrence } from '@/services/dayOverrides';
import { requestAlarmPermissions } from '@/services/permissions';
import { useGroups } from '@/stores/groups';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme';

const newGroup = (template?: string) => router.push({ pathname: '/group/new', params: template ? { template } : {} });
const openCalendar = (date: string, group?: string) => router.push({ pathname: '/calendar', params: { date, group } });

export default function HomeScreen() {
  const t = useTheme();
  const notify = useFeedback();
  const { groups, now, calendar, upcoming, state } = useFutureSchedule();
  const avatar = usePrefs((prefs) => prefs.avatarImage);
  const [skip, setSkip] = useState<Occurrence | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [templates, setTemplates] = useState(false);
  const today = todayISO(new Date(now));
  const first = upcoming[0];
  const names = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const dayName = (date: string) => diffDays(date, today) === 0 ? '今天'
    : diffDays(date, today) === 1 ? '明天' : cnDate(date);
  const occurrenceName = (item: Occurrence) => [names.get(item.groupId), item.shiftName, item.label].filter(Boolean).join(' · ');
  const status = scheduleMessage(first, now, state);
  const statusInk = status.tone === 'success' ? t.panel.success
    : status.tone === 'warning' ? t.panel.danger : status.tone === 'accent' ? t.panel.accent : t.panel.muted;
  const week = useMemo(() => {
    const items = expandGroups(groups, calendar, today, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index);
      return { date, count: items.filter((item) => item.date === date).length, holiday: calendar.statusOf(date) };
    });
  }, [groups, calendar, today]);

  function confirmSkip() {
    if (!skip) return;
    try {
      const undo = skipOccurrence(skip);
      notify('已跳过本次', [dayName(skip.date), clockLabel(skip), names.get(skip.groupId)].filter(Boolean).join(' · '),
        'success', 'checkmark', { label: '撤销', run: () => {
          if (undo()) notify('已撤销跳过');
          else notify('这一天有新的修改', '可在月历查看当前安排。', 'warning');
        } });
    } catch (error) {
      notify('无法跳过', error instanceof Error ? error.message : undefined, 'warning', 'alert-circle-outline');
    }
    setSkip(null);
  }

  async function toggle(group: AlarmGroup, enabled: boolean) {
    try {
      useGroups.getState().setEnabled(group.id, enabled);
      if (enabled) await requestAlarmPermissions();
      await syncAll();
    } catch {
      notify('响铃同步失败', '请在设置中检查权限或重新同步响铃。', 'warning', 'alert-circle-outline');
    }
  }

  return (
    <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="设置与个人" onPress={() => router.push('/settings')}
          style={styles.profile}>
          <Avatar image={avatar} size={35} />
          <View style={styles.profileCopy}>
            <Text style={[styles.appName, { color: t.text }]}>周而复起</Text>
            <Text style={{ color: t.panel.muted, fontSize: 12 }}>设置 <Ionicons name="chevron-forward" size={10} /></Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="排班月历" onPress={() => openCalendar(today)}
          style={[styles.iconButton, { backgroundColor: t.surface2 }]}>
          <Ionicons name="calendar-outline" size={22} color={t.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="新建班组" onPress={() => setTemplates(true)}
          style={[styles.iconButton, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="add" size={24} color={t.panel.accent} />
        </Pressable>
      </View>

      <TrialStatus compact />

      {groups.length ? (
        <LinearGradient colors={[t.heroBg, t.surface]} style={[styles.hero, { borderColor: t.heroBorder }]}>
          <View style={styles.nextHead}>
            <Text accessibilityRole="header" style={[styles.caption, { color: t.panel.accent }]}>下一次响铃</Text>
            {first ? <Text style={[styles.caption, { color: t.panel.muted }]}>{dayName(first.date)} · 周{WD[isoWeekday(first.date) - 1]}</Text> : null}
          </View>
          {first ? (
            <>
              <Text style={[styles.heroTime, { color: t.text }]}>{clockLabel(first)}</Text>
              <Text style={[styles.nextName, { color: t.text }]}>{occurrenceName(first)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={status.title + '，查看响铃设置'}
                onPress={() => router.push('/settings')} style={styles.status}>
                <Ionicons name={status.tone === 'success' ? 'checkmark-circle-outline' : status.tone === 'warning' ? 'alert-circle-outline' : 'alarm-outline'}
                  size={16} color={statusInk} />
                <Text style={[styles.caption, { color: statusInk }]}>{status.title}</Text>
              </Pressable>
              <View style={styles.actions}>
                <PanelButton label="查看当天" icon="calendar-outline" onPress={() => openCalendar(first.date)} grow />
                <PanelButton label="跳过本次" variant="text" onPress={() => setSkip(first)} grow />
              </View>
              {upcoming.length > 1 ? (
                <View style={[styles.remaining, { borderColor: t.heroBorder }]}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRest }}
                    onPress={() => setShowRest((open) => !open)} style={styles.restButton}>
                    <Text style={[styles.caption, { color: t.text }]}>{dayName(first.date)}还有 {upcoming.length - 1} 次响铃</Text>
                    <Ionicons name={showRest ? 'chevron-up' : 'chevron-down'} color={t.panel.accent} size={18} />
                  </Pressable>
                  {showRest ? upcoming.slice(1).map((item) => (
                    <View key={alarmId(item)} style={styles.remainingRow}>
                      <Text style={[styles.remainingClock, { color: t.text }]}>{clockLabel(item)}</Text>
                      <Text style={{ color: t.panel.muted, flex: 1 }}>{occurrenceName(item)}</Text>
                    </View>
                  )) : null}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.emptyTitle, { color: t.text }]}>暂无响铃安排</Text>
          )}
          <View style={[styles.week, { backgroundColor: t.surface2 }]}>
            {week.map((day) => {
              const selected = first?.date === day.date;
              const badge = day.count ? (day.holiday === false ? '补 ' : '响 ') + day.count : day.holiday === true ? '假' : '休';
              return (
                <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={cnDate(day.date) + '，' + badge}
                  accessibilityState={{ selected }} onPress={() => openCalendar(day.date)}
                  style={[styles.weekDay, selected && { backgroundColor: t.accentSoft, borderColor: t.heroBorder }]}>
                  <Text style={[styles.weekText, { color: t.panel.muted }]}>{day.date === today ? '今' : WD[isoWeekday(day.date) - 1]}</Text>
                  <Text style={[styles.dateNumber, { color: t.text }]}>{Number(day.date.slice(8))}</Text>
                  <Text numberOfLines={1} style={[styles.weekText, { color: day.count ? t.panel.accent : t.panel.muted }]}>{badge}</Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>
      ) : (
        <LinearGradient colors={[t.heroBg, t.surface]} style={[styles.hero, { borderColor: t.heroBorder }]}>
          <Text accessibilityRole="header" style={[styles.emptyTitle, { color: t.text }]}>创建第一个班组</Text>
          <Text style={{ color: t.panel.muted, fontSize: 14, lineHeight: 21 }}>选班制、核对时间，确认后启用闹钟。</Text>
          <PanelList inset>
            {TEMPLATES.map((item, index) => <PanelRow key={item.key} title={item.title} detail={item.detail}
              icon={item.key === 'cycle' ? 'repeat-outline' : 'calendar-outline'} divider={index !== 0}
              onPress={() => newGroup(item.key)} />)}
          </PanelList>
        </LinearGradient>
      )}

      {groups.length ? <Text accessibilityRole="header" style={[styles.section, { color: t.text }]}>排班闹钟组 · {groups.length}</Text> : null}
      {groups.map((group) => {
        const edit = () => router.push('/group/' + group.id);
        const cycle = group.rule.kind === 'cycle' ? group.rule : undefined;
        const times = cycle ? cycle.shifts.flatMap((shift) => shift.times.map((time) => ({ ...time, shift: shift.name })))
          : group.times.map((time) => ({ ...time, shift: undefined }));
        return (
          <View key={group.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
            <View style={styles.groupHeader}>
              <PanelIconTile icon="alarm-outline" />
              <Pressable accessibilityRole="button" accessibilityLabel={'编辑 ' + group.name} onPress={edit} style={styles.groupName}>
                <Text style={[styles.name, { color: t.text }]}>{group.name}</Text>
                <Text style={[styles.caption, { color: t.panel.muted }]}>{ruleDesc(group)}{group.enabled ? '' : ' · 已暂停'}</Text>
              </Pressable>
              <Switch accessibilityLabel={'启用 ' + group.name} value={group.enabled}
                trackColor={{ true: t.panel.action, false: t.line }} onValueChange={(on) => void toggle(group, on)} />
            </View>
            <View style={styles.times}>
              {times.map((time) => {
                const next = group.id === first?.groupId && first.timeId === time.id;
                return (
                  <Pressable key={(time.shift ?? '') + time.id} accessibilityRole="button"
                    accessibilityLabel={'编辑 ' + group.name + ' ' + clockLabel(time)}
                    onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id, timeId: time.id } })} style={[styles.time, {
                      backgroundColor: next ? t.accentSoft : t.surface2,
                      borderColor: next ? t.panel.accent : 'transparent',
                    }]}>
                    <Text style={[styles.groupClock, { color: t.text }]}>{clockLabel(time)}</Text>
                    <Text style={[styles.caption, { color: t.panel.muted }]}>{[time.shift, time.label].filter(Boolean).join(' · ') || '响铃'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      {templates ? (
        <AppDialog title="选择排班模板" onClose={() => setTemplates(false)}>
          <PanelList inset>
            {TEMPLATES.map((item, index) => <PanelRow key={item.key} title={item.title} detail={item.detail}
              icon="calendar-outline" divider={index !== 0} onPress={() => {
                setTemplates(false);
                newGroup(item.key);
              }} />)}
          </PanelList>
        </AppDialog>
      ) : null}
      {skip ? (
        <AppDialog title="跳过这次响铃？" layout="center" tone="warning" icon="alarm-outline" confirm="跳过本次"
          cancel onClose={() => setSkip(null)} onConfirm={confirmSkip}>
          <DialogCopy centered>{dayName(skip.date)} {clockLabel(skip)} · {occurrenceName(skip)}</DialogCopy>
          <DialogCopy centered>后续响铃按班表继续安排。</DialogCopy>
        </AppDialog>
      ) : null}
    </SafeAreaScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 24, gap: 13 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  profile: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileCopy: { flex: 1, gap: 2 },
  appName: { fontSize: 18, fontWeight: '800' },
  iconButton: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 14, borderWidth: 1, borderRadius: 22, gap: 7 },
  nextHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  heroTime: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2.2 },
  nextName: { fontSize: 17, fontWeight: '800' },
  status: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', gap: 8 },
  remaining: { borderTopWidth: 1, marginTop: 5 },
  restButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remainingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  remainingClock: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', borderRadius: 15, marginTop: 5, padding: 2 },
  weekDay: { flex: 1, minWidth: 0, minHeight: 59, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 11, borderColor: 'transparent' },
  weekText: { fontSize: 11, fontWeight: '700' },
  dateNumber: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  emptyTitle: { marginVertical: 6, fontSize: 23, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '800', marginTop: 5 },
  card: { padding: 13, borderWidth: 1, borderRadius: 19, gap: 10 },
  groupHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  groupName: { flex: 1, minHeight: 48, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  time: { minHeight: 56, minWidth: '45%', flexGrow: 1, justifyContent: 'center', borderWidth: 1, borderRadius: 13, padding: 8 },
  groupClock: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
