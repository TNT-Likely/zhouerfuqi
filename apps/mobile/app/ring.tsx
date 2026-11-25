import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PanelButton } from '@/components/Panel';
import { useFeedback } from '@/components/Feedback';
import { snooze } from '@/scheduler/sync';
import { gateway } from '@/gateway';
import { useTheme } from '@/theme';

export default function RingScreen() {
  const router = useRouter();
  const t = useTheme();
  const notify = useFeedback();
  const { top, bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ timeLabel?: string; title?: string; alarmId?: string; preview?: string }>();
  const preview = params.preview === '1';
  const [state, setState] = useState<'ringing' | 'snoozed' | 'closed'>('ringing');
  const [initial] = useState(() => new Date());
  const [delay, setDelay] = useState(0);
  const [busy, setBusy] = useState(false);
  const sampleTime = new Date(initial.getTime() + delay * 60_000);
  const time = preview || !params.timeLabel || state === 'snoozed' ? formatTime(sampleTime) : params.timeLabel;
  const groupLabel = preview ? '试响预览' : params.title || '闹钟';
  const close = () => {
    if (preview) router.back();
    else router.dismissAll();
  };
  const respond = async (later: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (later && !preview) await snooze(9, groupLabel);
      if (!preview && params.alarmId) await gateway.cancel([params.alarmId]);
      if (later) setDelay(9);
      setState(later ? 'snoozed' : 'closed');
    } catch {
      notify(later ? '无法延后响铃' : '无法停止本次', '请检查系统闹钟权限。', 'error', 'alert-circle-outline');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[t.heroBorder, '#101117', '#090A0D']}
      style={[styles.root, { paddingTop: top + 12, paddingBottom: bottom + 24 }]}>
      <StatusBar style="light" />
      <Text style={styles.brand}>周而复起</Text>

      <View style={styles.content}>
        {state === 'closed' ? (
          <>
            <View style={styles.mark}><Ionicons name="checkmark" size={29} color="#88E3BE" /></View>
            <Text style={styles.result}>闹钟已关闭</Text>
          </>
        ) : (
          <>
            <Text style={styles.muted}>{sampleTime.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</Text>
            <Text style={styles.time} adjustsFontSizeToFit numberOfLines={1}>{time}</Text>
            <Text style={styles.label}>{groupLabel}</Text>
            <Text style={styles.muted}>{state === 'snoozed' ? '已延后 9 分钟' : preview ? '应用内响铃界面预览' : '通知提醒'}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        {state !== 'ringing' ? (
          <>
            {preview ? <PanelButton label="重新预览" onPress={() => { setDelay(0); setState('ringing'); }} /> : null}
            <PanelButton label={preview ? '返回' : '返回首页'} variant="primary" onPress={close} />
          </>
        ) : (
          <>
            <PanelButton label="稍后 9 分钟" disabled={busy} onPress={() => void respond(true)} />
            <PanelButton label="停止本次" variant="primary" disabled={busy} onPress={() => void respond(false)} />
          </>
        )}
      </View>
    </LinearGradient>
  );
}

function formatTime(date: Date): string {
  return [date.getHours(), date.getMinutes()].map((v) => String(v).padStart(2, '0')).join(':');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090A0D', paddingHorizontal: 24 },
  brand: { fontSize: 13, color: '#C5C6CD', fontWeight: '600', textAlign: 'center', minHeight: 24 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  time: {
    maxWidth: '100%', fontSize: 86, lineHeight: 97, fontWeight: '300', color: '#F5F5F4',
    letterSpacing: -3, fontVariant: ['tabular-nums'],
  },
  label: {
    color: '#F5F5F4', fontSize: 13, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30, overflow: 'hidden',
    fontWeight: '600', backgroundColor: '#FFFFFF19',
  },
  muted: { color: '#C5C6CD', fontSize: 13, textAlign: 'center' },
  mark: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#57C59C30', alignItems: 'center', justifyContent: 'center' },
  result: { fontSize: 22, fontWeight: '700', color: '#F5F5F4' },
  actions: { gap: 9 },
});
