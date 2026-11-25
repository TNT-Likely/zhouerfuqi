import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, isoWeekday, localDateISO, pad2 } from '@core';
import { WD, cnDate } from '@/lib/labels';
import { useTheme } from '@/theme';
import { AppDialog } from './AppDialog';

export const firstOfMonth = (date: string) => date.slice(0, 7) + '-01';

export function shiftMonth(month: string, amount: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year!, index! - 1 + amount, 1));
  return date.toISOString().slice(0, 10);
}

export function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, index!, 0)).getUTCDate();
}

export type DayBadge = { text: string; tone?: 'accent' | 'warning' | 'muted' | 'success' };
export function MonthGrid({ month, selected, onMonth, onSelect, badge, isMarked }: {
  month: string;
  selected: string;
  onMonth: (month: string) => void;
  onSelect: (date: string) => void;
  badge?: (date: string) => DayBadge | undefined;
  isMarked?: (date: string) => boolean;
}) {
  const t = useTheme();
  const today = localDateISO();
  const p = t.panel;
  const offset = isoWeekday(month) - 1;
  const [year, monthNumber] = month.split('-').map(Number);
  return (
    <View style={[styles.frame, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="上个月" style={styles.arrow}
          onPress={() => onMonth(shiftMonth(month, -1))}>
          <Ionicons name="chevron-back" size={20} color={p.accent} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{year}年{monthNumber}月</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下个月" style={styles.arrow}
          onPress={() => onMonth(shiftMonth(month, 1))}>
          <Ionicons name="chevron-forward" size={20} color={p.accent} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WD.map((day) => <Text key={day} style={[styles.weekday, { color: p.muted }]}>{day}</Text>)}
        {Array.from({ length: offset }, (_, index) => <View key={'spacer' + index} style={styles.cell} />)}
        {Array.from({ length: daysInMonth(month) }, (_, index) => {
          const date = addDays(month, index);
          const item = badge?.(date);
          const active = date === selected;
          const checked = isMarked?.(date);
          const isToday = date === today;
          const color = item?.tone === 'warning' ? p.danger : item?.tone === 'success' ? p.success
            : item?.tone === 'accent' ? p.accent : p.muted;
          const context = [isToday ? '今天' : '', checked ? '已选' : '', item?.text].filter(Boolean).join('，');
          return (
            <View key={date} style={styles.cell}>
              <Pressable accessibilityRole="button" accessibilityLabel={cnDate(date) + (context ? '，' + context : '')}
                accessibilityState={{ selected: checked ?? active }} onPress={() => onSelect(date)}
                style={[styles.day, {
                  borderColor: active ? p.accent : isToday ? t.heroBorder : 'transparent',
                  backgroundColor: active || checked ? t.accentSoft : 'transparent',
                }]}>
                <Text style={[styles.number, { color: t.text, fontWeight: active || isToday ? '800' : '600' }]}>
                  {checked ? '✓ ' : ''}{index + 1}
                </Text>
                {item ? <Text numberOfLines={1} style={[styles.badge, { color }]}>{item.text}</Text> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DateDialog({ title, date, onSelect, onClose }: {
  title: string; date: string; onSelect: (date: string) => void; onClose: () => void;
}) {
  const [selection, setSelection] = useState(date);
  const [month, setMonth] = useState(firstOfMonth(date));
  return (
    <AppDialog title={title} cancel confirm={'选定 ' + selection.slice(5, 7) + ' 月 ' + pad2(Number(selection.slice(8))) + ' 日'}
      onClose={onClose} onConfirm={() => onSelect(selection)}>
      <MonthGrid month={month} selected={selection} onSelect={setSelection} onMonth={setMonth} />
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 3, paddingBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285%', textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 6 },
  cell: { width: '14.285%', padding: 1 },
  day: { minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 3 },
  number: { fontSize: 15, fontVariant: ['tabular-nums'] },
  badge: { fontSize: 10.5, fontWeight: '700' },
});
