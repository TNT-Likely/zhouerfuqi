import { View, Text, ScrollView, Pressable, Image, Platform, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme';
import { useGroups } from '@/stores/groups';
import { holidayInfo } from '@/services/holidays';

const REPO = 'https://github.com/TNT-Likely/zhouerfuqi';

/** v2.1 关于页:破晓英雄卡 + 实时数据芯片 + 社区链接 + 技术声明(设计稿 07 号屏) */
export default function AboutScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const info = holidayInfo();
  const enabled = groups.filter((g) => g.enabled).length;
  const times = groups.filter((g) => g.enabled).reduce((n, g) => n + g.times.length, 0);
  const ver = Constants.expoConfig?.version ?? '0.2.7';

  const joinBeta =
    Platform.OS === 'ios'
      ? 'https://testflight.apple.com/join/9vNcHgha'
      : `${REPO}/issues/1`;

  const stats = [
    { n: String(enabled), label: '启用排班组' },
    { n: String(times), label: '连环响铃道数' },
    { n: `${info.days} 天`, label: '离线假日库' },
  ];

  const links = [
    {
      icon: 'logo-github' as const,
      label: 'GitHub 仓库',
      sub: 'github.com/TNT-Likely/zhouerfuqi · 点 Star 支持开发',
      url: REPO,
    },
    {
      icon: 'chatbubble-ellipses-outline' as const,
      label: '问题反馈与需求',
      sub: '排班场景跑偏了?来 Issue 区聊聊',
      url: `${REPO}/issues`,
    },
    {
      icon: 'flask-outline' as const,
      label: '加入内测',
      sub: Platform.OS === 'ios' ? 'TestFlight 公开链接,限 10,000 人' : 'Google Play 封闭测试 · issue 区留邮箱白名单',
      url: joinBeta,
    },
  ];

  const tech = [
    { label: '规则引擎 @zhouerfuqi/core', sub: '四种班制模型 · 节假日联动推理可解释', tag: '自研', tagColor: t.primary },
    { label: '本地优先 · 零云端', sub: '排班数据不出设备,备份走系统分享面板', tag: '隐私', tagColor: t.green },
    { label: 'Expo · React Native', sub: '一套代码双端交付 · 原生全屏响铃引擎', tag: '栈', tagColor: t.text2 },
  ];

  return (
    <Sheet title="关于">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 破晓英雄卡:顶部径向主题色辉光 + logo + 字标 + 版本胶囊 */}
        <View style={[styles.hero, { backgroundColor: t.heroBg, borderColor: t.heroBorder }]}>
          <View style={[styles.glow, { backgroundColor: t.accentSoft }]} />
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
          <Text style={[styles.name, { color: t.text }]}>周而复起</Text>
          <Text style={[styles.tagline, { color: t.text2 }]}>任意班制 · 破晓而起 · 系统级精确响铃</Text>
          <View style={[styles.verPill, { backgroundColor: t.accentSoft, borderColor: t.heroBorder }]}>
            <Text style={{ color: t.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>
              v{ver} · OFFLINE FIRST
            </Text>
          </View>
        </View>

        {/* 实时数据芯片 */}
        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Text style={[styles.statN, { color: t.text }]}>{s.n}</Text>
              <Text style={[styles.statL, { color: t.text3 }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sec, { color: t.text3 }]}>项目与社区</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          {links.map((l, i) => (
            <Pressable
              key={l.label}
              style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: t.line } : null]}
              onPress={() => void Linking.openURL(l.url).catch(() => {})}
            >
              <View style={[styles.rowIco, { backgroundColor: t.accentSoft }]}>
                <Ionicons name={l.icon} size={16} color={t.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowLabel, { color: t.text }]}>{l.label}</Text>
                <Text style={[styles.rowSub, { color: t.text2 }]}>{l.sub}</Text>
              </View>
              <Text style={{ color: t.text3, fontSize: 15 }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sec, { color: t.text3 }]}>技术与声明</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          {tech.map((r, i) => (
            <View key={r.label} style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: t.line } : null]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowLabel, { color: t.text }]}>{r.label}</Text>
                <Text style={[styles.rowSub, { color: t.text2 }]}>{r.sub}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: t.accentSoft }]}>
                <Text style={{ color: r.tagColor, fontSize: 10, fontWeight: '800' }}>{r.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.foot, { color: t.text3 }]}>
          MIT License © 2026 周而复起{'\n'}为所有轮班的人而做 · 明早破晓见
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: -70,
    width: 260,
    height: 200,
    borderRadius: 100,
    opacity: 0.8,
  },
  logo: { width: 64, height: 64, borderRadius: 18, marginBottom: 12 },
  name: { fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  tagline: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  verPill: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  statRow: { flexDirection: 'row', gap: 7 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  statN: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  statL: { fontSize: 9.5, marginTop: 3, fontWeight: '600' },
  sec: { fontSize: 11, letterSpacing: 1.5, marginHorizontal: 2, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  rowIco: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 13.5, fontWeight: '700' },
  rowSub: { fontSize: 11, marginTop: 2 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  foot: { textAlign: 'center', fontSize: 10.5, lineHeight: 17, paddingTop: 6 },
});
