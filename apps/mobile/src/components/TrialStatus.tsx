import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cancelTestRing, useScheduleState } from '@/scheduler/sync';
import { useClock, clockLabel } from '@/lib/clock';
import { useLocale } from '@/i18n';
import { alarmUiCopy } from '@/i18n/alarmUi';
import { useTheme } from '@/theme';
import { PanelButton } from './Panel';
import { useFeedback } from './Feedback';

export function TrialStatus({ compact = false }: { compact?: boolean }) {
  const trial = useScheduleState((state) => state.trial);
  return trial ? <ActiveTrial key={trial.id} trial={trial} compact={compact} /> : null;
}

function ActiveTrial({ trial, compact }: {
  trial: NonNullable<ReturnType<typeof useScheduleState.getState>['trial']>;
  compact: boolean;
}) {
  const clockNow = Date.now();
  const now = useClock(clockNow < trial.epochMs ? 1000 : clockNow < trial.epochMs + 120_000 ? 10_000 : null);
  const theme = useTheme();
  const locale = useLocale();
  const copy = alarmUiCopy[locale].trial;
  const notify = useFeedback();
  const [busy, setBusy] = useState(false);
  const seconds = Math.max(0, Math.ceil((trial.epochMs - now) / 1000));
  const date = new Date(trial.epochMs);
  const clock = clockLabel({ hour: date.getHours(), minute: date.getMinutes() }, locale);
  if (!seconds && (compact || now > trial.epochMs + 120_000)) return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.heroBorder }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>
          {seconds ? copy.countdown(seconds) : copy.elapsed}
        </Text>
        <Text style={{ color: theme.panel.muted, fontSize: 13 }}>
          {seconds ? copy.atTime(clock) + ' · ' + (trial.delivery === 'notification' ? copy.viaNotification : copy.lockToObserve)
            : copy.elapsedDetail}
        </Text>
      </View>
      {seconds ? <PanelButton label={busy ? copy.canceling : copy.cancel} variant="text" disabled={busy} onPress={() => {
        setBusy(true);
        void cancelTestRing(trial.id).then(() => notify(copy.canceled), () => {
          notify(copy.cancelFailed, copy.tryAgain, 'error', 'alert-circle-outline');
          setBusy(false);
        });
      }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 17, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
