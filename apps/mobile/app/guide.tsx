import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useGuide } from '@/stores/guide';
import { useTheme } from '@/theme';

const STEPS = [
  {
    title: '允许自启动与后台活动',
    path: '设置 → 应用 → 应用启动管理 → 周而复起 → 手动管理',
    desc: '勾选:允许自启动 · 允许关联启动 · 允许后台活动',
  },
  {
    title: '忽略电池优化',
    path: '设置 → 电池 → 更多电池设置 → 应用专项',
    desc: '把「周而复起」设为不受限;锁屏后不清理。',
  },
  {
    title: '最近任务里加锁',
    path: '多任务卡片下拉 → 🔒 锁定',
    desc: '防止一键清理误杀。完成一次即可。',
  },
];

export default function GuideScreen() {
  const t = useTheme();
  const steps = useGuide((s) => s.steps);
  const toggle = useGuide((s) => s.toggle);
  const doneCount = steps.filter(Boolean).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52 }}>
        <Pressable onPress={() => router.back()}><Text style={{ color: t.text2, fontSize: 18 }}>‹</Text></Pressable>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginLeft: 12 }}>保活向导</Text>
      </View>
      <Text style={{ color: t.text3, fontSize: 12, lineHeight: 20, marginTop: 10 }}>
        华为 / 荣耀等机型默认管控后台应用。完成以下 3 步(约 1 分钟),闹钟即可达到系统时钟级可靠性。点击卡片可标记完成。
      </Text>

      {STEPS.map((s, i) => (
        <Pressable
          key={i}
          onPress={() => toggle(i)}
          style={[styles.step, { backgroundColor: t.surface, borderColor: t.line, opacity: steps[i] ? 0.55 : 1 }]}
        >
          <View style={[styles.no, { backgroundColor: steps[i] ? 'rgba(62,207,142,0.15)' : 'rgba(77,157,255,0.15)' }]}>
            <Text style={{ color: steps[i] ? t.green : t.primary, fontWeight: '800', fontSize: 13 }}>{steps[i] ? '✓' : i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{s.title}</Text>
            <Text style={[styles.path, { backgroundColor: t.surface2, borderColor: t.line, color: t.text2 }]}>{s.path}</Text>
            <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>{s.desc}</Text>
          </View>
        </Pressable>
      ))}

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: i < doneCount ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i < doneCount ? t.primary : t.line }} />
        ))}
      </View>

      <Pressable
        onPress={() => Alert.alert('已保存', '保活配置已记录。闹钟火力全开 🔥')}
        style={[styles.primaryBtn, { backgroundColor: t.primary, opacity: doneCount === 3 ? 1 : 0.4 }]}
      >
        <Text style={{ color: t.onPrimary, fontWeight: '800', letterSpacing: 1 }}>已完成,开始使用</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  step: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12 },
  no: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  path: { marginTop: 8, fontSize: 10.5, borderRadius: 8, borderWidth: 1, padding: 6, overflow: 'hidden', fontFamily: undefined },
  primaryBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
});
