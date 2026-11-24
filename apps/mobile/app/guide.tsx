import { useCallback, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { PanelButton, PanelList, PanelRow } from '@/components/Panel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { TrialDialog } from '@/components/TrialDialog';
import { useTheme } from '@/theme';
import {
  checkNotificationPermission,
  openAppNotificationSettings,
  requestNotificationPermission,
  supportsNotificationPermissionPrompt,
} from '@/services/permissions';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimization } from '@/services/battery';

const vendorTips = [
  {
    name: '华为 / 荣耀',
    detail: '在系统设置中搜索「应用启动管理」，手动允许周而复起自启动和后台活动。',
  },
  {
    name: '小米',
    detail: '允许自启动，将省电策略设为无限制，并在最近任务中锁定周而复起。',
  },
  {
    name: 'OPPO / vivo',
    detail: '在系统设置中允许周而复起后台启动和后台运行。',
  },
] as const;

export default function GuideScreen() {
  const t = useTheme();
  const p = t.panel;
  const [permission, setPermission] = useState<boolean | null>(null);
  const [battery, setBattery] = useState(isIgnoringBatteryOptimizations);
  const [vendor, setVendor] = useState(0);
  const [dialog, setDialog] = useState<'notifications' | 'test' | null>(null);
  const [error, setError] = useState('');
  const [attemptedPermission, setAttemptedPermission] = useState(false);
  const close = () => { setError(''); setDialog(null); };

  const refresh = useCallback(() => {
    setBattery(isIgnoringBatteryOptimizations());
    void checkNotificationPermission().then(setPermission);
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]));

  async function openSettings() {
    try {
      await openAppNotificationSettings();
      close();
    } catch {
      setError('请在系统设置中打开周而复起的通知设置。');
    }
  }

  function requestPermission() {
    if (!supportsNotificationPermissionPrompt || attemptedPermission) {
      void openSettings();
      return;
    }
    setAttemptedPermission(true);
    void requestNotificationPermission().then(refresh);
  }

  return (
    <SafeAreaScrollView backgroundColor={p.bg} contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <PanelButton label="设置" icon="chevron-back" variant="text" onPress={() => router.back()} />
        <Text style={[styles.title, { color: t.text }]}>保活向导</Text>
      </View>
      <View style={[styles.status, { backgroundColor: t.accentSoft, borderColor: t.heroBorder }]}>
        <Text style={[styles.statusTitle, { color: t.text }]}>{`已开启 ${Number(permission === true) + Number(battery)} / 2 项系统设置`}</Text>
        <Text style={[styles.detail, { color: p.muted }]}>查看通知和后台运行状态，可用试响检查锁屏时的效果。</Text>
      </View>
      <PanelList>
        <PanelRow icon="notifications-outline" title="通知权限" detail="允许发出闹钟响铃通知"
          value={permission ? '已开启' : undefined}
          onPress={permission ? undefined : requestPermission}
          tone={permission ? 'success' : 'warning'} />
        <PanelRow icon="battery-half-outline" title="电池优化" detail="允许周而复起在后台按计划运行"
          value={battery ? '已忽略' : undefined} divider tone={battery ? 'success' : 'warning'}
          onPress={battery ? undefined : () => {
            try {
              requestIgnoreBatteryOptimization();
              setBattery(isIgnoringBatteryOptimizations());
            } catch {
              setError('请在系统电池设置中检查周而复起的后台运行权限。');
            }
          }} />
      </PanelList>

      <PanelList>
        <View style={styles.vendor}>
          <Text style={[styles.statusTitle, { color: t.text }]}>厂商设置</Text>
          <View style={styles.chips}>
            {vendorTips.map((item, index) => {
              const selected = vendor === index;
              return (
                <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected }}
                  onPress={() => setVendor(index)}
                  style={[styles.chip, { backgroundColor: selected ? t.accentSoft : p.raised, borderColor: selected ? t.heroBorder : p.border }]}>
                  <Text style={{ color: selected ? p.accent : p.muted, fontSize: 12, fontWeight: '600' }}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.detail, { color: p.muted }]}>{vendorTips[vendor]!.detail}</Text>
        </View>
        <PanelRow icon="notifications-outline" title="闹钟通知" detail="查看系统提供的通知方式" divider onPress={() => setDialog('notifications')} />
      </PanelList>
      <PanelButton label="试响" variant="primary" onPress={() => setDialog('test')} />

      {dialog === 'test' ? <TrialDialog onClose={close} /> : null}
      {dialog === 'notifications' ? (
        <AppDialog title="闹钟通知" confirm="打开通知设置" onClose={close} onConfirm={() => void openSettings()}>
          <DialogCopy>允许周而复起发送通知，并检查「闹钟响铃」类别。手机没有单独的锁屏通知选项时，可直接用试响验证锁屏效果。</DialogCopy>
          <PanelList inset>
            <PanelRow icon="notifications-outline" title="允许通知" detail="允许应用发出提醒" />
            <PanelRow icon="lock-closed-outline" title="锁屏通知（如有）" detail="锁屏时显示通知卡片" divider />
            <PanelRow icon="browsers-outline" title="横幅通知（如有）" detail="亮屏时显示通知横幅" divider />
          </PanelList>
          {error ? <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text> : null}
        </AppDialog>
      ) : null}
      {error && dialog !== 'notifications' ? (
        <AppDialog title="无法打开系统设置" icon="alert-circle-outline" tone="error" layout="center" onClose={() => setError('')}>
          <DialogCopy centered>{error}</DialogCopy>
        </AppDialog>
      ) : null}
    </SafeAreaScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 34 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', fontSize: 18, flex: 1 },
  status: { padding: 13, gap: 4, borderRadius: 18, borderWidth: 1 },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 18 },
  vendor: { padding: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { borderWidth: 1, borderRadius: 10, minHeight: 36, paddingHorizontal: 9, justifyContent: 'center' },
});
