import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGuide } from '@/stores/guide';
import { holidayInfo, refreshHolidays } from '@/services/holidays';
import { exportBackup, importBackup } from '@/services/backup';
import { gateway } from '@/gateway';
import { scheduleTestRing, syncAll } from '@/scheduler/sync';
import { checkUpdate, downloadAndInstall } from '@/services/updater';
import { getVersion, isUpdateSupported } from '../modules/zf-update/src';
import Constants from 'expo-constants';
import { scheduleRefresher as zfScheduleRefresher } from '../modules/zf-alarm/src';
import { useTheme, THEME_COLORS } from '@/theme';
import { usePrefs } from '@/stores/prefs';
import { useColorScheme } from 'react-native';
import { requestNotificationPermission } from '@/services/permissions';
import { Sheet } from '@/components/Sheet';

export default function SettingsScreen() {
  const t = useTheme();
  const scheme = useColorScheme();
  const { themeIdx, setThemeIdx, mode, setMode, avatarEmoji, setAvatarEmoji } = usePrefs();
  const effectiveScheme = mode === 'system' ? (scheme === 'light' ? 'light' : 'dark') : mode;
  const steps = useGuide((s) => s.steps);
  const info = holidayInfo();
  const [perm, setPerm] = useState<{ notifications: boolean; exactAlarms: boolean } | null>(null);
  const [ver, setVer] = useState<{ versionName: string; versionCode: number } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    gateway.status().then(setPerm).catch(() => setPerm(null));
    try {
      setVer(getVersion());
    } catch {
      setVer(null);
    }
  }, []);

  const onCheckUpdate = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const r = await checkUpdate();
      if (r.status === 'available') {
        Alert.alert(
          `发现新版本 ${r.info.versionName}`,
          `${r.info.notes || ' improvements'}\n\n当前 ${r.current.versionName} → 新版 ${r.info.versionName}`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '下载并安装',
              onPress: () => {
                void downloadAndInstall(r.info)
                  .then(() => {
                    Alert.alert('下载完成', '系统安装器已弹出,按提示安装即可(安装完成后请打开新版本)');
                  })
                  .catch((e: any) => Alert.alert('更新失败', e?.message ?? String(e)));
              },
            },
          ],
        );
      } else if (r.status === 'up-to-date') {
        Alert.alert('已是最新', `当前 ${r.current.versionName}(versionCode ${r.current.versionCode})`);
      } else {
        Alert.alert('检查失败', r.error);
      }
    } finally {
      setChecking(false);
    }
  };



  return (
    <Sheet title="设置">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>可靠性</Text>
        {Platform.OS === 'android' ? (
          <Row label="保活向导" sub="响铃可靠性检查:权限 / 电池豁免 / 厂商设置" arrow onPress={() => router.push('/guide')} />
        ) : null}
        <Row
          label="试响(30 秒后)"
          sub="验证精确闹钟 + 全屏意图触发链"
          arrow
          onPress={() => {
            void scheduleTestRing();
            Alert.alert('已排期', '30 秒后将触发试响闹钟(可锁屏观察)');
          }}
        />
        <Row
          label="权限状态"
          sub={perm ? `通知 ${perm.notifications ? '✓' : '✗'} · 精确闹钟 ${perm.exactAlarms ? '✓' : '需检查'}` : '检测中…'}
          arrow
          onPress={() => {
            // 主动申请机制:缺什么直接拉系统弹窗;被永久拒绝才引导去系统设置
            void (async () => {
              const p = await gateway.status();
              setPerm(p);
              if (p && (!p.notifications || !p.exactAlarms)) {
                if (!p.notifications) {
                  const ok = await requestNotificationPermission();
                  const after = await gateway.status();
                  setPerm(after);
                  if (ok || after.notifications) {
                    Alert.alert('已授权', '响铃提醒通知已开启。');
                    return;
                  }
                }
                Alert.alert(
                  '权限不完整',
                  `${p.notifications ? '' : '通知未授权(降级提醒不可用)。'}${p.exactAlarms ? '' : '精确闹钟未授权(响铃不可靠)。'}\n系统弹窗已被永久拒绝,请到应用详情里手动开启。`,
                  [
                    { text: '知道了', style: 'cancel' },
                    { text: '打开系统设置', onPress: () => Linking.openSettings() },
                  ],
                );
              } else {
                Alert.alert('权限完整', '通知与精确闹钟均已授权,响铃可达系统时钟级可靠性。');
              }
            })();
          }}
        />
        <Row label="立即重排" sub="规则变更后通常自动执行;此按钮用于排查" arrow onPress={() => void syncAll().then(() => Alert.alert('已重排', '未来 14 天的响铃已同步到系统'))} />
        {Platform.OS === 'android' && __DEV__ ? (
          <Row label="注册 03:30 刷新器(调试)"
            sub="单独调用原生 scheduleRefresher,验证注册链路"
            arrow onPress={() => {
              try {
                zfScheduleRefresher(3, 30);
                Alert.alert('已注册', '03:30 刷新器已提交系统(dumpsys 可验)');
              } catch (e: any) {
                Alert.alert('注册失败', e?.message ?? String(e));
              }
            }} />
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>数据</Text>
        <Row
          label="法定节假日"
          sub={`${info.source} · ${info.years.join('/')} 年 · ${info.days} 天`}
          arrow
          onPress={() => {
            Alert.alert(
              '节假日数据',
              `${info.years.join('、')} 年共 ${info.days} 天(holiday-cn 快照)。\n每年 11-12 月国务院发布次年安排后,可在此检查更新。`,
              [
                { text: '知道了', style: 'cancel' },
                {
                  text: '检查新年份',
                  onPress: () => {
                    void refreshHolidays().then((added) =>
                      Alert.alert(added ? '已更新' : '暂无更新', added ? '新年度节假日已下载并生效。' : '下一年度安排尚未发布(通常 11-12 月发布),发布后这里会自动拉取。'),
                    );
                  },
                },
              ],
            );
          }}
        />
        <Row
          label="导出备份"
          sub="排班 + 保活向导 → JSON 分享面板"
          arrow
          onPress={() => {
            void exportBackup(Constants.expoConfig?.version).catch((e: any) =>
              Alert.alert('导出失败', e?.message ?? String(e)),
            );
          }}
        />
        <Row
          label="导入恢复"
          sub="选择备份 JSON,整量替换当前排班"
          arrow
          onPress={() => {
            void importBackup()
              .then((n) => {
                if (n > 0) Alert.alert('已恢复', `导入 ${n} 条排班,系统闹钟已重排。`);
              })
              .catch((e: any) => Alert.alert('导入失败', e?.message ?? String(e)));
          }}
        />
      </View>

      {isUpdateSupported() ? (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>应用更新</Text>
        <Row
          label={checking ? '检查中…' : '检查更新'}
          sub={ver ? `当前 ${ver.versionName}(versionCode ${ver.versionCode})· 源:GitHub Releases` : '读取版本中…'}
          arrow
          onPress={() => void onCheckUpdate()}
        />
      </View>
      ) : (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>应用更新</Text>
        <Row label="随版本安装" sub="iOS 当前以安装包/TestFlight 分发,更新随新包进行" />
      </View>
      )}

      {/* 外观 · 模式 + 主题色(参考 design v2.0 色板) */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>外观</Text>
        <View style={styles.modeSeg}>
          {([
            { k: 'system', label: '跟随系统' },
            { k: 'light', label: '日间' },
            { k: 'dark', label: '暗黑' },
          ] as const).map((m) => {
            const on = mode === m.k;
            return (
              <Pressable
                key={m.k}
                onPress={() => setMode(m.k)}
                style={[styles.modeItem, on ? { backgroundColor: t.primary } : { backgroundColor: t.surface2 }]}
              >
                <Text style={{ fontSize: 12, color: on ? t.onPrimary : t.text2, fontWeight: on ? '800' : '400' }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.cardTitle, { color: t.text3, marginTop: 16 }]}>主题色</Text>
        <View style={styles.swatchRow}>
          {THEME_COLORS.map((s, i) => {
            const selected = themeIdx === i;
            const color = effectiveScheme === 'light' ? s.light : s.dark;
            return (
              <Pressable
                key={s.name}
                onPress={() => setThemeIdx(i)}
                style={styles.swatchItem}
                accessibilityLabel={`主题色 ${s.name}`}
              >
                <View
                  style={[
                    styles.swatchDot,
                    { backgroundColor: color, borderColor: selected ? t.text : t.line },
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
                <Text style={{ fontSize: 10, color: selected ? t.text : t.text3, fontWeight: selected ? '700' : '400' }}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 个人 · 头像 + 语言 */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>个人</Text>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarPreview, { backgroundColor: t.heroBg, borderColor: t.heroBorder }]}>
            <Text style={{ fontSize: 30 }}>{avatarEmoji}</Text>
          </View>
          <View style={styles.avatarChoices}>
            {['⏰', '🌅', '🔥', '🌙', '☕', '🦉'].map((e) => {
              const on = avatarEmoji === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => setAvatarEmoji(e)}
                  style={[styles.avatarChoice, { backgroundColor: on ? t.accentSoft : t.surface2, borderColor: on ? t.primary : t.line }]}
                >
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>语言 · Language</Text>
        <Row label="简体中文" sub="当前语言 · 更多语言规划中" arrow={false} />
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>关于</Text>
        <Row label="周而复起" sub={`v${Constants.expoConfig?.version ?? ''} · MIT 开源 · 设计与规则引擎自研`} arrow onPress={() => router.push('/about')} />
      </View>
      </ScrollView>
    </Sheet>
  );
}

function Row({ label, sub, arrow, onPress }: { label: string; sub: string; arrow?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: t.text3, fontSize: 11, marginTop: 3 }}>{sub}</Text>
      </View>
      {arrow ? <Text style={{ color: t.text3 }}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  title: { fontSize: 18, fontWeight: '800', paddingTop: 52, paddingHorizontal: 2 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  cardTitle: { fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  modeSeg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  modeItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarPreview: { width: 62, height: 62, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarChoices: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarChoice: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 },
  swatchItem: { alignItems: 'center', gap: 6 },
  swatchDot: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
});
