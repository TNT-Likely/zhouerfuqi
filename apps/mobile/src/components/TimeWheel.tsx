import { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, type ScrollViewInstance } from 'react-native';
import type { Tokens } from '@/theme';

/**
 * 纯 JS 双列滚轮时间选择器(小时 + 分钟),零原生依赖。
 * - ScrollView snapToInterval 模拟 iOS 滚轮,中间高亮行
 * - 用于班组编辑页「自定义时间」:选定后回调 hour/minute + 可选标签
 */

const ITEM_H = 44;
const VISIBLE = 5; // 奇数,中间行高亮
const PAD = (VISIBLE - 1) / 2;

function Wheel({
  count,
  width,
  value,
  onChange,
  render,
  t,
}: {
  count: number;
  width: number;
  value: number;
  onChange: (v: number) => void;
  render: (i: number) => string;
  t: Tokens;
}) {
  const ref = useRef<ScrollViewInstance>(null);
  const lastEmitted = useRef(value);
  const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  // 外部 value 变化时滚动到对应行
  useEffect(() => {
    if (lastEmitted.current !== value) {
      ref.current?.scrollTo({ y: value * ITEM_H, animated: true });
      lastEmitted.current = value;
    }
  }, [value]);

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const idx = Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (idx !== lastEmitted.current) {
      lastEmitted.current = idx;
      onChange(idx);
    }
  };

  // 初始定位
  useEffect(() => {
    ref.current?.scrollTo({ y: value * ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.wheel, { width }]}>
      {/* 上下渐隐遮罩 */}
      <View style={{ height: PAD * ITEM_H }} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      >
        {items.map((i) => {
          const active = i === value;
          return (
            <View key={i} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: active ? 22 : 17,
                  fontWeight: active ? '800' : '400',
                  color: active ? t.text : t.text3,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {render(i)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ height: PAD * ITEM_H }} />
      {/* 中央选框(仅上下高亮线) */}
      <View pointerEvents="none" style={[styles.selBox, { top: PAD * ITEM_H, borderColor: t.primary }]} />
    </View>
  );
}

export function TimeWheelPicker({
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
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  const [lbl, setLbl] = useState(label);

  // 防抖回传(滚轮连滑时频繁 setState 父组件会抖)
  useEffect(() => {
    const id = setTimeout(() => onChange({ hour: h, minute: m, label: lbl }), 120);
    return () => clearTimeout(id);
  }, [h, m, lbl]);

  const p2 = (n: number) => String(n).padStart(2, '0');

  return (
    <View>
      <View style={[styles.wheelRow, { backgroundColor: t.surface2, borderRadius: 18 }]}>
        <Wheel count={24} width={72} value={h} onChange={setH} render={(i) => p2(i)} t={t} />
        <Text style={{ color: t.text3, fontSize: 20, fontWeight: '800' }}>:</Text>
        <Wheel count={60} width={72} value={m} onChange={setM} render={(i) => p2(i)} t={t} />
        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 14 }}>
          <Text style={{ color: t.text3, fontSize: 11, lineHeight: 16 }}>滑动选择{'\n'}时 · 分</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TextInput
          value={lbl}
          onChangeText={(v) => setLbl(v)}
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
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
  },
  wheel: { height: ITEM_H * VISIBLE, overflow: 'hidden' },
  selBox: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRadius: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  labelInput: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14 },
  addBtn: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
});
