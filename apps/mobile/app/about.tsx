import { useState } from 'react';
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { PanelList, PanelRow, PanelSection } from '@/components/Panel';
import { Sheet } from '@/components/Sheet';
import { holidayInfo } from '@/services/holidays';
import { useGroups } from '@/stores/groups';
import { useTheme } from '@/theme';

const REPO = 'https://github.com/TNT-Likely/zhouerfuqi';
const ios = Platform.OS === 'ios';
const beta = ios ? 'https://testflight.apple.com/join/9vNcHgha' : REPO + '/issues/1';

export default function AboutScreen() {
  const t = useTheme();
  const groups = useGroups((s) => s.groups);
  const [showTech, setShowTech] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const enabled = groups.filter((group) => group.enabled);
  const version = Constants.expoConfig?.version;
  const stats = [
    { value: enabled.length, label: '启用班组' },
    { value: enabled.reduce((count, group) => count + group.times.length, 0), label: '启用响铃' },
    { value: holidayInfo().days, label: '假日与补班' },
  ];
  const open = (url: string) => () => { void Linking.openURL(url).catch(() => setLinkFailed(true)); };

  return (
    <Sheet title="关于" appearance="panel">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[t.accentSoft, t.panel.surface]} style={[styles.hero, { borderColor: t.heroBorder }]}>
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
          <Text style={[styles.name, { color: t.text }]}>周而复起</Text>
          <Text style={[styles.tagline, { color: t.panel.muted }]}>适合大小周、轮班与手动排班的本地闹钟</Text>
          {version ? <Text style={[styles.version, { color: t.panel.accent, backgroundColor: t.accentSoft }]}>v{version}</Text> : null}
          <View style={[styles.stats, { borderTopColor: t.panel.border }]}>
            {stats.map((item, i) => (
              <View key={item.label} style={[
                styles.stat, i > 0 && { borderLeftColor: t.panel.border, borderLeftWidth: 1 },
              ]}>
                <Text style={[styles.statValue, { color: t.text }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: t.panel.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <PanelSection title="项目与社区">
          <PanelRow icon="logo-github" title="GitHub 仓库" detail="查看源码与发布记录" onPress={open(REPO)} external />
          <PanelRow icon="chatbubble-ellipses-outline" title="反馈与建议" detail="报告问题或分享排班需求"
            onPress={open(REPO + '/issues')} external divider />
          <PanelRow icon="flask-outline" title="加入内测" detail={ios ? 'TestFlight 公开内测' : 'Google Play 封闭测试'}
            onPress={open(beta)} external divider />
        </PanelSection>

        <PanelSection title="数据与隐私">
          <PanelRow icon="shield-checkmark-outline" title="排班数据保存在设备上" detail="备份通过系统文件与分享功能导出" />
          <PanelRow icon="lock-closed-outline" title="隐私政策" onPress={open(REPO + '/blob/main/docs/privacy.md')} external divider />
          <PanelRow icon="settings-outline" title="技术说明" onPress={() => setShowTech(true)} divider />
        </PanelSection>
        <Text style={[styles.footer, { color: t.panel.muted }]}>MIT License © 2026 周而复起</Text>
      </ScrollView>
      {showTech ? (
        <AppDialog title="技术说明" onClose={() => setShowTech(false)}>
          <PanelList inset>
            <PanelRow icon="calendar-outline" title="排班引擎" detail="@zhouerfuqi/core 计算班制和节假日。" />
            <PanelRow icon="lock-closed-outline" title="本地存储" detail="排班和外观设置保存在设备上。" divider />
            <PanelRow icon="alarm-outline" title="应用与响铃" detail="界面使用 Expo 和 React Native，响铃由系统调度。" divider />
          </PanelList>
        </AppDialog>
      ) : null}
      {linkFailed ? (
        <AppDialog title="无法打开链接" layout="center" tone="error" icon="alert-circle-outline" onClose={() => setLinkFailed(false)}>
          <DialogCopy centered>请检查设备上的浏览器设置后重试。</DialogCopy>
        </AppDialog>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 15, paddingBottom: 24 },
  hero: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 17, paddingBottom: 12 },
  logo: { width: 60, height: 60, borderRadius: 16 },
  name: { marginTop: 9, fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  tagline: { fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  version: { marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontSize: 11.5, fontWeight: '700' },
  stats: { marginTop: 15, borderTopWidth: 1, paddingTop: 11, flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4, gap: 3 },
  statValue: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 11, paddingVertical: 4 },
});
