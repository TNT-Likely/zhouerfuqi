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
import { clockLabel } from '@/lib/clock';
import { cnDate } from '@/lib/labels';
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

const appearances = [
  { mode: 'system', title: '跟随系统' },
  { mode: 'light', title: '日间' },
  { mode: 'dark', title: '暗黑' },
] as const;
const android = Platform.OS === 'android';
const canUpdate = isUpdateSupported();

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTheme();
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
      ...(retry ? { confirm: '重试', onConfirm: retry, cancel: true } : {}),
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
    void run('检查更新失败', async () => {
      const result = await checkUpdate();
      if (result.status === 'error') throw new Error('暂时无法获取版本信息。请检查网络后重试。');
      const current = result.current.versionName;
      if (result.status === 'up-to-date') {
        setDialog({
          title: '已是最新版本', layout: 'center', tone: 'success', icon: 'checkmark',
          children: <DialogCopy centered>{'你正在使用 v' + current + '。'}</DialogCopy>,
        });
        return;
      }
      const info = result.info;
      const install = () => void run('更新失败', async () => {
        await downloadAndInstall(info);
        close();
        notify('安装包已下载', '请在系统安装器中完成更新。', 'success', 'download-outline');
      }, install);
      setDialog({
        title: '发现新版本', confirm: '下载并安装', cancel: true, onConfirm: install,
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
    void run('无法打开响铃权限', async () => {
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
    const resync = () => void run('重新同步失败', async () => {
      await syncAll();
      close();
      const entries = Object.values(useScheduleState.getState().entries);
      const count = entries.filter((entry) => entry.delivery === 'system' || entry.delivery === 'notification').length;
      notify('响铃计划已重新计算', count ? '已登记 ' + count + ' 次提醒。' : '可在设置检查下一次响铃的状态。');
    }, resync);
    setDialog({
      title: '重新同步响铃？', layout: 'center', icon: 'refresh-outline', confirm: '重新同步', cancel: true,
      children: <DialogCopy centered>将按当前排班重新计算未来 14 天的响铃，并同步到系统。</DialogCopy>,
      onConfirm: resync,
    });
  }

  function showHolidays() {
    const refresh = () => void run('节假日更新失败', async () => {
      const added = await refreshHolidays();
      if (added) await syncAll();
      close();
      if (added) notify('节假日已更新', '新年份的数据已用于排班。');
      else notify('暂无新年份数据', '可稍后再次检查。', 'accent', 'calendar-outline');
    }, refresh);
    setDialog({
      title: '节假日数据', confirm: '检查新年份', cancel: true, onConfirm: refresh,
      children: <>
        <DialogSummary value={holiday.years.join(' · ')} detail={`holiday-cn · ${holiday.days} 条假日与补班记录`} />
        <DialogCopy>开启节假日联动后，法定假日跳过响铃，调休补班日按排班提醒。</DialogCopy>
      </>,
    });
  }

  function showExport() {
    const share = () => void run('导出备份失败', async () => {
      await exportBackup(version);
      close();
    }, share);
    setDialog({
      title: '导出备份', confirm: '生成并分享', cancel: true, onConfirm: share,
      children: <>
        <PanelList inset><PanelRow icon="document-text-outline" title="JSON 备份"
          detail="包含班组、响铃时间和保活设置" /></PanelList>
        <DialogCopy>在系统分享面板选择保存位置。</DialogCopy>
      </>,
    });
  }

  function previewRestore(name: string, backup: BackupFile) {
    const current = useGroups.getState().groups;
    const count = backup.groups.length;
    setDialog({
      title: '用备份恢复排班？', layout: 'sheet', tone: 'warning', icon: 'download-outline',
      confirm: '确认恢复', cancel: true,
      children: <>
        <DialogCopy>恢复前会在这台设备保存当前排班的副本。</DialogCopy>
        <PanelList inset>
          <PanelRow icon="document-text-outline" title={name}
            detail={count ? backup.groups.map((group) => group.name).join('、') : '空班表'} tone="warning" />
          <PanelRow icon="swap-horizontal-outline" title={'将替换 ' + current.length + ' 个当前班组'}
            detail={current.map((group) => group.name).join('、')} divider />
        </PanelList>
      </>,
      onConfirm: () => void run('恢复排班失败', async () => {
        await restoreBackup(backup, version);
        setHasRecovery(true);
        try {
          await syncAll();
        } catch (error) {
          showError('排班已恢复，响铃同步失败', error, confirmResync);
          return;
        }
        close();
        notify('排班已恢复', '已恢复 ' + count + ' 个班组。');
      }),
    });
  }

  function selectBackup() {
    if (pending.current) return;
    close();
    void run('导入备份失败', async () => {
      const selection = await pickBackup();
      if (selection) previewRestore(selection.name, selection.backup);
    }, () => {
      if (android) selectBackup();
      else setRepickAfterDismiss(true);
    });
  }

  const permissionsLabel = permissions === null ? '查看通知与闹钟状态'
    : authorized ? (exactAvailable ? '通知与闹钟权限已开启' : '通知权限已开启')
      : '查看需要开启的权限';

  return (
    <Sheet title="设置" appearance="panel">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}
        pointerEvents={busy ? 'none' : 'auto'}>
        <PanelSection title="响铃与可靠性">
          <View style={[styles.reliability, { backgroundColor: t.accentSoft }]}>
            <PanelIconTile icon="shield-checkmark-outline" />
            <View style={styles.reliabilityCopy}>
              <Text style={[styles.reliabilityTitle, { color: t.text }]}>
                {readiness.title}
              </Text>
              <Text style={[styles.caption, { color: p.muted }]}>{next
                ? cnDate(next.date) + ' · ' + clockLabel(next)
                : '安排一个班组后显示下一次响铃。'}</Text>
            </View>
            <PanelButton label="试响" variant="primary" onPress={() => setDialog('trial')} disabled={busy} />
          </View>
          <PanelRow icon="notifications-outline" title="权限状态" detail={permissionsLabel} onPress={openPermissions} divider />
          {android ? (
            <PanelRow icon="shield-outline" title="保活向导" detail="检查通知和后台运行设置"
              onPress={() => router.push('/guide')} divider />
          ) : null}
          <PanelRow icon="refresh-outline" title="重新同步响铃"
            detail={schedule.syncedAt ? '上次同步 · ' + new Date(schedule.syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '登记未来 14 天的响铃'} onPress={confirmResync} divider />
          {android && __DEV__ ? (
            <PanelRow icon="construct-outline" title="注册 03:30 刷新器（调试）" divider onPress={() => {
              try {
                scheduleRefresher(3, 30);
                notify('刷新器已注册');
              } catch (error) {
                showError('注册失败', error);
              }
            }} />
          ) : null}
        </PanelSection>

        <TrialStatus />

        <PanelSection title="外观与个人">
          <View style={styles.appearance}>
            <Text style={[styles.groupLabel, { color: t.text }]}>外观模式</Text>
            <View style={[styles.segment, { backgroundColor: p.raised }]}>
              {appearances.map((item) => {
                const selected = item.mode === mode;
                return (
                  <Pressable key={item.mode} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => setMode(item.mode)}
                    style={[styles.mode, selected && { backgroundColor: p.surface }]}>
                    <Text style={[styles.modeText, { color: selected ? p.accent : p.muted }]}>{item.title}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.groupLabel, { color: t.text }]}>主题色</Text>
            <View style={styles.palette}>
              {THEME_COLORS.map((swatch, i) => {
                const selected = themeIdx === i;
                return (
                  <Pressable key={swatch.name} accessibilityRole="button" accessibilityState={{ selected }}
                    accessibilityLabel={`主题色 ${swatch.name}`} onPress={() => setThemeIdx(i)}
                    style={[styles.swatch, selected && { backgroundColor: t.accentSoft }]}>
                    <View style={[styles.dot, { backgroundColor: swatch[t.scheme] }]}>
                      {selected ? <Ionicons name="checkmark-sharp" size={16} color="#151515" /> : null}
                    </View>
                    <Text style={[styles.swatchName, { color: selected ? t.text : p.muted }]}>{swatch.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <PanelRow icon="person-outline" title="首页头像" value={<Avatar image={avatarImage} size={30} />}
            onPress={() => setDialog('avatar')} divider />
          <PanelRow icon="grid-outline" title="桌面小组件" detail="查看下一次计划响铃" divider onPress={() => setDialog({
            title: '添加桌面小组件',
            children: <DialogCopy>{android ? '长按主屏幕空白处，打开「小组件」，选择周而复起。'
              : '长按主屏幕空白处进入编辑，选择「添加小组件」，搜索周而复起。'}</DialogCopy>,
          })} />
        </PanelSection>

        <PanelSection title="数据与备份">
          <PanelRow icon="calendar-outline" title="法定节假日" detail={`holiday-cn · ${holiday.years.join(' / ')} 年`}
            onPress={showHolidays} />
          <PanelRow icon="share-outline" title="导出备份" detail="生成排班和保活设置的 JSON 文件" onPress={showExport} divider />
          <PanelRow icon="download-outline" title="导入恢复" detail="从备份文件恢复排班" onPress={selectBackup} divider />
          {hasRecovery ? <PanelRow icon="arrow-undo-outline" title="恢复前的本地副本" detail="查看上次恢复前保存的班组" divider
            onPress={() => void run('无法读取本地副本', async () => {
              const recovery = await getRecoveryBackup();
              if (recovery) previewRestore('恢复前的本地副本', recovery);
            })} /> : null}
          <PanelRow icon="calendar-clear-outline" title="导出班表" detail="分享未来 30 天的系统日历文件" divider
            onPress={() => void run('班表导出失败', () => exportCalendar(useGroups.getState().groups, todayISO(), 30))} />
        </PanelSection>

        <PanelSection title="应用">
          <PanelRow icon="cloud-download-outline" title={canUpdate ? '检查更新' : '应用更新'}
            detail={canUpdate ? 'GitHub Releases' : '通过 TestFlight 或安装包更新'}
            value={version ? 'v' + version : undefined} onPress={canUpdate ? checkVersion : undefined} />
          <PanelRow icon="information-circle-outline" title="关于周而复起" detail="版本、开源项目与隐私"
            onPress={() => router.push('/about')} divider />
        </PanelSection>
      </ScrollView>

      {dialog === 'avatar' ? <AvatarEditor onClose={close} /> : null}
      {dialog === 'trial' ? <TrialDialog onClose={close} /> : null}
      {dialog === 'permissions' ? (
        <AppDialog title="响铃权限" onClose={close} busy={busy} onConfirm={changePermissions}
          confirm={authorized ? '完成' : !permissions ? '重新检查' : canRequest ? '开启权限' : '打开系统设置'}>
          <PanelList inset>
            <PanelRow icon="notifications-outline" title="通知权限" detail="显示响铃与锁屏提醒"
              value={<PermissionBadge enabled={permissions?.notifications} />} />
            {exactAvailable ? <PanelRow icon="alarm-outline" title={android ? '精确闹钟' : '闹钟权限'}
              detail="在排班时间触发闹钟" value={<PermissionBadge enabled={permissions?.exactAlarms} />} divider /> : null}
            {android && Number(Platform.Version) >= 34 ? <PanelRow icon="expand-outline" title="全屏提醒"
              value={<PermissionBadge enabled={permissions?.fullScreen} />} divider
              onPress={permissions?.fullScreen === false ? () => void run('无法打开全屏提醒设置', async () => {
                await openAlarmPermissionSettings('fullScreen'); close();
              }) : undefined} /> : null}
          </PanelList>
          {permissions && !authorized ? (
            <DialogCopy>{canRequest ? '开启权限后，可用试响检查响铃。' : '请在系统设置中开启周而复起的响铃权限。'}</DialogCopy>
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
  return (
    <View style={[styles.permission, { backgroundColor: enabled ? p.successSoft : p.warningSoft }]}>
      <Ionicons name={enabled ? 'checkmark' : 'information-circle-outline'} size={13} color={enabled ? p.success : p.warning} />
      <Text style={[styles.permissionLabel, { color: enabled ? p.success : p.warning }]}>
        {enabled === undefined ? '待检查' : enabled ? '已开启' : '待开启'}
      </Text>
    </View>
  );
}

function VersionDetails({ current, next, notes }: { current: string; next: string; notes: string }) {
  const t = useTheme();
  return (
    <>
      <LinearGradient colors={[t.panel.raised, t.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.versions, { borderColor: t.heroBorder }]}>
        <View style={styles.version}>
          <DialogCopy centered>当前版本</DialogCopy>
          <Text style={[styles.versionNumber, { color: t.text }]}>{'v' + current}</Text>
        </View>
        <Ionicons name="arrow-forward" color={t.panel.accent} size={18} />
        <View style={styles.version}>
          <DialogCopy centered>新版本</DialogCopy>
          <Text style={[styles.versionNumber, { color: t.panel.accent }]}>{'v' + next}</Text>
        </View>
      </LinearGradient>
      {notes.trim() ? <PanelList inset><PanelRow icon="list-outline" title="更新内容" detail={notes.trim()} /></PanelList> : null}
      <DialogCopy>下载后将在系统安装器中完成更新。</DialogCopy>
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
