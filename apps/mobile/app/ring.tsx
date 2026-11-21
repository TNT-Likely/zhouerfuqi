import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { syncAll, snooze } from '@/scheduler/sync';
import { useTheme } from '@/theme';

export default function RingScreen() {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ timeLabel?: string; groupId?: string }>();
  const [state, setState] = useState<'ringing' | 'snoozed' | 'closed'>('ringing');

  const time = params.timeLabel ?? nowLabel();
  const groupLabel = params.groupId === 'work' ? '上班组' : (params.groupId ?? '闹钟');

  return (
    <View style={[styles.root, { backgroundColor: '#0B1220' }]}>
      <Text style={[styles.brand, { top: Math.max(44, top + 8) }]}>周 而 复 起 · 系统级响铃</Text>

      {state === 'closed' ? (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 44, color: t.green }}>✓</Text>
          <Text style={{ color: t.text2, fontSize: 13 }}>闹钟已关闭 · 其余兜底响铃保持待命</Text>
          <Pressable onPress={() => router.dismissAll()}>
            <Text style={{ color: t.primary, fontSize: 13, textDecorationLine: 'underline' }}>返回首页</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={{ color: t.text2, fontSize: 14, marginBottom: 6 }}>响铃中</Text>
          <Text style={styles.time}>{time}</Text>
          <View style={styles.label}>
            <Text style={{ color: t.text, fontSize: 13 }}>{groupLabel}</Text>
          </View>
          <Text style={[styles.sub, { color: state === 'snoozed' ? t.primary : t.text3 }]}>
            {state === 'snoozed' ? '已延后 9 分钟 → 稍后再响' : '音量渐强 · 静音/勿扰不影响'}
          </Text>
        </>
      )}

      {state !== 'closed' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
            onPress={() => {
              void snooze(9, '⏰ 贪睡 · 周而复起');
              setState('snoozed');
            }}
          >
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>稍后 9 分钟</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: t.primary }]}
            onPress={() => {
              void syncAll();
              setState('closed');
            }}
          >
            <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 14 }}>关闭</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function nowLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', fontSize: 11, color: '#5B6E8F', letterSpacing: 3 },
  time: { fontSize: 84, fontWeight: '200', color: '#EDF2FA', letterSpacing: 2, lineHeight: 100 },
  label: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  sub: { marginTop: 10, fontSize: 11 },
  actions: { position: 'absolute', bottom: 44, left: 24, right: 24, flexDirection: 'row', gap: 14 },
  btn: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
});
