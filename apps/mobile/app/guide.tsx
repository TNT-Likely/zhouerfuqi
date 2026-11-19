import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useGuide } from '@/stores/guide';
import { useTheme } from '@/theme';
import { checkNotificationPermission, requestNotificationPermission } from '@/services/permissions';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimization } from '@/services/battery';

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
  // 实时权限卡:自动检测、一键拉系统弹窗,授权后自动置绿——不依赖手动标记
  const [permOk, setPermOk] = useState<boolean | null>(null);
  const [batteryIgnored, setBatteryIgnored] = useState<boolean>(isIgnoringBatteryOptimizations());

  useEffect(() => {
    void checkNotificationPermission().then(setPermOk);
    setBatteryIgnored(isIgnoringBatteryOptimizations());
  }, []);

  // 从系统设置回来时刷新状态
  useFocusEffect(
    useCallback(() => {
      setBatteryIgnored(isIgnoringBatteryOptimizations());
      void checkNotificationPermission().then(setPermOk);
    }, []),
  );

  const requestPerm = () => {
    void requestNotificationPermission().then((ok) => setPermOk(ok));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52 }}>
        <Pressable onPress={() => router.back()}><Text style={{ color: t.text2, fontSize: 18 }}>‹</Text></Pressable>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginLeft: 12 }}>保活向导</Text>
      </View>
      <Text style={{ color: t.text3, fontSize: 12, lineHeight: 20, marginTop: 10 }}>
        华为 / 荣耀等机型默认管控后台应用。完成以下 3 步(约 1 分钟),闹钟即可达到系统时钟级可靠性。点击卡片可标记完成。
      </Text>

      {/* 步骤 0:系统权限(实时检测 + 主动申请) */}
      <View style={[styles.step, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View
          style={[
            styles.no,
            { backgroundColor: permOk === true ? 'rgba(62,207,142,0.15)' : 'rgba(77,157,255,0.15)' },
          ]}
        >
          <Text style={{ color: permOk === true ? t.green : t.primary, fontWeight: '800', fontSize: 13 }}>
            {permOk === true ? '✓' : permOk === false ? '!' : '…'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>
            允许通知与精确闹钟(系统权限)
          </Text>
          <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
            {permOk === null
              ? '检测中…'
              : permOk
                ? '✓ 已授权,响铃可达系统时钟级可靠性。'
                : '未授权:点「去授权」拉起系统弹窗,选「允许」即可自动完成。'}
          </Text>
        </View>
        {permOk === false ? (
          <Pressable onPress={requestPerm} style={[styles.permBtn, { backgroundColor: t.primary }]}>
            <Text style={{ color: t.onPrimary, fontSize: 12, fontWeight: '800' }}>去授权</Text>
          </Pressable>
        ) : null}
      </View>

      {STEPS.map((s, i) => {
        // 步骤 2(忽略电池优化)实时检测 + 主动申请,不再手动标记
        const isBattery = s.title.includes('电池优化');
        const batteryDone = isBattery && batteryIgnored;
        const done = isBattery ? batteryDone : steps[i];
        return (
          <Pressable
            key={i}
            onPress={() => { if (!isBattery) toggle(i); }}
            style={[styles.step, { backgroundColor: t.surface, borderColor: t.line, opacity: done ? 0.55 : 1 }]}
          >
            <View style={[styles.no, { backgroundColor: done ? 'rgba(62,207,142,0.15)' : 'rgba(77,157,255,0.15)' }]}>
              <Text style={{ color: done ? t.green : t.primary, fontWeight: '800', fontSize: 13 }}>{done ? '✓' : i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{s.title}</Text>
              <Text style={[styles.path, { backgroundColor: t.surface2, borderColor: t.line, color: t.text2 }]}>{s.path}</Text>
              <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
                {isBattery
                  ? (batteryIgnored
                    ? '✓ 已豁免电池优化,后台不会被系统杀。'
                    : '未豁免:点「去申请」拉起系统确认框,选「允许」即可自动完成。')
                  : s.desc}
              </Text>
            </View>
            {isBattery && !batteryIgnored ? (
              <Pressable onPress={requestIgnoreBatteryOptimization} style={[styles.permBtn, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontSize: 12, fontWeight: '800' }}>去申请</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => {
          const done = i === 1 ? batteryIgnored : steps[i];
          return (
            <View key={i} style={{ width: done ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: done ? t.primary : t.line }} />
          );
        })}
      </View>

      <Pressable
        onPress={() => Alert.alert('已保存', '保活配置已记录。闹钟火力全开 🔥')}
        style={[styles.primaryBtn, { backgroundColor: t.primary, opacity: doneCount === 3 && batteryIgnored ? 1 : 0.4 }]}
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
  permBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
});
