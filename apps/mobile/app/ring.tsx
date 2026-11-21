import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PanelButton } from '@/components/Panel';
import { useFeedback } from '@/components/Feedback';
import { syncAll, snooze } from '@/scheduler/sync';
import { useTheme } from '@/theme';

export default function RingScreen() {
  const t = useTheme();
  const notify = useFeedback();
  const { top, bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ timeLabel?: string; groupId?: string; preview?: string }>();
  const preview = params.preview === '1';
  const [state, setState] = useState<'ringing' | 'snoozed' | 'closed'>('ringing');
  const [initial] = useState(() => new Date());
  const [delay, setDelay] = useState(0);
  const sampleTime = new Date(initial.getTime() + delay * 60_000);
  const time = preview || !params.timeLabel ? formatTime(sampleTime) : params.timeLabel;
  const groupLabel = preview ? '试响预览' : params.groupId === 'work' ? '上班组' : params.groupId || '闹钟';
  const close = () => {
    if (preview) router.back();
    else router.dismissAll();
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
            <Text style={styles.muted}>{state === 'snoozed' ? `已延后 ${delay} 分钟` : preview ? '用于查看响铃界面' : '响铃中 · 音量渐强'}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        {state === 'closed' ? (
          <>
            {preview ? <PanelButton label="重新预览" onPress={() => { setDelay(0); setState('ringing'); }} /> : null}
            <PanelButton label={preview ? '返回' : '返回首页'} variant="primary" onPress={close} />
          </>
        ) : (
          <>
            <PanelButton label={preview && state === 'snoozed' ? '再延后 9 分钟' : '稍后 9 分钟'} onPress={() => {
              if (preview) {
                setDelay((minutes) => minutes + 9);
                setState('snoozed');
                return;
              }
              void snooze(9, '贪睡 · 周而复起').then(() => {
                setDelay(9);
                setState('snoozed');
              }).catch(() => notify('无法延后响铃', '请检查系统闹钟权限。', 'error', 'alert-circle-outline'));
            }} />
            <PanelButton label="关闭本次闹钟" variant="primary" onPress={() => {
              if (!preview) void syncAll().catch(() => {});
              setState('closed');
            }} />
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
