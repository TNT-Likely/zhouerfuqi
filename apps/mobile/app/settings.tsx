import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { AppDialog, DialogCopy, DialogSummary, type AppDialogContent } from '@/components/AppDialog';
import { Avatar, AvatarEditor } from '@/components/Avatar';
import { useFeedback } from '@/components/Feedback';
import { PanelButton, PanelIconTile, PanelList, PanelRow, PanelSection } from '@/components/Panel';
import { Sheet } from '@/components/Sheet';
import { TrialDialog } from '@/components/TrialDialog';
import { TrialStatus } from '@/components/TrialStatus';
import { useLocale } from '@/i18n';
import { commonCopy, settingsCopy } from '@/i18n/settings';
import { clockLabel } from '@/lib/clock';
import { dateLabel } from '@/lib/labels';
import { scheduleMessage, useFutureSchedule } from '@/scheduler/future';
import { exportCalendar } from '@/services/calendarExport';
import { useGroups } from '@/stores/groups';
import { gateway } from '@/gateway';
import type { AlarmPermissionStatus } from '@/gateway/types';
import { syncAll, useScheduleState } from '@/scheduler/sync';
import { todayISO } from '@/scheduler/materialize';
import { exportBackup, getRecoveryBackup, pickBackup, restoreBackup, type BackupFile } from '@/services/backup';
import { holidayInfo, refreshHolidays } from '@/services/holidays';
import {
  openAlarmPermissionSettings,
  openAppNotificationSettings,
  requestNotificationPermission,
  supportsNotificationPermissionPrompt,
} from '@/services/permissions';
import { checkUpdate, downloadAndInstall } from '@/services/updater';
import { usePrefs } from '@/stores/prefs';
import { THEME_COLORS, useTheme } from '@/theme';
import { scheduleRefresher } from '../modules/zf-alarm/src';
import { isAlarmKitAvailable } from '../modules/zf-alarm-ios/src';
import { getVersion, isUpdateSupported } from '../modules/zf-update/src';

