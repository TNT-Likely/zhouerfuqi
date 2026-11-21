import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export type PanelIcon = ComponentProps<typeof Ionicons>['name'];
export type PanelTone = 'accent' | 'warning' | 'danger' | 'error' | 'success';

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.panel.muted }]}>{title}</Text>
      <PanelList>{children}</PanelList>
    </View>
  );
}

export function PanelList({ children, inset = false }: { children: ReactNode; inset?: boolean }) {
  const { panel } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: inset ? panel.raised : panel.surface, borderColor: panel.border }]}>
      {children}
    </View>
  );
}

export function PanelIconTile({ icon, tone = 'accent' }: { icon: PanelIcon; tone?: PanelTone }) {
  const t = useTheme();
  const [ink, fill] = panelTone(t, tone);
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.icon, { backgroundColor: fill }]}>
      <Ionicons name={icon} size={17} color={ink} />
    </View>
  );
}

export function panelTone({ panel, accentSoft }: ReturnType<typeof useTheme>, tone: PanelTone) {
  if (tone === 'danger' || tone === 'error') return [panel.danger, panel.dangerSoft] as const;
  if (tone === 'warning') return [panel.warning, panel.warningSoft] as const;
  if (tone === 'success') return [panel.success, panel.successSoft] as const;
  return [panel.accent, accentSoft] as const;
}

export function PanelRow({
  icon, title, detail, value, onPress, divider = false, external = false, tone,
}: {
  icon: PanelIcon;
  title: string;
  detail?: string;
  value?: string | ReactNode;
  onPress?: () => void;
  divider?: boolean;
  external?: boolean;
  tone?: PanelTone;
}) {
  const t = useTheme();
  const content = (
    <>
      <PanelIconTile icon={icon} tone={tone} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: t.panel.muted }]}>{detail}</Text> : null}
      </View>
      {typeof value === 'string' ? <Text style={[styles.rowValue, { color: t.panel.muted }]}>{value}</Text> : value}
      {onPress ? <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={14} color={t.panel.muted} /> : null}
    </>
  );
  const style = [styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.panel.border }];
  return onPress ? (
    <Pressable accessibilityRole={external ? 'link' : 'button'} accessibilityLabel={title}
      accessibilityHint={detail} onPress={onPress}
      style={({ pressed }) => [...style, pressed && { backgroundColor: t.panel.raised }]}>
      {content}
    </Pressable>
  ) : <View style={style}>{content}</View>;
}

export function PanelButton({
  label, onPress, variant = 'secondary', icon, disabled = false, grow = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  icon?: PanelIcon;
  disabled?: boolean;
  grow?: boolean;
}) {
  const t = useTheme();
  const p = t.panel;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const textOnly = variant === 'text';
  const ink = primary ? p.onAction : danger ? p.onDestructive : textOnly ? p.accent : t.text;
  const fill = primary ? p.action : danger ? p.destructive : textOnly ? 'transparent' : p.raised;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        grow && styles.grow,
        { backgroundColor: fill, borderColor: variant === 'secondary' ? p.border : 'transparent' },
        (pressed || disabled) && { opacity: disabled ? 0.48 : 0.75 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={ink} /> : null}
      <Text style={[styles.buttonLabel, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { paddingHorizontal: 2, fontSize: 13, fontWeight: '700' },
  list: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 12, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowValue: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
  button: {
    minHeight: 46, gap: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 15, paddingVertical: 8, paddingHorizontal: 12,
  },
  grow: { flex: 1, minWidth: 0 },
  buttonLabel: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
});
