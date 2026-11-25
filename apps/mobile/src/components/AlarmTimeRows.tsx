import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AlarmTime } from '@core';
import { clockLabel } from '@/lib/clock';
import { useTheme } from '@/theme';
import { PanelButton } from './Panel';

export function AlarmTimeRows({ times, onEdit, onAdd, onRemove }: {
  times: AlarmTime[];
  onEdit: (time: AlarmTime) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.list}>
      {times.map((time) => (
        <View key={time.id} style={[styles.row, { backgroundColor: t.panel.raised, borderColor: t.panel.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={['编辑', clockLabel(time), time.label].filter(Boolean).join(' ')}
            onPress={() => onEdit(time)} style={styles.content}>
            <Text style={[styles.clock, { color: t.text }]}>{clockLabel(time)}</Text>
            {time.label ? <Text style={[styles.label, { color: t.panel.muted }]}>{time.label}</Text> : null}
            <Ionicons name="create-outline" size={17} color={t.panel.accent} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={'移除 ' + clockLabel(time)}
            onPress={() => onRemove(time.id)} style={styles.remove}>
            <Ionicons name="close-outline" size={20} color={t.panel.danger} />
          </Pressable>
        </View>
      ))}
      <PanelButton label="添加响铃" icon="add" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 7 },
  row: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: 13 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, padding: 10, minHeight: 50 },
  clock: { fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, flexShrink: 1 },
  remove: { minWidth: 46, alignItems: 'center', justifyContent: 'center' },
});
