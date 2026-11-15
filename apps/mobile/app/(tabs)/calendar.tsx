import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { evaluateDay, isRuleDay, type AlarmGroup, type Weekday } from '@core';
import { useGroups } from '@/stores/groups';
import { getHolidayCalendar } from '@/services/holidays';
import { todayISO } from '@/scheduler/materialize';
import { syncAll } from '@/scheduler/sync';
import { cnDate, WD } from '@/lib/labels';
import { useTheme, type Tokens } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

function monthMeta(y: number, m: number) {
  return { days: new Date(y, m, 0).getDate(), firstDow: (() => { const w = new Date(y, m - 1, 1).getDay(); return w === 0 ? 7 : w; })() };
}
function dowOf(date: string): number {
  const d = new Date(`${date}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

export default function CalendarScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const upsert = useGroups((s) => s.upsert);
  const g = groups[0]; // 排班月历编辑的班组
  const now = new Date();
  const [cal, setCal] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [mode, setMode] = useState<'rule' | 'manual'>('rule');
  const [sel, setSel] = useState(todayISO());

  const manual = g?.rule.kind === 'customDates';
  const editing = !!g && manual && mode === 'manual' && g.enabled;
  const dates = new Set<string>(g && g.rule.kind === 'customDates' ? g.rule.dates : []);
  const y = cal.y, m = cal.m;
  const { days, firstDow } = monthMeta(y, m);
  const today = todayISO();

  const setRuleDates = (fn: (set: Set<string>) => void) => {
    if (!g) return;
    const set = new Set(dates);
    fn(set);
    upsert({ ...g, rule: { kind: 'customDates', dates: [...set].sort() } });
    void syncAll();
  };
  const enterManual = () => {
    if (!g) return;
    if (g.rule.kind !== 'customDates') {
      // 进入手动排班:把可见月份的规则响铃日(今天起)播种为点选起点
      const seed = new Set<string>();
      for (let d = 1; d <= days; d++) {
        const date = `${y}-${pad(m)}-${pad(d)}`;
        if (date >= today && isRuleDay(g.rule, date)) seed.add(date);
      }
      upsert({ ...g, rule: { kind: 'customDates', dates: [...seed].sort() } });
      void syncAll();
    }
    setMode('manual');
  };

  const cells: { date: string; day: number }[] = [];
  for (let d = 1; d <= days; d++) cells.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d });

  const evFor = (date: string) => evaluateDay(g ?? { id: '', name: '', enabled: true, times: [], rule: { kind: 'weekly', weekdays: [1,2,3,4,5] } }, getHolidayCalendar(), date);

  const selEv = g ? evaluateDay(g, getHolidayCalendar(), sel) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={styles.topbar}>
        <Text style={[styles.title, { color: t.text }]}>排班月历</Text>
        <Text style={{ fontSize: 11, color: t.text2 }}>
          {editing ? '手动排班 · 编辑中' : manual ? '手动排班 · 预览' : '规则预览'}
        </Text>
      </View>

      {/* 模式切换 */}
      <View style={[styles.mode, { backgroundColor: t.surface2 }]}>
        <Pressable style={[styles.modeBtn, mode === 'rule' && { backgroundColor: t.surface }]} onPress={() => setMode('rule')}>
          <Text style={{ fontSize: 12, color: mode === 'rule' ? t.text : t.text3, fontWeight: mode === 'rule' ? '600' : '400' }}>规则预览</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === 'manual' && { backgroundColor: t.surface }]} onPress={() => { mode === 'rule' ? enterManual() : setMode('manual'); }}>
          <Text style={{ fontSize: 12, color: mode === 'manual' ? t.text : t.text3, fontWeight: mode === 'manual' ? '600' : '400' }}>手动排班</Text>
        </Pressable>
      </View>

      {/* 月份导航 */}
      <View style={styles.calHead}>
        <Pressable style={[styles.calNav, { backgroundColor: t.surface2 }]} onPress={() => setCal(c => ({ y: c.m === 1 ? c.y - 1 : c.y, m: c.m === 1 ? 12 : c.m - 1 }))}>
          <Ionicons name="chevron-back" size={16} color={t.text2} />
        </Pressable>
        <Text style={[styles.calTitle, { color: t.text }]}>
          {y}年{m}月
          {y === now.getFullYear() && m === now.getMonth() + 1 && <Text style={{ color: t.primary, fontSize: 11, fontWeight: '600' }}>  本月</Text>}
        </Text>
        <Pressable style={[styles.calNav, { backgroundColor: t.surface2 }]} onPress={() => setCal(c => ({ y: c.m === 12 ? c.y + 1 : c.y, m: c.m === 12 ? 1 : c.m + 1 }))}>
          <Ionicons name="chevron-forward" size={16} color={t.text2} />
        </Pressable>
        <Pressable style={[styles.calNav, { backgroundColor: t.surface2 }]} onPress={() => setCal({ y: now.getFullYear(), m: now.getMonth() + 1 })}>
          <Ionicons name="calendar-clear-outline" size={15} color={t.text2} />
        </Pressable>
      </View>

      {/* 快捷填充(手动排班编辑中) */}
      {editing && (
        <View style={styles.quick}>
          <Pressable style={[styles.quickBtn, { backgroundColor: t.surface2 }]} onPress={() => setRuleDates(set => { for (let d = 1; d <= days; d++) { const date = `${y}-${pad(m)}-${pad(d)}`; if (dowOf(date) <= 5) set.add(date); } })}>
            <Text style={{ fontSize: 12, color: t.text }}>填充工作日</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: t.surface2 }]} onPress={() => setRuleDates(set => { for (let d = 1; d <= days; d++) set.add(`${y}-${pad(m)}-${pad(d)}`); })}>
            <Text style={{ fontSize: 12, color: t.text }}>填充全月</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: t.surface2 }]} onPress={() => setRuleDates(set => { for (let d = 1; d <= days; d++) set.delete(`${y}-${pad(m)}-${pad(d)}`); })}>
            <Text style={{ fontSize: 12, color: t.text }}>清空本月</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: t.surface2 }]} onPress={() => setRuleDates(set => set.clear())}>
            <Text style={{ fontSize: 12, color: t.text }}>清空全部点选</Text>
          </Pressable>
        </View>
      )}

      {/* 月历 */}
      <View style={[styles.cal, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={styles.grid}>
          {WD.map(w => <Text key={w} style={[styles.dow, { color: t.text2 }]}>{w}</Text>)}
          {Array.from({ length: firstDow - 1 }).map((_, i) => <View key={`b${i}`} />)}
          {cells.map(({ date, day }) => {
            const ev = g ? evaluateDay(g, getHolidayCalendar(), date) : null;
            const ring = !!g && g.enabled && !!ev?.ring;
            const picked = dates.has(date);
            const w = dowOf(date);
            const isToday = date === today;
            const isSel = sel === date;
            let tag = ''; let tagColor = t.text2;
            if (editing) {
              if (picked) { tag = '✓'; tagColor = t.primary; }
              else if (ev?.holiday === true) { tag = '假'; tagColor = t.red; }
            } else if (ev) {
              if (ev.holiday === true) { tag = '假'; tagColor = t.red; }
              else if (ev.holiday === false && ring) { tag = '班'; tagColor = t.green; }
              else if (ring && g?.rule.kind === 'everyNWeeks' && w === dowOf(g.rule.anchor)) { tag = '大周'; tagColor = t.primary; }
              else if (!ring && w === 6) { tag = '小周'; }
              else if (!ring && w === 7) { tag = '休'; }
            }
            const dotCount = ring && g ? g.times.length : 0;
            return (
              <Pressable
                key={date}
                onPress={() => {
                  if (editing) { setRuleDates(set => { set.has(date) ? set.delete(date) : set.add(date); }); }
                  else setSel(date);
                }}
                style={[
                  styles.day,
                  { backgroundColor: restBg(restFlag(!editing, ring, w)) },
                  picked ? styles.picked : null,
                  isSel && !picked ? styles.selSolid : null,
                  ev?.holiday === true && !picked && !editing ? styles.dim : null,
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: isSel || picked ? '700' : '600', color: isSel ? '#fff' : restFlag(!editing, ring, w) ? t.text3 : t.text }}>
                  {day}
                </Text>
                {ring ? (
                  <View style={styles.dots}>
                    {Array.from({ length: Math.min(dotCount, 4) }).map((_, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: t.primary }]} />
                    ))}
                  </View>
                ) : null}
                {tag ? <Text style={[styles.tag, { color: tagColor }]}>{tag}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Legend t={t} color={t.primary} text="班日响铃" />
          <Legend t={t} color={t.primary} text="大周周六" />
          <Legend t={t} color={t.red} text="法定假日" />
          <Legend t={t} color={t.green} text="调休补班" />
          <Legend t={t} color={t.primary} text="手动点选" />
        </View>
      </View>

      {/* 当日明细 */}
      <View style={[styles.detail, { backgroundColor: t.surface2 }]}>
        {(() => {
          if (!g) return null;
          const ev = evaluateDay(g, getHolidayCalendar(), sel);
          const ring = g.enabled && ev.ring;
          const editingNow = editing;
          let st: string;
          if (editingNow) st = dates.has(sel) ? '已加入排班(点选即权威,不受节假日影响)' : '未排班 · 点击上方格子加入';
          else if (ev.holiday === true) st = '法定假日 · 联动开启时自动跳过';
          else if (ev.holiday === false) st = '调休补班日 · 法定上班';
          else if (dowOf(sel) >= 6) st = '周末';
          else st = '工作日';
          if (ring && ev.reason === 'swap-workday') st += ' · 补班自动响起';
          return (
            <>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>
                {cnDate(sel)} 周{WD[dowOf(sel) - 1]} · {ring ? (ev.reason === 'swap-workday' ? '补班上班' : ring && g.rule.kind === 'everyNWeeks' && dowOf(sel) === 6 ? '大周周六' : '响铃日') : editingNow ? '未点选' : '不响'}
              </Text>
              <Text style={{ color: t.text2, fontSize: 11, marginTop: 4 }}>{st}</Text>
              {ring ? (
                <View style={styles.ev}>
                  {g.times.map(x => (
                    <Text key={x.id} style={[styles.evPill, { borderColor: t.line, color: t.text2 }]}>
                      {String(x.hour).padStart(2, '0')}:{String(x.minute).padStart(2, '0')}{x.label ? ` ${x.label}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          );
        })()}
      </View>
    </ScrollView>
  );
}

function restFlag(isPreview: boolean, ring: boolean, w: number): boolean {
  return isPreview && !ring && w >= 6;
}
function restBg(rest: boolean): string | undefined {
  return rest ? 'transparent' : undefined;
}
function Legend({ t, color, text }: { t: Tokens; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: t.text2 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 2, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  mode: { flexDirection: 'row', borderRadius: 14, padding: 3, gap: 2 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, minHeight: 44 },
  calNav: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  cal: { borderWidth: 1, borderRadius: 22, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  dow: { fontSize: 10, width: '13.2%', textAlign: 'center', paddingVertical: 4 },
  day: { width: '13.2%', height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
  picked: { shadowColor: '#1677FF', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, borderWidth: 2, borderColor: '#1677FF' },
  selSolid: {},
  dim: { opacity: 0.4 },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  tag: { position: 'absolute', top: 2, right: 5, fontSize: 8, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingHorizontal: 2 },
  detail: { borderRadius: 16, padding: 14, minHeight: 78 },
  ev: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  evPill: { fontSize: 11, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
});
