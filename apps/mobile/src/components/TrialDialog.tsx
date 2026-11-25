import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocale } from '@/i18n';
import { alarmUiCopy } from '@/i18n/alarmUi';
import { commonCopy } from '@/i18n/settings';
import { scheduleTestRing } from '@/scheduler/sync';
import { requestAlarmPermissions } from '@/services/permissions';
import { AppDialog, DialogCopy, DialogSummary } from './AppDialog';
import { PanelButton } from './Panel';
import { useFeedback } from './Feedback';

export function TrialDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const locale = useLocale();
  const copy = alarmUiCopy[locale].trial;
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
      notify(copy.scheduled, copy.lockToCheck);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.checkPermissions);
    } finally {
      scheduling.current = false;
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppDialog title={copy.scheduleFailed} icon="alert-circle-outline" tone="error" layout="center"
        confirm={commonCopy[locale].retry} cancel onClose={onClose} onConfirm={() => void schedule()}>
        <DialogCopy centered>{error}</DialogCopy>
      </AppDialog>
    );
  }
  return (
    <AppDialog title={copy.title} confirm={copy.schedule} cancel onClose={onClose} busy={busy}
      visible={!previewing} onDismiss={previewing ? openPreview : undefined} onConfirm={() => void schedule()}>
      <DialogSummary value={copy.duration} detail={copy.countdownStarts} />
      <DialogCopy>{copy.instructions}</DialogCopy>
      <PanelButton label={copy.preview} icon="open-outline" variant="text" disabled={busy} onPress={() => {
        if (Platform.OS === 'ios') setPreviewing(true);
        else openPreview();
      }} />
    </AppDialog>
  );
}
