import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';

export type DraftTime = { hour: number; minute: number; label: string };
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const TICKS = Array.from({ length: 29 }, (_, index) => index);
const pad = (value: number) => String(value).padStart(2, '0');

function TimeGrid({ label, unit, values, value, onChange }: {
  label: string;
  unit: '时' | '分';
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.fieldLabel, { color: t.panel.muted }]}>{label}</Text>
      {Array.from({ length: values.length / 6 }, (_, row) => (
        <View key={row} style={styles.row}>
          {values.slice(row * 6, row * 6 + 6).map((item) => {
            const selected = value === item;
            return (
              <Pressable key={item} accessibilityRole="button" accessibilityLabel={pad(item) + ' ' + unit}
                accessibilityState={{ selected }} onPress={() => onChange(item)}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: selected ? t.accentSoft : t.panel.raised,
                    borderColor: selected ? t.heroBorder : t.panel.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.cellText, { color: selected ? t.panel.accent : t.text, fontWeight: selected ? '800' : '600' }]}>
                  {pad(item)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function TimeGridPicker({ value, onChange }: {
  value: DraftTime;
  onChange: (value: DraftTime) => void;
}) {
  const t = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { hour, minute, label } = value;
  const dialSize = Math.min(50, width * 0.127, (width - 138) / (3 * fontScale));
  function step(delta: number) {
    const total = (hour * 60 + minute + delta + 1440) % 1440;
    onChange({ ...value, hour: Math.floor(total / 60), minute: total % 60 });
  }

  return (
    <>
      <LinearGradient colors={[t.panel.raised, t.accentSoft]} style={[styles.dial, { borderColor: t.heroBorder }]}>
        <View style={styles.dialRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="减少一分钟" onPress={() => step(-1)}
            style={[styles.adjust, { backgroundColor: t.panel.surface }]}>
            <Text style={[styles.stepText, { color: t.panel.accent }]}>−1</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={[styles.time, { color: t.text, fontSize: dialSize }]}>
            {pad(hour)}:{pad(minute)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="增加一分钟" onPress={() => step(1)}
            style={[styles.adjust, { backgroundColor: t.panel.surface }]}>
            <Text style={[styles.stepText, { color: t.panel.accent }]}>+1</Text>
          </Pressable>
        </View>
        <View importantForAccessibility="no" style={styles.ticks}>
          {TICKS.map((index) => <View key={index}
            style={{ width: 1, height: index % 4 === 0 ? 7 : 4, backgroundColor: t.panel.accent, opacity: 0.43 }} />)}
        </View>
      </LinearGradient>
      <TimeGrid label="小时" unit="时" values={HOURS} value={hour} onChange={(hour) => onChange({ ...value, hour })} />
      <TimeGrid label="分钟" unit="分" values={MINUTES} value={minute} onChange={(minute) => onChange({ ...value, minute })} />
      <View style={styles.group}>
        <Text style={[styles.fieldLabel, { color: t.panel.muted }]}>标签（可选）</Text>
        <TextInput accessibilityLabel="响铃标签" value={label} maxLength={24} onChangeText={(label) => onChange({ ...value, label })}
          placeholder="例如午休" placeholderTextColor={t.panel.muted}
          style={[styles.input, { backgroundColor: t.panel.raised, borderColor: t.panel.border, color: t.text }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 13.5, fontVariant: ['tabular-nums'] },
  dial: { paddingHorizontal: 10, paddingVertical: 9, gap: 8, borderRadius: 19, borderWidth: 1 },
  dialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  adjust: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 14, fontWeight: '700' },
  time: { fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 7 },
  input: { minHeight: 44, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderRadius: 11, fontSize: 14 },
});
