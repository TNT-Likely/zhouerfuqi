import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PanelButton } from '@/components/Panel';
import { useFeedback } from '@/components/Feedback';
import { formattingLocale, useLocale } from '@/i18n';
import { alarmUiCopy } from '@/i18n/alarmUi';
import { commonCopy } from '@/i18n/settings';
import { clockLabel } from '@/lib/clock';
import { snooze } from '@/scheduler/sync';
import { gateway } from '@/gateway';
import { useTheme } from '@/theme';

const SNOOZE_MINUTES = 9;

export default function RingScreen() {
  const router = useRouter();
  const t = useTheme();
  const locale = useLocale();
  const copy = alarmUiCopy[locale].ring;
  const notify = useFeedback();
  const { top, bottom, left, right } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ timeLabel?: string; title?: string; alarmId?: string; preview?: string }>();
  const preview = params.preview === '1';
  const [state, setState] = useState<'ringing' | 'snoozed' | 'closed'>('ringing');
  const [initial] = useState(() => new Date());
  const [delay, setDelay] = useState(0);
  const [busy, setBusy] = useState(false);
  const sampleTime = new Date(initial.getTime() + delay * 60_000);
  // Notification payloads retain the wall time as HH:mm, even when the device uses AM/PM.
  const storedTime = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(params.timeLabel ?? '');
  const time = storedTime && !preview && state === 'ringing'
    ? clockLabel({ hour: Number(storedTime[1]), minute: Number(storedTime[2]) }, locale)
    : clockLabel({ hour: sampleTime.getHours(), minute: sampleTime.getMinutes() }, locale);
  const groupLabel = preview ? copy.previewTitle : params.title || copy.alarm;
  const close = () => {
    if (preview) router.back();
    else router.dismissAll();
  };
  const respond = async (later: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (later && !preview) await snooze(SNOOZE_MINUTES, groupLabel);
      if (!preview && params.alarmId) await gateway.cancel([params.alarmId]);
      if (later) setDelay(SNOOZE_MINUTES);
      setState(later ? 'snoozed' : 'closed');
    } catch {
      notify(later ? copy.snoozeFailed : copy.stopFailed, copy.checkPermissions, 'error', 'alert-circle-outline');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[t.heroBorder, '#101117', '#090A0D']} style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.root, {
        paddingTop: top + 12, paddingBottom: bottom + 24, paddingLeft: left + 24, paddingRight: right + 24,
      }]} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>{commonCopy[locale].appName}</Text>

        <View style={styles.content}>
          {state === 'closed' ? (
            <>
              <View style={styles.mark}><Ionicons name="checkmark" size={29} color="#88E3BE" /></View>
              <Text style={styles.result}>{copy.stopped}</Text>
            </>
          ) : (
            <>
              <Text style={styles.muted}>{sampleTime.toLocaleDateString(formattingLocale(locale), {
                month: 'long', day: 'numeric', weekday: 'short', calendar: 'gregory',
              })}</Text>
              <Text style={styles.time} adjustsFontSizeToFit numberOfLines={1}>{time}</Text>
              <Text style={styles.label}>{groupLabel}</Text>
              <Text style={styles.muted}>{state === 'snoozed' ? copy.snoozed(SNOOZE_MINUTES) : preview ? copy.previewDetail : copy.notification}</Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {state !== 'ringing' ? (
            <>
              {preview ? <PanelButton label={copy.previewAgain} onPress={() => { setDelay(0); setState('ringing'); }} /> : null}
              <PanelButton label={preview ? copy.back : copy.backHome} variant="primary" onPress={close} />
            </>
          ) : (
            <>
              <PanelButton label={copy.snooze(SNOOZE_MINUTES)} disabled={busy} onPress={() => void respond(true)} />
              <PanelButton label={copy.stop} variant="primary" disabled={busy} onPress={() => void respond(false)} />
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090A0D' },
  root: { flexGrow: 1 },
  brand: { fontSize: 13, color: '#C5C6CD', fontWeight: '600', textAlign: 'center', minHeight: 24 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 12 },
  time: {
    maxWidth: '100%', fontSize: 86, lineHeight: 97, fontWeight: '300', color: '#F5F5F4',
    letterSpacing: -3, fontVariant: ['tabular-nums'],
  },
  label: {
    color: '#F5F5F4', fontSize: 13, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30, overflow: 'hidden',
    fontWeight: '600', backgroundColor: '#FFFFFF19', textAlign: 'center', maxWidth: '100%',
  },
  muted: { color: '#C5C6CD', fontSize: 13, textAlign: 'center' },
  mark: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#57C59C30', alignItems: 'center', justifyContent: 'center' },
  result: { fontSize: 22, fontWeight: '700', color: '#F5F5F4', textAlign: 'center' },
  actions: { gap: 9, width: '100%', maxWidth: 440, alignSelf: 'center' },
});
