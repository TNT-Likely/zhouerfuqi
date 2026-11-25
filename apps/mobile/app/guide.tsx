import { useCallback, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { PanelButton, PanelList, PanelRow } from '@/components/Panel';
import { SafeAreaScrollView } from '@/components/SafeAreaScrollView';
import { TrialDialog } from '@/components/TrialDialog';
import { TrialStatus } from '@/components/TrialStatus';
import { useLocale } from '@/i18n';
import { commonCopy } from '@/i18n/settings';
import { guideCopy } from '@/i18n/support';
import { useTheme } from '@/theme';
import { gateway } from '@/gateway';
import type { AlarmPermissionStatus } from '@/gateway/types';
import {
  openAlarmPermissionSettings,
  openAppNotificationSettings,
  requestNotificationPermission,
  supportsNotificationPermissionPrompt,
} from '@/services/permissions';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimization } from '@/services/battery';

export default function GuideScreen() {
  const router = useRouter();
  const t = useTheme();
  const locale = useLocale();
  const common = commonCopy[locale];
  const copy = guideCopy[locale];
  const p = t.panel;
  const [permissions, setPermissions] = useState<AlarmPermissionStatus | null>(null);
  const permission = permissions?.notifications;
  const [battery, setBattery] = useState(isIgnoringBatteryOptimizations);
  const [vendor, setVendor] = useState(() => {
    const brand = Platform.OS === 'android' ? Platform.constants.Brand.toLowerCase() : '';
    return brand === 'xiaomi' || brand === 'redmi' ? 1 : brand === 'oppo' || brand === 'vivo' ? 2 : 0;
  });
  const [dialog, setDialog] = useState<'notifications' | 'test' | null>(null);
  const [error, setError] = useState('');
  const [attemptedPermission, setAttemptedPermission] = useState(false);
  const close = () => { setError(''); setDialog(null); };

  const refresh = useCallback(() => {
    setBattery(isIgnoringBatteryOptimizations());
    void gateway.status().then(setPermissions, () => setPermissions(null));
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
      setError(copy.openNotificationSettingsFailed);
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
        <PanelButton label={common.settings} icon="chevron-back" variant="text" onPress={() => router.back()} />
        <Text style={[styles.title, { color: t.text }]}>{copy.title}</Text>
      </View>
      <View style={[styles.status, { backgroundColor: t.accentSoft, borderColor: t.heroBorder }]}>
        <Text style={[styles.statusTitle, { color: t.text }]}>{copy.lockScreenCheck}</Text>
        <Text style={[styles.detail, { color: p.muted }]}>{copy.lockScreenCheckDetail}</Text>
      </View>
      <PanelList>
        <PanelRow icon="notifications-outline" title={common.notifications} detail={copy.allowAlarmNotifications}
          value={permission ? common.enabled : undefined}
          onPress={permission ? undefined : requestPermission}
          tone={permission ? 'success' : 'warning'} />
        <PanelRow icon="alarm-outline" title={common.exactAlarms} detail={copy.allowExactAlarms}
          value={permissions ? permissions.exactAlarms ? common.enabled : common.needsPermission : common.needsCheck}
          onPress={permissions?.exactAlarms === false ? () => void openAlarmPermissionSettings('exact')
            .catch(() => setError(copy.openExactAlarmSettingsFailed)) : undefined} divider />
        {Platform.OS === 'android' && Number(Platform.Version) >= 34 ?
          <PanelRow icon="expand-outline" title={copy.fullScreen}
            value={permissions ? permissions.fullScreen ? common.enabled : common.needsPermission : common.needsCheck}
            onPress={permissions?.fullScreen === false ? () => void openAlarmPermissionSettings('fullScreen')
              .catch(() => setError(copy.openFullScreenSettingsFailed)) : undefined} divider /> : null}
        <PanelRow icon="battery-half-outline" title={copy.batteryOptimization} detail={copy.batteryOptimizationDetail}
          value={battery ? copy.batteryExempt : undefined} divider tone={battery ? 'success' : 'warning'}
          onPress={battery ? undefined : () => {
            try {
              requestIgnoreBatteryOptimization();
              setBattery(isIgnoringBatteryOptimizations());
            } catch {
              setError(copy.openBatterySettingsFailed);
            }
          }} />
      </PanelList>

      <PanelList>
        <View style={styles.vendor}>
          <Text style={[styles.statusTitle, { color: t.text }]}>{copy.vendorSettings}</Text>
          <View style={styles.chips}>
            {copy.vendors.map((item, index) => {
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
          <Text style={[styles.detail, { color: p.muted }]}>{copy.vendors[vendor]!.detail}</Text>
        </View>
        <PanelRow icon="notifications-outline" title={copy.alarmNotifications} detail={copy.alarmNotificationsDetail} divider
          onPress={() => setDialog('notifications')} />
      </PanelList>
      <PanelButton label={common.tryAlarm} variant="primary" onPress={() => setDialog('test')} />
      <TrialStatus />

      {dialog === 'test' ? <TrialDialog onClose={close} /> : null}
      {dialog === 'notifications' ? (
        <AppDialog title={copy.alarmNotifications} confirm={copy.openNotificationSettings} onClose={close} onConfirm={() => void openSettings()}>
          <DialogCopy>{copy.notificationInstructions}</DialogCopy>
          <PanelList inset>
            <PanelRow icon="notifications-outline" title={copy.allowNotifications} detail={copy.allowNotificationsDetail} />
            <PanelRow icon="lock-closed-outline" title={copy.lockScreenNotifications} detail={copy.lockScreenNotificationsDetail} divider />
            <PanelRow icon="browsers-outline" title={copy.banners} detail={copy.bannersDetail} divider />
          </PanelList>
          {error ? <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text> : null}
        </AppDialog>
      ) : null}
      {error && dialog !== 'notifications' ? (
        <AppDialog title={copy.openSettingsFailed} icon="alert-circle-outline" tone="error" layout="center" onClose={() => setError('')}>
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
