import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { diffDays, nextOccurrences } from '@core';
import { useGroups } from '@/stores/groups';
import { getHolidayCalendar } from '@/services/holidays';
import { todayISO } from '@/scheduler/materialize';
import { syncAll } from '@/scheduler/sync';
import { cnDate, WD, ruleDesc, ringReasonLabel } from '@/lib/labels';
import { useTheme } from '@/theme';

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
        <Pressable style={[styles.iconBtn, { backgroundColor: t.surface2 }]} onPress={() => router.push('/group/new')} accessibilityLabel="新建班组">
          <Ionicons name="add" size={18} color={t.text2} />
        </Pressable>
        <Pressable style={[styles.iconBtn, { backgroundColor: t.surface2 }]} onPress={() => router.push('/guide')} accessibilityLabel="保活向导">
          <Ionicons name="shield-checkmark-outline" size={17} color={t.text2} />
        </Pressable>
      </View>

      {/* Hero:主题色淡染卡 */}
      <View style={[styles.hero, { backgroundColor: t.heroBg, borderColor: t.heroBorder }]}>
        <Text style={[styles.heroLabel, { color: t.primary }]}>下次响铃 · NEXT RING</Text>
        {first && nextGroup ? (
          <>
            <Text style={[styles.heroTime, { color: t.text }]}>
              {`${String(first.hour).padStart(2, '0')}:${String(first.minute).padStart(2, '0')}`}
              <Text style={{ fontSize: 20, color: t.primary, fontWeight: '700' }}> ×{next.length}</Text>
            </Text>
            <Text style={[styles.heroDate, { color: t.text2 }]}>
              {cnDate(first.date)} 周{WD[dowISO(first.date) - 1]}
            </Text>
            <View style={styles.chips}>
              <Text style={[styles.chip, { backgroundColor: t.accentSoft, color: t.primary, fontWeight: '600' }]}>
                {ringReasonLabel(nextGroup, first.date, dowISO(first.date))}
              </Text>
              {first.reason === 'swap-workday' && (
                <Text style={[styles.chip, { backgroundColor: t.accentSoft, color: t.green }]}>补班自动响起</Text>
              )}
            </View>
            <Text style={[styles.countdown, { color: t.text2 }]}>{countdown}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.heroTime, { color: t.text }]}>— —</Text>
            <Text style={[styles.heroDate, { color: t.text3 }]}>
              {groups.some((g) => g.enabled) ? '当前规则 370 天内无响铃' : '所有班组已停用'}
            </Text>
          </>
        )}
      </View>

      <Text style={[styles.sectionLabel, { color: t.text3 }]}>班组 · GROUPS</Text>

      {groups.map((g) => (
        <View key={g.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, opacity: g.enabled ? 1 : 0.55 }]}>
          <View style={styles.groupHead}>
            <View style={[styles.gicon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="alarm-outline" size={19} color={t.primary} />
            </View>
            <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/group/${g.id}`)}>
              <Text style={[styles.gname, { color: t.text }]}>{g.name}</Text>
              <Text style={[styles.gsub, { color: t.text2 }]}>
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
          <View style={styles.rows}>
            {g.times.map((tm) => (
              <View key={tm.id} style={styles.rowitem}>
                <View style={[styles.rowdesc, { borderBottomColor: t.line }]}>
                  <Text style={[styles.rowtime, { color: t.text }]}>
                    {String(tm.hour).padStart(2, '0')}:{String(tm.minute).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.rowmeta, { color: t.text2 }]}>{tm.label || ' '}</Text>
                </View>
                {g.enabled && first && first.groupId === g.id ? (
                  <Text style={[styles.nextBadge, { color: t.primary }]}>{cnDate(first.date)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      <Pressable style={[styles.addCard, { borderColor: t.text3 }]} onPress={() => router.push('/group/new')}>
        <Ionicons name="add" size={15} color={t.text2} />
        <Text style={{ color: t.text2, fontSize: 13 }}>新建班组</Text>
      </Pressable>
    </ScrollView>
  );
}

function dowISO(date: string): number {
  const d = new Date(`${date}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 2, gap: 10 },
  appName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 1, borderRadius: 22, padding: 17 },
  heroLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  heroTime: { fontSize: 44, fontWeight: '700', letterSpacing: -1.6, marginTop: 2 },
  heroDate: { fontSize: 13, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: { fontSize: 11, lineHeight: 13, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  countdown: { fontSize: 12, marginTop: 12 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, marginHorizontal: 2, marginTop: 8, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 22, padding: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 10 },
  gicon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gname: { fontSize: 14, fontWeight: '600' },
  gsub: { fontSize: 11, marginTop: 2 },
  rows: { marginTop: 2 },
  rowitem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 10 },
  rowdesc: { flex: 1, minWidth: 0, paddingVertical: 10, borderBottomWidth: 1 },
  rowtime: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowmeta: { fontSize: 11, marginTop: 3 },
  nextBadge: { fontSize: 12, fontWeight: '600' },
  addCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', minHeight: 52, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, marginTop: 4,
  },
});
