import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { diffDays, nextOccurrences } from '@core';
import { useGroups } from '@/stores/groups';
import { getHolidayCalendar } from '@/services/holidays';
import { todayISO } from '@/scheduler/materialize';
import { syncAll } from '@/scheduler/sync';
import { cnDate, WD, ruleDesc, ringReasonLabel, holidayChip } from '@/lib/labels';
import { useTheme, type Tokens } from '@/theme';

export default function HomeScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const setEnabled = useGroups((s) => s.setEnabled);

  const next = useMemo(() => {
    const enabled = groups.filter((g) => g.enabled);
    if (!enabled.length) return null;
    return nextOccurrences(enabled, getHolidayCalendar(), todayISO());
  }, [groups]);
  const first = next?.[0];
  const nextGroup = first ? groups.find((g) => g.id === first.groupId) : undefined;

  const d = first ? diffDays(first.date, todayISO()) : null;
  const countdown = d === null ? '' : d === 0 ? '今天响' : d === 1 ? '明天响' : `距响铃还有 ${d} 天`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={styles.appbar}>
        <Text style={[styles.appName, { color: t.text }]}>周而复起</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={[styles.iconBtn, { backgroundColor: t.surface }]} onPress={() => router.push('/guide')}>
          <Text style={{ fontSize: 14 }}>🛡</Text>
        </Pressable>
      </View>

      {/* Hero:下次响铃 */}
      <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.heroLabel, { color: t.text3 }]}>下次响铃 · NEXT RING</Text>
        {first && nextGroup ? (
          <>
            <Text style={[styles.heroTime, { color: t.text }]}>
              {String(first.hour).padStart(2, '0')}:{String(first.minute).padStart(2, '0')}
              <Text style={{ fontSize: 20, color: t.primary, fontWeight: '700' }}> ×{next.length}</Text>
            </Text>
            <Text style={[styles.heroDate, { color: t.text2 }]}>
              {cnDate(first.date)} 周{WD[new Date(`${first.date}T00:00:00`).getDay() === 0 ? 7 : new Date(`${first.date}T00:00:00`).getDay() - 1]}
            </Text>
            <View style={styles.chips}>
              <Text style={[styles.chip, chipStyle(t, 'hot')]}>{ringReasonLabel(nextGroup, first.date, isoDow(first.date))}</Text>
              {(() => {
                const c = holidayChip(first.reason === 'swap-workday' ? false : undefined, nextGroup.holidayMode !== 'raw');
                return c ? <Text style={[styles.chip, chipStyle(t, c.tone)]}>{c.text}</Text> : null;
              })()}
            </View>
            <Text style={[styles.countdown, { color: t.text3 }]}>{countdown}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.heroTime, { color: t.text }]}>— —</Text>
            <Text style={[styles.heroDate, { color: t.text3 }]}>所有班组已停用</Text>
          </>
        )}
      </View>

      {/* 组列表 */}
      {groups.map((g) => (
        <View key={g.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, opacity: g.enabled ? 1 : 0.6 }]}>
          <View style={styles.groupHead}>
            <View style={[styles.gicon, { backgroundColor: t.primary }]}>
              <Text style={{ fontSize: 15 }}>⏰</Text>
            </View>
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/group/${g.id}`)}>
              <Text style={[styles.gname, { color: t.text }]}>{g.name}</Text>
              <Text style={[styles.gsub, { color: t.text3 }]}>
                {ruleDesc(g)} · {g.times.length} 个时间
              </Text>
            </Pressable>
            <Switch
              value={g.enabled}
              onValueChange={(on) => {
                setEnabled(g.id, on);
                void syncAll();
              }}
              trackColor={{ true: t.primary, false: t.surface2 }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.chips}>
            <Text style={[styles.chip, chipStyle(t, 'hot')]}>
              {g.rule.kind === 'weekly' ? '每周几' : g.rule.kind === 'everyNWeeks' ? `每 ${g.rule.n} 周` : g.rule.kind === 'everyNDays' ? `每 ${g.rule.n} 天` : '月历点选'}
            </Text>
            {g.rule.kind === 'everyNWeeks' && <Text style={[styles.chip, chipStyle(t)]}>锚点 {g.rule.anchor.slice(5)}</Text>}
            <Text style={[styles.chip, chipStyle(t, g.holidayMode !== 'raw' ? 'blue' : undefined)]}>
              节假日{g.holidayMode !== 'raw' ? '联动' : '忽略'}
            </Text>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {g.times.map((tm) => (
              <View key={tm.id} style={[styles.timePill, { backgroundColor: t.surface2, borderColor: t.line }]}>
                <Text style={[styles.timeText, { color: t.text }]}>
                  {String(tm.hour).padStart(2, '0')}:{String(tm.minute).padStart(2, '0')}
                  {tm.label ? <Text style={{ fontSize: 11, color: t.text3, fontWeight: '500' }}> {tm.label}</Text> : null}
                </Text>
                {g.enabled && first && first.groupId === g.id ? (
                  <Text style={[styles.nextBadge, { color: t.amber, backgroundColor: t.bg }]}>{cnDate(first.date)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      <Pressable style={[styles.fab, { backgroundColor: t.primary }]} onPress={() => router.push('/group/new')}>
        <Text style={[styles.fabText, { color: t.onPrimary }]}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

function isoDow(date: string): number {
  const d = new Date(`${date}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

function chipStyle(t: Tokens, tone?: 'hot' | 'blue' | 'green' | 'red') {
  const map: Record<string, { backgroundColor: string; borderColor: string; color: string }> = {
    hot: { backgroundColor: 'rgba(255,122,69,0.14)', borderColor: 'rgba(255,122,69,0.4)', color: t.primary },
    blue: { backgroundColor: 'rgba(77,157,255,0.12)', borderColor: 'rgba(77,157,255,0.35)', color: t.blue },
    green: { backgroundColor: 'rgba(62,207,142,0.12)', borderColor: 'rgba(62,207,142,0.35)', color: t.green },
    red: { backgroundColor: 'rgba(255,107,107,0.12)', borderColor: 'rgba(255,107,107,0.35)', color: t.red },
  };
  const base = { backgroundColor: t.surface2, borderColor: t.line, color: t.text2 };
  return [styles.chip, tone ? map[tone] : base];
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 2 },
  appName: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 1, borderRadius: 20, padding: 18 },
  heroLabel: { fontSize: 11, letterSpacing: 2 },
  heroTime: { fontSize: 52, fontWeight: '800', marginTop: 2 },
  heroDate: { fontSize: 13, marginTop: 2 },
  countdown: { fontSize: 12, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { fontSize: 11, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gicon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gname: { fontSize: 15, fontWeight: '700' },
  gsub: { fontSize: 11, marginTop: 1 },
  timePill: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10, gap: 6 },
  timeText: { fontSize: 19, fontWeight: '700' },
  nextBadge: { marginLeft: 'auto', fontSize: 11, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  fab: { alignSelf: 'center', width: 52, height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  fabText: { fontSize: 26, fontWeight: '700' },
});
