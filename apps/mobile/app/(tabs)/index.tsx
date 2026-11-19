import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDays,
  diffDays,
  evaluateDay,
  isRuleDay,
  isoWeekday,
  nextOccurrences,
} from '@core';
import { useGroups } from '@/stores/groups';
import { getHolidayCalendar } from '@/services/holidays';
import { todayISO } from '@/scheduler/materialize';
import { syncAll } from '@/scheduler/sync';
import { cnDate, WD, ruleDesc, ringReasonLabel } from '@/lib/labels';
import { checkNotificationPermission, requestNotificationPermission } from '@/services/permissions';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const setEnabled = useGroups((s) => s.setEnabled);
  const [notifMissing, setNotifMissing] = useState(false);

  // 主动检测:有启用中的班组但通知权限未授 → 首页横幅引导(不依赖用户去向导里手动标记)
  useEffect(() => {
    const anyEnabled = groups.some((g) => g.enabled);
    void checkNotificationPermission().then((ok) => setNotifMissing(anyEnabled && ok === false));
  }, [groups]);
  const cal = useMemo(() => getHolidayCalendar(), []);

  const next = useMemo(() => {
    const enabled = groups.filter((g) => g.enabled);
    if (!enabled.length) return null;
    return nextOccurrences(enabled, cal, todayISO());
  }, [groups, cal]);
  const first = next?.[0];
  const nextGroup = first ? groups.find((g) => g.id === first.groupId) : undefined;
  const d = first ? diffDays(first.date, todayISO()) : null;
  const countdown = d === null ? '' : d === 0 ? '今天响' : d === 1 ? '明天破晓响铃' : `${d} 天后破晓响铃`;

  /** 七日节律带:以「下次响铃所属班组」为参照评估未来 7 天 */
  const strip = useMemo(() => {
    const today = todayISO();
    const refGroup = nextGroup ?? groups.find((g) => g.enabled) ?? null;
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      const w = isoWeekday(date);
      const ev = refGroup && refGroup.enabled ? evaluateDay(refGroup, cal, date) : null;
      const ring = ev?.ring ?? false;
      const holiday = ev?.holiday;
      let badge = '休';
      let bCls: '' | 'ring' | 'hol' | 'swap' = '';
      if (holiday === true && !ring) {
        badge = '假';
        bCls = 'hol';
      } else if (ev?.reason === 'swap-workday') {
        badge = '补班';
        bCls = 'swap';
      } else if (
        ring &&
        w === 6 &&
        refGroup?.rule.kind === 'everyNWeeks' &&
        isRuleDay(refGroup.rule, date) &&
        isoWeekday(refGroup.rule.anchor) === 6
      ) {
        badge = '大周';
        bCls = 'ring';
      } else if (!ring && w === 6 && refGroup?.rule.kind === 'everyNWeeks') {
        badge = '小周';
      } else if (ring) {
        badge = '响';
        bCls = 'ring';
      }
      return {
        date,
        num: Number(date.slice(8)),
        wd: w,
        badge,
        bCls,
        ring,
        isNext: first ? first.date === date : false,
      };
    });
  }, [groups, nextGroup, first, cal]);

  /** 七段周循环环:7 个弧点围绕圆心,高亮下次响铃所在星期(RN 无 svg 依赖,View 级实现) */
  const dial = useMemo(() => {
    const R = 30;
    const nextWd = first ? isoWeekday(first.date) : null;
    return Array.from({ length: 7 }, (_, i) => {
      const ang = ((-90 + i * (360 / 7)) * Math.PI) / 180;
      return {
        active: nextWd === i + 1,
        x: R + R * Math.cos(ang),
        y: R + R * Math.sin(ang),
      };
    });
  }, [first]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={styles.appbar}>
        <View style={[styles.miniDial, { backgroundColor: t.heroBg }]}>
          <Ionicons name="alarm-outline" size={17} color={t.primary} />
        </View>
        <Text style={[styles.appName, { color: t.text }]}>周而复起</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={[styles.iconBtn, { backgroundColor: t.surface2 }]} onPress={() => router.push('/group/new')} accessibilityLabel="新建班组">
          <Ionicons name="add" size={18} color={t.text2} />
        </Pressable>
        <Pressable style={[styles.iconBtn, { backgroundColor: t.surface2 }]} onPress={() => router.push('/guide')} accessibilityLabel="保活向导">
          <Ionicons name="shield-checkmark-outline" size={17} color={t.text2} />
        </Pressable>
      </View>

      {/* 主动权限横幅:检测到未授权时引导,点击拉起系统弹窗 */}
      {notifMissing ? (
        <Pressable
          style={[styles.permBanner, { backgroundColor: t.heroBg, borderColor: t.red }]}
          onPress={() => {
            void requestNotificationPermission().then((ok) => setNotifMissing(!ok));
          }}
        >
          <Ionicons name="notifications-off-outline" size={16} color={t.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 12.5, fontWeight: '700' }}>响铃通知未授权</Text>
            <Text style={{ color: t.text2, fontSize: 11, marginTop: 2 }}>点此授权,否则闹钟只静默不提醒 · 点「允许」即可</Text>
          </View>
          <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>去授权</Text>
        </Pressable>
      ) : null}

      {/* Hero:下次响铃 + 七日节律带 */}
      <View style={[styles.hero, { backgroundColor: t.heroBg, borderColor: t.heroBorder }]}>
        <View style={styles.heroHead}>
          <View style={styles.livePill}>
            <View style={[styles.liveDot, { backgroundColor: t.primary }]} />
            <Text style={{ color: t.primary, fontSize: 11, fontWeight: '700' }}>{countdown || '待命'}</Text>
          </View>
          <Text style={{ color: t.text3, fontSize: 10 }}>holiday-cn 联动</Text>
        </View>
        <View style={styles.heroMain}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTime, { color: t.text }]}>
              {first
                ? `${String(first.hour).padStart(2, '0')}:${String(first.minute).padStart(2, '0')}`
                : '—:—'}
              {first ? <Text style={{ fontSize: 18, color: t.primary, fontWeight: '800' }}> ×{next.length}</Text> : null}
            </Text>
            <View style={styles.chips}>
              <Text style={[styles.chip, { backgroundColor: t.accentSoft, color: t.text, fontWeight: '600' }]}>
                {first ? `${cnDate(first.date)} 周${WD[isoWeekday(first.date) - 1]}` : '开启任意班组以排期'}
              </Text>
              {first && nextGroup ? (
                <Text style={[styles.chip, { backgroundColor: t.accentSoft, color: t.primary, fontWeight: '700' }]}>
                  {ringReasonLabel(nextGroup, first.date, isoWeekday(first.date))}
                </Text>
              ) : null}
              {first ? (
                <Text style={[styles.chip, { backgroundColor: t.accentSoft, color: t.text2 }]}>连环 ×{next.length}</Text>
              ) : null}
            </View>
          </View>
          {/* 七段周环 */}
          <View style={[styles.cycleRing, { backgroundColor: t.accentSoft }]}>
            <View style={styles.dialAbs}>
              {dial.map((seg, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: seg.x - 2.6,
                    top: seg.y - 2.6,
                    width: seg.active ? 5.2 : 4,
                    height: seg.active ? 5.2 : 4,
                    borderRadius: 3,
                    backgroundColor: seg.active ? t.primary : t.text3,
                    opacity: seg.active ? 1 : 0.55,
                  }}
                />
              ))}
              <View style={styles.dialCenter}>
                <Text style={{ color: t.text, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
                  {first ? `周${WD[isoWeekday(first.date) - 1]}` : 'OFF'}
                  {first ? '\n' : ''}
                  {first ? <Text style={{ fontSize: 8, color: t.text3, fontWeight: '600' }}>NEXT</Text> : null}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {/* 七日节律带 */}
        <View style={styles.weekStrip}>
          {strip.map((c) => (
            <View key={c.date} style={[styles.wsCell, c.isNext ? { backgroundColor: t.accentSoft, borderRadius: 12 } : null]}>
              <Text style={[styles.wsWd, { color: c.isNext ? t.primary : t.text3, fontWeight: c.isNext ? '800' : '400' }]}>
                {c.date === strip[0]!.date ? '今' : WD[c.wd - 1]}
              </Text>
              <Text style={[styles.wsNum, { color: c.ring ? t.text : t.text3, fontWeight: c.ring ? '800' : '500' }]}>{c.num}</Text>
              <Text
                style={[
                  styles.wsBadge,
                  c.bCls === 'ring' ? { color: t.primary, fontWeight: '800' } : null,
                  c.bCls === 'hol' ? { color: t.text3 } : null,
                  c.bCls === 'swap' ? { color: t.green, fontWeight: '700' } : null,
                ]}
              >
                {c.badge}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: t.text3 }]}>排班闹钟组 · {groups.length}</Text>

      {groups.map((g) => (
        <View key={g.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, opacity: g.enabled ? 1 : 0.55 }]}>
          <View style={styles.groupHead}>
            <View style={[styles.gicon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="alarm-outline" size={19} color={t.primary} />
            </View>
            <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/group/${g.id}`)}>
              <View style={styles.gnameRow}>
                <Text style={[styles.gname, { color: t.text }]}>{g.name}</Text>
                {g.holidayMode !== 'raw' ? (
                  <Text style={[styles.gtag, { backgroundColor: t.accentSoft, color: t.primary }]}>智能节假</Text>
                ) : null}
              </View>
              <Text style={[styles.gsub, { color: t.text2 }]}>
                {ruleDesc(g)} · {g.times.length} 道响铃
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
          {/* 连环闹钟胶囊 · 双列 */}
          <View style={styles.pillGrid}>
            {g.times.map((tm, idx) => {
              const isNext = g.enabled && first && first.groupId === g.id && first.hour === tm.hour && first.minute === tm.minute;
              return (
                <View
                  key={tm.id}
                  style={[
                    styles.timePill,
                    { backgroundColor: t.surface2, borderColor: idx === 0 && g.enabled ? t.primary : 'transparent' },
                  ]}
                >
                  <Text style={[styles.tpClock, { color: isNext ? t.primary : t.text }]}>
                    {String(tm.hour).padStart(2, '0')}:{String(tm.minute).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.tpLabel, { color: t.text3 }]}>{tm.label || (idx === 0 ? '首道' : ' ')}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable style={[styles.addCard, { borderColor: t.text3 }]} onPress={() => router.push('/group/new')}>
        <Ionicons name="add" size={15} color={t.text2} />
        <Text style={{ color: t.text2, fontSize: 13 }}>新建排班闹钟组</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 2, gap: 10 },
  miniDial: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 1, borderRadius: 22, padding: 16 },
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 16, padding: 12,
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTime: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { fontSize: 11, lineHeight: 13, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  cycleRing: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  dialAbs: { width: 60, height: 60 },
  dialCenter: { position: 'absolute', left: 12, top: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  weekStrip: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: 16, padding: 8,
  },
  wsCell: { alignItems: 'center', gap: 3, flex: 1, paddingVertical: 5 },
  wsWd: { fontSize: 10 },
  wsNum: { fontSize: 14, fontVariant: ['tabular-nums'] },
  wsBadge: { fontSize: 9.5, color: '#9CA3AF' },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, marginHorizontal: 2, marginTop: 8, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 22, padding: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 10 },
  gicon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gnameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  gname: { fontSize: 14, fontWeight: '700' },
  gtag: { fontSize: 9.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', fontWeight: '700' },
  gsub: { fontSize: 11, marginTop: 2 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  timePill: {
    flexGrow: 1, minWidth: '30%', maxWidth: '48.5%',
    borderWidth: 1.5, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  tpClock: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  tpLabel: { fontSize: 10, marginTop: 2 },
  addCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', minHeight: 52, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, marginTop: 4,
  },
});
