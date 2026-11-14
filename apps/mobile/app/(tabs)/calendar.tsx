import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { evaluateDay } from '@core';
import { useGroups } from '@/stores/groups';
import { getHolidayCalendar } from '@/services/holidays';
import { todayISO } from '@/scheduler/materialize';
import { syncAll } from '@/scheduler/sync';
import { cnDate, WD } from '@/lib/labels';
import { useTheme, type Tokens } from '@/theme';

export default function CalendarScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const enabled = groups.filter((g) => g.enabled);
  const cal = getHolidayCalendar();
  const today = todayISO();
  const [selected, setSelected] = useState(today);

  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // JS 0=周日
  const leading = firstDow === 0 ? 7 : firstDow; // ISO:周一为起点

  const cells = useMemo(() => {
    const out: { date: string; day: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d });
    }
    return out;
  }, [y, m, daysInMonth]);

  const evalFor = (date: string) => {
    let ring = false;
    let swap = false;
    let holiday: boolean | undefined;
    let dotCount = 0;
    let hasAmber = false;
    for (const g of enabled) {
      const e = evaluateDay(g, cal, date);
        if (e.ring) {
        ring = true;
        if (e.reason === 'swap-workday') swap = true;
        if (g.times.length > dotCount) {
          dotCount = g.times.filter((x) => !(x.hour === 12 && x.minute === 55)).length;
          hasAmber = g.times.some((x) => x.hour === 12 && x.minute === 55);
        }
      }
      if (e.holiday !== undefined) holiday = e.holiday;
    }
    return { ring, swap, holiday, dotCount, hasAmber };
  };

  const dowOf = (date: string) => {
    const d = new Date(`${date}T00:00:00`).getDay();
    return d === 0 ? 7 : d;
  };

  const selEval = evalFor(selected);
  const selGroupEvals = enabled.map((g) => ({ g, e: evaluateDay(g, cal, selected) }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>响铃日历</Text>
        <Text style={[styles.month, { color: t.text3 }]}>{y}年{m}月</Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={styles.grid}>
          {WD.map((w) => (
            <Text key={w} style={[styles.dow, { color: t.text3 }]}>{w}</Text>
          ))}
          {Array.from({ length: leading - 1 }).map((_, i) => (
            <View key={`b${i}`} />
          ))}
          {cells.map(({ date, day }) => {
            const e = evalFor(date);
            const dowN = dowOf(date);
            const isToday = date === today;
            const big = e.ring && dowN === 6;
            const rest = !e.ring && dowN >= 6;
            let tag = '';
            let tagColor = t.text3;
            if (e.holiday === true) { tag = '假'; tagColor = t.red; }
            else if (e.holiday === false) { tag = '班'; tagColor = t.green; }
            else if (big) { tag = '大周'; tagColor = t.primary; }
            else if (!e.ring && dowN === 6) { tag = '小周'; }
            else if (dowN === 7) { tag = '休'; }
            return (
              <Pressable
                key={date}
                onPress={() => setSelected(date)}
                style={[
                  styles.day,
                  { backgroundColor: rest || !e.ring ? 'transparent' : t.surface },
                  big ? { backgroundColor: 'rgba(255,122,69,0.16)', borderColor: t.primary } : null,
                  isToday ? { borderWidth: 1.5, borderColor: t.blue } : null,
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: big ? '800' : '600', color: big ? t.primary : rest ? t.text3 : t.text2 }}>
                  {day}
                </Text>
                {e.ring ? (
                  <View style={styles.dots}>
                    {Array.from({ length: Math.min(e.dotCount, 3) }).map((_, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: t.blue }]} />
                    ))}
                    {e.hasAmber ? <View style={[styles.dot, { backgroundColor: t.amber }]} /> : null}
                  </View>
                ) : null}
                {tag ? <Text style={[styles.tag, { color: tagColor }]}>{tag}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Legend t={t} color={t.blue} text="班日响铃" />
          <Legend t={t} color={t.primary} text="大周周六" />
          <Legend t={t} color={t.red} text="法定假日" />
          <Legend t={t} color={t.green} text="调休补班" />
        </View>
      </View>

      {/* 当日明细 */}
      <View style={[styles.detail, { backgroundColor: t.surface2, borderColor: t.line }]}>
        <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>
          {cnDate(selected)} 周{WD[dowOf(selected) - 1]} · {selEval.ring ? (selEval.swap ? '补班上班' : '响铃日') : '不响'}
        </Text>
        <Text style={{ color: t.text3, fontSize: 11, marginTop: 4 }}>
          {selEval.holiday === true ? '法定假日 · 联动开启时自动跳过' : selEval.holiday === false ? '调休补班日 · 法定上班' : dowOf(selected) >= 6 ? '周末' : '工作日'}
        </Text>
        <View style={styles.evRow}>
          {selGroupEvals.length === 0 ? (
            <Text style={{ color: t.text3, fontSize: 11 }}>当前没有启用中的班组</Text>
          ) : (
            selGroupEvals.map(({ g, e }) => (
              <View key={g.id} style={{ marginTop: 8 }}>
                <Text style={{ color: t.text2, fontSize: 12 }}>
                  {g.name}:{e.ring ? (e.reason === 'swap-workday' ? '补班响起' : '规则响起') : '跳过'}
                </Text>
                {e.ring ? (
                  <View style={[styles.evRow, { marginTop: 4 }]}>
                    {g.times.map((tm) => (
                      <Text key={tm.id} style={[styles.evPill, { borderColor: t.line, color: t.text2 }]}>
                        {String(tm.hour).padStart(2, '0')}:{String(tm.minute).padStart(2, '0')}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
        <Text style={{ color: t.text3, fontSize: 10, marginTop: 10 }}>
          提示:在编辑页把规则切到「月历」后,点击日历格子即可加入/移出手动排班。
        </Text>
      </View>
    </ScrollView>
  );
}

function Legend({ t, color, text }: { t: Tokens; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: t.text3 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'baseline', paddingTop: 52, paddingHorizontal: 2, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  month: { fontSize: 12, marginLeft: 'auto' },
  card: { borderWidth: 1, borderRadius: 20, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  dow: { fontSize: 10, width: '13.5%', textAlign: 'center', paddingVertical: 4 },
  day: { width: '13.5%', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  tag: { position: 'absolute', top: 2, right: 4, fontSize: 8, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  detail: { borderWidth: 1, borderRadius: 14, padding: 14 },
  evRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  evPill: { fontSize: 11, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
});
