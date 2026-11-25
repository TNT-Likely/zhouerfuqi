import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cancelTestRing, useScheduleState } from '@/scheduler/sync';
import { useClock, clockLabel } from '@/lib/clock';
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
  const notify = useFeedback();
  const [busy, setBusy] = useState(false);
  const seconds = Math.max(0, Math.ceil((trial.epochMs - now) / 1000));
  const date = new Date(trial.epochMs);
  const clock = clockLabel({ hour: date.getHours(), minute: date.getMinutes() });
  if (!seconds && (compact || now > trial.epochMs + 120_000)) return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.heroBorder }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>
          {seconds ? '锁屏试响 · ' + seconds + ' 秒' : '试响时间已到'}
        </Text>
        <Text style={{ color: theme.panel.muted, fontSize: 13 }}>
          {seconds ? '已安排在 ' + clock + ' · ' + (trial.delivery === 'notification' ? '通过通知提醒' : '可以锁屏观察')
            : '请确认手机上看到的提醒效果。'}
        </Text>
      </View>
      {seconds ? <PanelButton label={busy ? '取消中…' : '取消试响'} variant="text" disabled={busy} onPress={() => {
        setBusy(true);
        void cancelTestRing(trial.id).then(() => notify('试响已取消'), () => {
          notify('取消试响失败', '请重试。', 'error', 'alert-circle-outline');
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