const appearances = ['system', 'light', 'dark'] as const;
const android = Platform.OS === 'android';
const canUpdate = isUpdateSupported();
const canChooseAppLanguage = Platform.OS === 'ios' || (android && Number(Platform.Version) >= 33);

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTheme();
  const locale = useLocale();
  const common = commonCopy[locale];
  const copy = settingsCopy[locale];
  const p = t.panel;
  const notify = useFeedback();
  const { now, upcoming, state: schedule } = useFutureSchedule();
  const next = upcoming[0];
  const readiness = scheduleMessage(next, now, schedule);
  const [hasRecovery, setHasRecovery] = useState(false);
  const { themeIdx, setThemeIdx, mode, setMode, avatarImage } = usePrefs();
  const [permissions, setPermissions] = useState<AlarmPermissionStatus | null>(null);
  const [attemptedPermission, setAttemptedPermission] = useState(false);
  const [dialog, setDialog] = useState<AppDialogContent | 'permissions' | 'avatar' | 'trial' | null>(null);
  const [busy, setBusy] = useState(false);
  const [repickAfterDismiss, setRepickAfterDismiss] = useState(false);
  const pending = useRef(false);
  const holiday = holidayInfo();
  const exactAvailable = android || isAlarmKitAvailable();
  const authorized = permissions?.notifications && (!exactAvailable || permissions.exactAlarms);
  const [version] = useState(() => {
    try {
      return canUpdate ? getVersion().versionName : Constants.expoConfig?.version;
    } catch {
      return Constants.expoConfig?.version;
    }
  });
  const close = () => setDialog(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => {
      void gateway.status().then(
        (value) => { if (active) setPermissions(value); },
        () => { if (active) setPermissions(null); },
      );
    };
    refresh();
    void getRecoveryBackup().then((value) => { if (active) setHasRecovery(!!value); }).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { active = false; sub.remove(); };
  }, []));

  function showError(title: string, reason: unknown, retry?: () => void) {
    const message = reason instanceof Error ? reason.message : String(reason);
    setDialog({
      title, icon: 'alert-circle-outline', layout: 'center', tone: 'error',
      children: <DialogCopy centered>{message}</DialogCopy>,
      ...(retry ? { confirm: common.retry, onConfirm: retry, cancel: true } : {}),
    });
  }

  async function run(failureTitle: string, operation: () => Promise<void>, retry?: () => void) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      showError(failureTitle, error, retry);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function checkVersion() {
    void run(copy.checkForUpdatesFailed, async () => {
      const result = await checkUpdate();
      if (result.status === 'error') throw new Error(copy.versionUnavailable);
      const current = result.current.versionName;
      if (result.status === 'up-to-date') {
        setDialog({
          title: copy.upToDate, layout: 'center', tone: 'success', icon: 'checkmark',
          children: <DialogCopy centered>{copy.usingVersion(current)}</DialogCopy>,
        });
        return;
      }
      const info = result.info;
      const install = () => void run(copy.updateFailed, async () => {
        await downloadAndInstall(info);
        close();
        notify(copy.apkDownloaded, copy.apkInstallInstructions, 'success', 'download-outline');
      }, install);
      setDialog({
        title: copy.updateAvailable, confirm: copy.downloadAndInstall, cancel: true, onConfirm: install,
        children: <VersionDetails current={current} next={info.versionName} notes={info.notes} />,
      });
    }, checkVersion);
  }

  function openPermissions() {
    setAttemptedPermission(false);
    setDialog('permissions');
    void gateway.status().then(setPermissions).catch(() => setPermissions(null));
  }

  const canRequest = !!permissions && !attemptedPermission && (
    android
      ? supportsNotificationPermissionPrompt && !permissions.notifications
      : !permissions.notifications || (exactAvailable && !permissions.exactAlarms)
  );

  function changePermissions() {
    if (authorized) { close(); return; }
    void run(copy.openAlarmPermissionsFailed, async () => {
      if (!permissions) {
        setPermissions(await gateway.status());
        return;
      }
      if (canRequest) {
        setAttemptedPermission(true);
        if (android) await requestNotificationPermission();
        else await gateway.requestPermissions();
        setPermissions(await gateway.status());
        await syncAll();
        return;
      }
      if (android && !permissions.exactAlarms) await openAlarmPermissionSettings('exact');
      else if (android) await openAppNotificationSettings();
      else await Linking.openSettings();
      close();
    }, openPermissions);
  }

  function confirmResync() {
    const resync = () => void run(copy.resyncFailed, async () => {
      await syncAll();
      close();
      const entries = Object.values(useScheduleState.getState().entries);
      const count = entries.filter((entry) => entry.delivery === 'system' || entry.delivery === 'notification').length;
      notify(copy.resynced, count ? copy.registeredAlerts(count) : copy.checkNextAlarm);
    }, resync);
    setDialog({
      title: copy.confirmResync, layout: 'center', icon: 'refresh-outline', confirm: copy.resyncAlarms, cancel: true,
      children: <DialogCopy centered>{copy.resyncExplanation}</DialogCopy>,
      onConfirm: resync,
    });
  }

  function showHolidays() {
    const refresh = () => void run(copy.holidayUpdateFailed, async () => {
      const added = await refreshHolidays();
      if (added) await syncAll();
      close();
      if (added) notify(copy.holidaysUpdated, copy.holidaysUpdatedDetail);
      else notify(copy.noNewHolidays, copy.noNewHolidaysDetail, 'accent', 'calendar-outline');
    }, refresh);
    setDialog({
      title: copy.chinesePublicHolidays, confirm: copy.checkNewYears, cancel: true, onConfirm: refresh,
      children: <>
        <DialogSummary value={holiday.years.join(' · ')} detail={copy.holidayCount(holiday.days)} />
        <DialogCopy>{copy.holidayExplanation}</DialogCopy>
      </>,
    });
  }

  function showExport() {
    const share = () => void run(copy.exportBackupFailed, async () => {
      await exportBackup(version);
      close();
    }, share);
    setDialog({
      title: copy.exportBackup, confirm: copy.createAndShare, cancel: true, onConfirm: share,
      children: <>
        <PanelList inset><PanelRow icon="document-text-outline" title={copy.jsonBackup}
          detail={copy.jsonBackupDetail} /></PanelList>
        <DialogCopy>{copy.shareBackupInstructions}</DialogCopy>
      </>,
    });
  }

  function previewRestore(name: string, backup: BackupFile) {
    const current = useGroups.getState().groups;
    const count = backup.groups.length;
    setDialog({
      title: copy.confirmRestore, layout: 'sheet', tone: 'warning', icon: 'download-outline',
      confirm: copy.confirmRestoreAction, cancel: true,
      children: <>
        <DialogCopy>{copy.recoveryCopyExplanation}</DialogCopy>
        <PanelList inset>
          <PanelRow icon="document-text-outline" title={name}
            detail={count ? copy.groupNames(backup.groups.map((group) => group.name)) : copy.emptySchedule} tone="warning" />
          <PanelRow icon="swap-horizontal-outline" title={copy.replaceGroups(current.length)}
            detail={copy.groupNames(current.map((group) => group.name))} divider />
        </PanelList>
      </>,
      onConfirm: () => void run(copy.restoreScheduleFailed, async () => {
        await restoreBackup(backup, version);
        setHasRecovery(true);
        try {
          await syncAll();
        } catch (error) {
          showError(copy.restoredButSyncFailed, error, confirmResync);
          return;
        }
        close();
        notify(copy.scheduleRestored, copy.groupsRestored(count));
      }),
    });
  }

  function selectBackup() {
    if (pending.current) return;
    close();
    void run(copy.importBackupFailed, async () => {
      const selection = await pickBackup();
      if (selection) previewRestore(selection.name, selection.backup);
    }, () => {
      if (android) selectBackup();
      else setRepickAfterDismiss(true);
    });
  }

  const permissionsLabel = permissions === null ? copy.checkNotificationsAndAlarms
    : authorized ? (exactAvailable ? copy.notificationsAndAlarmsEnabled : copy.notificationsEnabled)
      : copy.checkMissingPermissions;
  const lastSync = schedule.syncedAt ? new Date(schedule.syncedAt) : null;
  const resyncDetail = lastSync
    ? copy.lastSynced(clockLabel({ hour: lastSync.getHours(), minute: lastSync.getMinutes() }, locale))
    : copy.resyncDetail;

  return (
    <Sheet title={common.settings} appearance="panel">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}
        pointerEvents={busy ? 'none' : 'auto'}>
        <PanelSection title={copy.alarmsAndReliability}>
          <View style={[styles.reliability, { backgroundColor: t.accentSoft }]}>
            <PanelIconTile icon="shield-checkmark-outline" />
            <View style={styles.reliabilityCopy}>
              <Text style={[styles.reliabilityTitle, { color: t.text }]}>
                {readiness.title}
              </Text>
              <Text style={[styles.caption, { color: p.muted }]}>{next
                ? dateLabel(next.date, locale) + ' · ' + clockLabel(next, locale)
                : copy.noUpcomingAlarm}</Text>
            </View>
            <PanelButton label={common.tryAlarm} variant="primary" onPress={() => setDialog('trial')} disabled={busy} />
          </View>
          <PanelRow icon="notifications-outline" title={copy.permissionsStatus} detail={permissionsLabel} onPress={openPermissions} divider />
          {android ? (
            <PanelRow icon="shield-outline" title={copy.alarmSetup} detail={copy.alarmSetupDetail}
              onPress={() => router.push('/guide')} divider />
          ) : null}
          <PanelRow icon="refresh-outline" title={copy.resyncAlarms} detail={resyncDetail} onPress={confirmResync} divider />
          {android && __DEV__ ? (
            <PanelRow icon="construct-outline" title={copy.registerRefresher} divider onPress={() => {
              try {
                scheduleRefresher(3, 30);
                notify(copy.refresherRegistered);
              } catch (error) {
                showError(copy.refresherFailed, error);
              }
            }} />
          ) : null}
        </PanelSection>

        <TrialStatus />

        <PanelSection title={copy.appearanceAndProfile}>
          <View style={styles.appearance}>
            <Text style={[styles.groupLabel, { color: t.text }]}>{copy.appearanceMode}</Text>
            <View style={[styles.segment, { backgroundColor: p.raised }]}>
              {appearances.map((item) => {
                const selected = item === mode;
                return (
                  <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => setMode(item)}
                    style={[styles.mode, selected && { backgroundColor: p.surface }]}>
                    <Text style={[styles.modeText, { color: selected ? p.accent : p.muted }]}>{copy.appearances[item]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.groupLabel, { color: t.text }]}>{copy.themeColor}</Text>
            <View style={styles.palette}>
              {THEME_COLORS.map((swatch, i) => {
                const selected = themeIdx === i;
                const name = copy.swatchNames[i] ?? swatch.name;
                return (
                  <Pressable key={swatch.name} accessibilityRole="button" accessibilityState={{ selected }}
                    accessibilityLabel={copy.themeColorLabel(name)} onPress={() => setThemeIdx(i)}
                    style={[styles.swatch, selected && { backgroundColor: t.accentSoft }]}>
                    <View style={[styles.dot, { backgroundColor: swatch[t.scheme] }]}>
                      {selected ? <Ionicons name="checkmark-sharp" size={16} color="#151515" /> : null}
                    </View>
                    <Text style={[styles.swatchName, { color: selected ? t.text : p.muted }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <PanelRow icon="person-outline" title={copy.homeAvatar} value={<Avatar image={avatarImage} size={30} />}
            onPress={() => setDialog('avatar')} divider />
          <PanelRow icon="grid-outline" title={copy.widgets} detail={copy.widgetsDetail} divider onPress={() => setDialog({
            title: copy.addWidget,
            children: <DialogCopy>{android ? copy.addWidgetAndroid : copy.addWidgetIos}</DialogCopy>,
          })} />
        </PanelSection>

        <PanelSection title={copy.dataAndBackups}>
          <PanelRow icon="calendar-outline" title={copy.chinesePublicHolidays} detail={copy.holidayCatalog(holiday.years.join(' / '))}
            onPress={showHolidays} />
          <PanelRow icon="share-outline" title={copy.exportBackup} detail={copy.exportBackupDetail} onPress={showExport} divider />
          <PanelRow icon="download-outline" title={copy.restoreBackup} detail={copy.restoreBackupDetail} onPress={selectBackup} divider />
          {hasRecovery ? <PanelRow icon="arrow-undo-outline" title={copy.recoveryCopy} detail={copy.recoveryCopyDetail} divider
            onPress={() => void run(copy.recoveryCopyFailed, async () => {
              const recovery = await getRecoveryBackup();
              if (recovery) previewRestore(copy.recoveryCopy, recovery);
            })} /> : null}
          <PanelRow icon="calendar-clear-outline" title={copy.exportSchedule} detail={copy.exportScheduleDetail} divider
            onPress={() => void run(copy.exportScheduleFailed, () => exportCalendar(useGroups.getState().groups, todayISO(), 30))} />
        </PanelSection>

        <PanelSection title={copy.app}>
          <PanelRow icon="language-outline" title={copy.appLanguage}
            detail={canChooseAppLanguage ? copy.appLanguageDetail : copy.deviceLanguageDetail}
            value={locale === 'zh-CN' ? '简体中文' : 'English'}
            onPress={canChooseAppLanguage ? () => void run(copy.openAppSettingsFailed, Linking.openSettings) : undefined} />
          <PanelRow icon="cloud-download-outline" title={canUpdate ? copy.checkForUpdates : copy.appUpdates}
            detail={canUpdate ? 'GitHub Releases' : copy.appUpdatesDetail}
            value={version ? 'v' + version : undefined} onPress={canUpdate ? checkVersion : undefined} divider />
          <PanelRow icon="information-circle-outline" title={copy.aboutApp} detail={copy.aboutAppDetail}
            onPress={() => router.push('/about')} divider />
        </PanelSection>
      </ScrollView>

      {dialog === 'avatar' ? <AvatarEditor onClose={close} /> : null}
      {dialog === 'trial' ? <TrialDialog onClose={close} /> : null}
      {dialog === 'permissions' ? (
        <AppDialog title={copy.alarmPermissions} onClose={close} busy={busy} onConfirm={changePermissions}
          confirm={authorized ? common.done : !permissions ? copy.recheck : canRequest ? copy.grantPermissions : copy.openSystemSettings}>
          <PanelList inset>
            <PanelRow icon="notifications-outline" title={common.notifications} detail={copy.alarmNotificationsDetail}
              value={<PermissionBadge enabled={permissions?.notifications} />} />
            {exactAvailable ? <PanelRow icon="alarm-outline" title={android ? common.exactAlarms : copy.alarmPermission}
              detail={copy.alarmTimingDetail} value={<PermissionBadge enabled={permissions?.exactAlarms} />} divider /> : null}
            {android && Number(Platform.Version) >= 34 ? <PanelRow icon="expand-outline" title={copy.fullScreenAlerts}
              value={<PermissionBadge enabled={permissions?.fullScreen} />} divider
              onPress={permissions?.fullScreen === false ? () => void run(copy.openFullScreenSettingsFailed, async () => {
                await openAlarmPermissionSettings('fullScreen'); close();
              }) : undefined} /> : null}
          </PanelList>
          {permissions && !authorized ? (
            <DialogCopy>{canRequest ? copy.testAfterGrant : copy.grantInSystemSettings}</DialogCopy>
          ) : null}
        </AppDialog>
      ) : null}
      {dialog && typeof dialog === 'object' ? (
        <AppDialog {...dialog} onClose={close} busy={busy} visible={!repickAfterDismiss}
          onDismiss={repickAfterDismiss ? () => { setRepickAfterDismiss(false); selectBackup(); } : undefined} />
      ) : null}
    </Sheet>
  );
}

function PermissionBadge({ enabled }: { enabled?: boolean }) {
  const { panel: p } = useTheme();
  const common = commonCopy[useLocale()];
  return (
    <View style={[styles.permission, { backgroundColor: enabled ? p.successSoft : p.warningSoft }]}>
      <Ionicons name={enabled ? 'checkmark' : 'information-circle-outline'} size={13} color={enabled ? p.success : p.warning} />
      <Text style={[styles.permissionLabel, { color: enabled ? p.success : p.warning }]}>
        {enabled === undefined ? common.needsCheck : enabled ? common.enabled : common.needsPermission}
      </Text>
    </View>
  );
}

function VersionDetails({ current, next, notes }: { current: string; next: string; notes: string }) {
  const t = useTheme();
  const copy = settingsCopy[useLocale()];
  return (
    <>
      <LinearGradient colors={[t.panel.raised, t.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.versions, { borderColor: t.heroBorder }]}>
        <View style={styles.version}>
          <DialogCopy centered>{copy.currentVersion}</DialogCopy>
          <Text style={[styles.versionNumber, { color: t.text }]}>{'v' + current}</Text>
        </View>
        <Ionicons name="arrow-forward" color={t.panel.accent} size={18} />
        <View style={styles.version}>
          <DialogCopy centered>{copy.newVersion}</DialogCopy>
          <Text style={[styles.versionNumber, { color: t.panel.accent }]}>{'v' + next}</Text>
        </View>
      </LinearGradient>
      {notes.trim() ? <PanelList inset><PanelRow icon="list-outline" title={copy.releaseNotes} detail={notes.trim()} /></PanelList> : null}
      <DialogCopy>{copy.systemInstallerInstructions}</DialogCopy>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 26, gap: 15 },
  reliability: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11 },
  reliabilityCopy: { flex: 1, minWidth: 0 },
  reliabilityTitle: { fontSize: 14, fontWeight: '700' },
  caption: { fontSize: 12, marginTop: 3 },
  appearance: { padding: 12, gap: 8 },
  groupLabel: { fontSize: 13, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 13, padding: 3, gap: 3, marginBottom: 6 },
  mode: { flex: 1, minHeight: 41, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderRadius: 10 },
  modeText: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  palette: { flexDirection: 'row', gap: 2 },
  swatch: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10 },
  dot: { height: 24, width: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatchName: { fontSize: 10.5, textAlign: 'center' },
  permission: { flexDirection: 'row', gap: 3, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18 },
  permissionLabel: { fontSize: 11.5, fontWeight: '700' },
  versions: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, paddingVertical: 13, gap: 4 },
  version: { flex: 1, alignItems: 'center', gap: 2 },
  versionNumber: { fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
