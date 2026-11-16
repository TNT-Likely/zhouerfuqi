import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { useGuide } from '@/stores/guide';
import { holidayInfo, refreshHolidays } from '@/services/holidays';
import { exportBackup, importBackup } from '@/services/backup';
import { gateway } from '@/gateway';
import { scheduleTestRing, syncAll } from '@/scheduler/sync';
import { checkUpdate, downloadAndInstall } from '@/services/updater';
import { getVersion, isUpdateSupported } from '../../modules/zf-update/src';
import Constants from 'expo-constants';
import { scheduleRefresher as zfScheduleRefresher } from '../../modules/zf-alarm/src';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const t = useTheme();
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

  const guideDone = steps.every(Boolean);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.text }]}>设置</Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>可靠性</Text>
        {Platform.OS === 'android' ? (
          <Row label="保活向导" sub={guideDone ? '已完成 ✓ · 华为/荣耀必做' : '未完成 · 华为/荣耀机型必做'} arrow onPress={() => router.push('/guide')} />
        ) : null}
        <Row
          label="试响(90 秒后)"
          sub="验证精确闹钟 + 全屏意图触发链"
          arrow
          onPress={() => {
            void scheduleTestRing();
            Alert.alert('已排期', '90 秒后将触发试响闹钟(可锁屏观察)');
          }}
        />
        <Row
          label="权限状态"
          sub={perm ? `通知 ${perm.notifications ? '✓' : '✗'} · 精确闹钟 ${perm.exactAlarms ? '✓' : '需检查'}` : '检测中…'}
          arrow
          onPress={() => {
            void gateway.status().then((p) => {
              setPerm(p);
              if (p && (!p.notifications || !p.exactAlarms)) {
                Alert.alert(
                  '权限不完整',
                  `${p.notifications ? '' : '通知未授权(降级提醒不可用)。'}${p.exactAlarms ? '' : '精确闹钟未授权(响铃不可靠)。'}\n可到系统设置里开启。`,
                  [
                    { text: '知道了', style: 'cancel' },
                    { text: '打开系统设置', onPress: () => void Linking.openSettings() },
                  ],
                );
              }
            });
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

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.cardTitle, { color: t.text3 }]}>关于</Text>
        <Row label="周而复起" sub={`${Constants.expoConfig?.version ?? ver?.versionName ?? 'v0.1.0'} · MIT · github.com/TNT-Likely/zhouerfuqi`} arrow onPress={() => Alert.alert('周而复起', '开源、本地优先的任意班制闹钟。\n规则引擎 @zhouerfuqi/core · Expo RN')} />
      </View>
    </ScrollView>
  );
}

function Row({ label, sub, arrow, onPress }: { label: string; sub: string; arrow?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: t.line }]}>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1 },
});
