import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n';
import { commonCopy } from '@/i18n/settings';
import { useTheme } from '@/theme';
import { PanelButton, panelTone, type PanelIcon, type PanelTone } from './Panel';

export type AppDialogContent = {
  title: string;
  children?: ReactNode;
  layout?: 'sheet' | 'center';
  tone?: PanelTone;
  icon?: PanelIcon;
  confirm?: string;
  onConfirm?: () => void;
  cancel?: boolean;
};

export function AppDialog({
  title, children, layout = 'sheet', tone = 'accent', icon = 'information-circle-outline',
  confirm, onConfirm, cancel = false, onClose, busy = false, visible = true, onDismiss,
}: AppDialogContent & { onClose: () => void; busy?: boolean; visible?: boolean; onDismiss?: () => void }) {
  const t = useTheme();
  const copy = commonCopy[useLocale()];
  const p = t.panel;
  const centered = layout === 'center';
  const [ink, fill] = panelTone(t, tone);
  const dismiss = () => { if (!busy) onClose(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent
      onRequestClose={dismiss} onDismiss={onDismiss}>
      <SafeAreaProvider style={styles.fill}>
        <Pressable accessible={false} importantForAccessibility="no" onPress={dismiss}
          style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} />
        <KeyboardAvoidingView pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
          <SafeAreaView pointerEvents="box-none" style={[styles.viewport, centered ? styles.center : styles.bottom]}>
            <View accessibilityViewIsModal style={[
              styles.dialog, { backgroundColor: p.surface, borderColor: p.border },
              centered ? styles.card : styles.sheet,
            ]}>
              {centered ? (
                <LinearGradient pointerEvents="none" colors={[fill, p.surface]} style={styles.glow} />
              ) : (
                <View importantForAccessibility="no" style={[styles.grip, { backgroundColor: p.muted }]} />
              )}
              <View style={[styles.header, centered && styles.cardHeader]}>
                {centered ? (
                  <View style={[styles.mark, { backgroundColor: fill }]}>
                    <Ionicons name={icon} size={25} color={ink} />
                  </View>
                ) : null}
                <Text accessibilityRole="header"
                  style={[styles.title, { color: t.text }, centered ? styles.centerTitle : styles.sheetTitle]}>
                  {title}
                </Text>
                {!centered ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={copy.closeDialog}
                    accessibilityState={{ disabled: busy }} onPress={dismiss} disabled={busy}
                    style={[styles.close, { backgroundColor: p.raised, borderColor: p.border, opacity: busy ? 0.48 : 1 }]}>
                    <Ionicons name="close" size={19} color={p.muted} />
                  </Pressable>
                ) : null}
              </View>
              {children ? (
                <ScrollView
                  style={styles.body}
                  contentContainerStyle={styles.bodyContent}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  bounces={false}
                >
                  {children}
                </ScrollView>
              ) : null}
              <View style={[styles.footer, centered ? styles.cardFooter : { borderTopWidth: 1, borderTopColor: p.border }]}>
                {cancel ? <PanelButton label={copy.cancel} onPress={dismiss} disabled={busy} grow /> : null}
                <PanelButton label={busy ? copy.pleaseWait : (confirm ?? copy.done)} onPress={onConfirm ?? dismiss}
                  variant={tone === 'danger' ? 'danger' : 'primary'} disabled={busy} grow />
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function DialogCopy({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  const { panel } = useTheme();
  return <Text style={[styles.copy, { color: panel.muted }, centered && styles.centerTitle]}>{children}</Text>;
}

export function DialogSummary({ value, detail }: { value: string; detail: string }) {
  const t = useTheme();
  return (
    <LinearGradient colors={[t.panel.raised, t.accentSoft]} style={[styles.summary, { borderColor: t.heroBorder }]}>
      <Text style={[styles.summaryValue, { color: t.text }]}>{value}</Text>
      <DialogCopy centered>{detail}</DialogCopy>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  viewport: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  center: { justifyContent: 'center', paddingHorizontal: 22 },
  bottom: { justifyContent: 'flex-end', paddingHorizontal: 6 },
  dialog: { width: '100%', maxHeight: '100%', flexShrink: 1, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  card: { maxWidth: 334 },
  sheet: { maxWidth: 450 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 148 },
  grip: { width: 34, height: 4, borderRadius: 3, alignSelf: 'center', marginTop: 9, opacity: 0.4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 13 },
  cardHeader: { flexDirection: 'column', gap: 12, paddingTop: 22, paddingBottom: 10 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3 },
  centerTitle: { textAlign: 'center' },
  sheetTitle: { flex: 1 },
  mark: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 18, paddingBottom: 15, gap: 10 },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },
  cardFooter: { paddingTop: 0 },
  copy: { fontSize: 13.5, lineHeight: 21 },
  summary: { alignItems: 'center', gap: 4, borderRadius: 19, borderWidth: 1, padding: 15 },
  summaryValue: { fontVariant: ['tabular-nums'], fontSize: 39, fontWeight: '800', letterSpacing: -1.1 },
});
