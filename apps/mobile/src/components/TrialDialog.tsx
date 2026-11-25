import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { scheduleTestRing } from '@/scheduler/sync';
import { requestAlarmPermissions } from '@/services/permissions';
import { AppDialog, DialogCopy, DialogSummary } from './AppDialog';
import { PanelButton } from './Panel';
import { useFeedback } from './Feedback';

export function TrialDialog({ onClose }: { onClose: () => void }) {
  const notify = useFeedback();
  const [busy, setBusy] = useState(false);
  const scheduling = useRef(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string>();

  function openPreview() {
    onClose();
    router.push({ pathname: '/ring', params: { preview: '1' } });
  }

  async function schedule() {
    if (scheduling.current) return;
    scheduling.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await requestAlarmPermissions();
      await scheduleTestRing();
      onClose();
      notify('已安排试响', '可以锁屏观察。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '请检查响铃权限后重试。');
    } finally {
      scheduling.current = false;
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppDialog title="试响安排失败" icon="alert-circle-outline" tone="error" layout="center"
        confirm="重试" cancel onClose={onClose} onConfirm={() => void schedule()}>
        <DialogCopy centered>{error}</DialogCopy>
      </AppDialog>
    );
  }
  return (
    <AppDialog title="锁屏试响" confirm="安排试响" cancel onClose={onClose} busy={busy}
      visible={!previewing} onDismiss={previewing ? openPreview : undefined} onConfirm={() => void schedule()}>
      <DialogSummary value="30 秒" detail="确认后开始倒计时" />
      <DialogCopy>可锁屏观察，也可以在倒计时内取消。</DialogCopy>
      <PanelButton label="预览应用内响铃" icon="open-outline" variant="text" disabled={busy} onPress={() => {
        if (Platform.OS === 'ios') setPreviewing(true);
        else openPreview();
      }} />
    </AppDialog>
  );
}
