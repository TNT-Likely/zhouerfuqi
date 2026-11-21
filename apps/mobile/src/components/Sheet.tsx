import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';

/**
 * 模态抽屉容器(v2.1 单主屏架构):
 * - 底部滑出的圆角抽屉(路由层 animation: slide_from_bottom)
 * - 抓握条 + 标题行 + 「完成」关闭,内容区由调用方传入(通常是 ScrollView)
 * - 月历 / 设置 / 关于三屏共用
 */
export function Sheet({
  title,
  right,
  onClose,
  children,
}: {
  title: string;
  right?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.host, { backgroundColor: t.bg }]}>
      <View style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={[styles.handle, { backgroundColor: t.text3 }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {right}
          <Pressable
            onPress={onClose ?? (() => router.back())}
            style={[styles.done, { backgroundColor: t.accentSoft, borderColor: t.heroBorder }]}
            accessibilityLabel={`关闭${title}`}
          >
            <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>完成</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 46,
  },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  done: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
