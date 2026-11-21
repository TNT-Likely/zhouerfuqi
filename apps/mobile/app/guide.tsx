import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { checkNotificationPermission, requestNotificationPermission } from '@/services/permissions';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimization } from '@/services/battery';

const VENDOR_STEPS = [
  {
    title: '允许自启动与后台活动',
    path: '设置 → 应用 → 应用启动管理 → 周而复起 → 手动管理',
    desc: '勾选:允许自启动 · 允许关联启动 · 允许后台活动',
  },
  {
    title: '最近任务里加锁',
    path: '多任务卡片下拉 → 🔒 锁定',
    desc: '防止一键清理误杀。完成一次即可。',
  },
];

export default function GuideScreen() {
  const t = useTheme();
  // 实时权限卡:自动检测、一键拉系统弹窗,授权后自动置绿——不依赖手动标记
  const [permOk, setPermOk] = useState<boolean | null>(null);
  const [batteryIgnored, setBatteryIgnored] = useState<boolean>(isIgnoringBatteryOptimizations());

  const refreshAll = useCallback(() => {
    setBatteryIgnored(isIgnoringBatteryOptimizations());
    void checkNotificationPermission().then(setPermOk);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // 从系统设置回来时刷新;系统弹窗关闭后延迟再刷一次(对话框结果落地有延迟)
  useFocusEffect(
    useCallback(() => {
      refreshAll();
      const t1 = setTimeout(refreshAll, 1500);
      const t2 = setTimeout(refreshAll, 4000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [refreshAll]),
  );

  const requestPerm = () => {
    void requestNotificationPermission().then((ok) => {
      setPermOk(ok);
      setTimeout(refreshAll, 800);
    });
  };

  const requestBattery = () => {
    requestIgnoreBatteryOptimization();
    setTimeout(refreshAll, 1200);
    setTimeout(refreshAll, 3500);
  };

  /** 打开本应用通知渠道设置(HarmonyOS/EMUI 的「锁屏展示/横幅」开关在这里) */
  const openChannelSettings = () => {
    if (Platform.OS !== 'android') {
      Alert.alert('iOS', 'iOS 无需此步骤,系统会自动展示全屏响铃。');
      return;
    }
    Linking.openSettings();
    Alert.alert(
      '开启锁屏展示',
      '在应用通知设置里:\n1. 允许通知 ✓\n2. 唤醒屏幕/锁屏展示 ✓(华为·荣耀关键项)\n3. 横幅通知 ✓\n\n这样响铃时会直接全屏接管锁屏。',
    );
  };

  const permDone = permOk === true;
  const batteryDone = batteryIgnored;
  const vendorHint = '无法程序化检测,请按提示自查(华为/荣耀必做)';
  const health = permDone && batteryDone ? '完整' : permDone || batteryDone ? '部分' : '待配置';
  const healthColor = health === '完整' ? t.green : health === '部分' ? '#F59E0B' : t.red;

  return (
    <SafeAreaScrollView backgroundColor={t.bg} contentContainerStyle={styles.container}>
      <View style={styles.headRow}>
        <Pressable onPress={() => router.back()}><Text style={{ color: t.text2, fontSize: 18 }}>‹</Text></Pressable>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginLeft: 12 }}>保活向导</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.healthChip, { borderColor: healthColor }]}>
          <View style={[styles.healthDot, { backgroundColor: healthColor }]} />
          <Text style={{ color: healthColor, fontSize: 11, fontWeight: '800' }}>可靠性 {health}</Text>
        </View>
      </View>
      <Text style={{ color: t.text3, fontSize: 12, lineHeight: 20, marginTop: 10 }}>
        响铃可靠性由「可检测的权限」自动评估(右上角徽章实时变化)。华为 / 荣耀机型另需两处厂商设置(无法程序化检测,请按提示自查)。
      </Text>

      {/* 1. 系统权限(实时检测 + 主动申请) */}
      <View style={[styles.step, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View
          style={[
            styles.no,
            { backgroundColor: permDone ? 'rgba(62,207,142,0.15)' : 'rgba(77,157,255,0.15)' },
          ]}
        >
          <Text style={{ color: permDone ? t.green : t.primary, fontWeight: '800', fontSize: 13 }}>
            {permDone ? '✓' : permOk === false ? '!' : '…'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>
            允许通知与精确闹钟(系统权限)
          </Text>
          <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
            {permOk === null
              ? '检测中…'
              : permDone
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

      {/* 2. 电池优化豁免(实时检测 + 主动申请) */}
      <View style={[styles.step, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View
          style={[
            styles.no,
            { backgroundColor: batteryDone ? 'rgba(62,207,142,0.15)' : 'rgba(77,157,255,0.15)' },
          ]}
        >
          <Text style={{ color: batteryDone ? t.green : t.primary, fontWeight: '800', fontSize: 13 }}>
            {batteryDone ? '✓' : '2'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>忽略电池优化</Text>
          <Text style={[styles.path, { backgroundColor: t.surface2, borderColor: t.line, color: t.text2 }]}>
            系统弹窗 → 允许(一键申请)
          </Text>
          <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
            {batteryDone
              ? '✓ 已豁免电池优化,后台不会被系统杀。'
              : '未豁免:点「去申请」拉起系统确认框,选「允许」即可自动完成。'}
          </Text>
        </View>
        {!batteryDone ? (
          <Pressable onPress={requestBattery} style={[styles.permBtn, { backgroundColor: t.primary }]}>
            <Text style={{ color: t.onPrimary, fontSize: 12, fontWeight: '800' }}>去申请</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 3. 华为/荣耀厂商设置(无法检测,仅引导) */}
      <View style={[styles.step, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={[styles.no, { backgroundColor: 'rgba(146,146,146,0.15)' }]}>
          <Text style={{ color: t.text2, fontWeight: '800', fontSize: 13 }}>3</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>
            锁屏展示与自启动(华为 / 荣耀)
          </Text>
          <Text style={[styles.path, { backgroundColor: t.surface2, borderColor: t.line, color: t.text2 }]}>
            应用通知设置 → 唤醒屏幕/锁屏展示 ✓
          </Text>
          <Text style={{ color: t.text3, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
            「允许锁屏时展示 + 横幅」决定响铃能否全屏接管锁屏;自启动 / 后台活动在应用启动管理里。
            此项无法程序化检测,按提示自查即可,无需点选标记。
          </Text>
        </View>
        <Pressable onPress={openChannelSettings} style={[styles.permBtn, { backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line }]}>
          <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>去开启</Text>
        </Pressable>
      </View>

      {/* 厂商补充(非华为机型通用建议) */}
      <View style={[styles.step, { backgroundColor: t.surface, borderColor: t.line, opacity: 0.9 }]}>
        <View style={[styles.no, { backgroundColor: 'rgba(146,146,146,0.15)' }]}>
          <Text style={{ color: t.text2, fontWeight: '800', fontSize: 13 }}>+</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>其他厂商补充建议</Text>
          {VENDOR_STEPS.map((s) => (
            <Text key={s.title} style={{ color: t.text3, fontSize: 11.5, marginTop: 5, lineHeight: 17 }}>
              · {s.title}:{s.desc}
            </Text>
          ))}
        </View>
      </View>

      <Text style={{ color: t.text3, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
        可靠性徽章只反映可检测项;厂商设置完成后实际可达系统时钟级。
      </Text>
    </SafeAreaScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  healthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  step: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12 },
  no: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  path: { marginTop: 8, fontSize: 10.5, borderRadius: 8, borderWidth: 1, padding: 6, overflow: 'hidden', fontFamily: undefined },
  permBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' },
});
