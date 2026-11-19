import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import type { Tokens } from '@/theme';

/**
 * 自定义时间选择器:网格点选(全可见、零滚动、零玄学)。
 * - 时:0-23 网格;分:00/05/…/55 网格 + ±1 分钟微调
 * - 纯 JS 组件,无原生依赖
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES5 = Array.from({ length: 12 }, (_, i) => i * 5);

function Grid({
  values,
  value,
  onSelect,
  t,
  cols = 6,
}: {
  values: number[];
  value: number;
  onSelect: (v: number) => void;
  t: Tokens;
  cols?: number;
}) {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={styles.grid}>
      {values.map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onSelect(v)}
            style={[
              styles.cell,
              { width: `${100 / cols}%`, backgroundColor: on ? t.primary : t.surface2, borderColor: on ? t.primary : t.line },
            ]}
          >
            <Text style={{ fontSize: 14, fontWeight: on ? '800' : '500', color: on ? t.onPrimary : t.text2, fontVariant: ['tabular-nums'] }}>
              {p2(v)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TimeGridPicker({
  t,
  hour,
  minute,
  label,
  onChange,
  onSubmit,
  submitLabel = '加入',
}: {
  t: Tokens;
  hour: number;
  minute: number;
  label: string;
  onChange: (v: { hour: number; minute: number; label: string }) => void;
  onSubmit?: () => void;
  submitLabel?: string;
}) {
  const setHour = (h: number) => onChange({ hour: h, minute, label });
  const setMinute = (m: number) => onChange({ hour, minute: ((m % 60) + 60) % 60, label });
  const p2 = (n: number) => String(n).padStart(2, '0');

  return (
    <View>
      <View style={[styles.block, { backgroundColor: t.surface2, borderRadius: 18 }]}>
        <Text style={{ color: t.text3, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>时 · HOUR</Text>
        <Grid values={HOURS} value={hour} onSelect={setHour} t={t} cols={6} />
        <Text style={{ color: t.text3, fontSize: 11, letterSpacing: 1, marginVertical: 8 }}>分 · MINUTE(±1 微调)</Text>
        <Grid values={MINUTES5} value={Math.floor(minute / 5) * 5} onSelect={setMinute} t={t} cols={6} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Pressable
            onPress={() => setMinute(minute - 1)}
            style={[styles.fineBtn, { backgroundColor: t.surface, borderColor: t.line }]}
          >
            <Text style={{ color: t.text2, fontSize: 14, fontWeight: '700' }}>−1</Text>
          </Pressable>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', minWidth: 74, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
            {p2(hour)}:{p2(minute)}
          </Text>
          <Pressable
            onPress={() => setMinute(minute + 1)}
            style={[styles.fineBtn, { backgroundColor: t.surface, borderColor: t.line }]}
          >
            <Text style={{ color: t.text2, fontSize: 14, fontWeight: '700' }}>+1</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TextInput
          value={label}
          onChangeText={(v) => onChange({ hour, minute, label: v })}
          placeholder="标签(可选,如「第二道」)"
          placeholderTextColor={t.text3}
          style={[styles.labelInput, { backgroundColor: t.surface, borderColor: t.line, color: t.text }]}
        />
        {onSubmit ? (
          <Pressable style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={onSubmit}>
            <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 13 }}>{submitLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { padding: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 10,
    maxWidth: '15%',
  },
  fineBtn: { width: 46, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  labelInput: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14 },
  addBtn: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
});
