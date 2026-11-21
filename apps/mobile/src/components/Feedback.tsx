import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { PanelIconTile, type PanelIcon, type PanelTone } from './Panel';

type Feedback = (title: string, detail?: string, tone?: PanelTone, icon?: PanelIcon) => void;
const FeedbackContext = createContext<Feedback>(() => {});

export const useFeedback = () => useContext(FeedbackContext);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [message, setMessage] = useState<{ title: string; detail?: string; tone: PanelTone; icon: PanelIcon }>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Feedback>((title, detail, tone = 'success', icon = 'checkmark') => {
    clearTimeout(timer.current);
    setMessage({ title, detail, tone, icon });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility([title, detail].filter(Boolean).join('。'));
    timer.current = setTimeout(() => setMessage(undefined), 4800);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <FeedbackContext.Provider value={show}>
      <View style={styles.root}>
        {children}
        {message ? (
          <View pointerEvents="none" accessibilityLiveRegion="polite" style={[
            styles.feedback, { bottom: bottom + 12, backgroundColor: t.panel.surface, borderColor: t.panel.border },
          ]}>
            <PanelIconTile icon={message.icon} tone={message.tone} />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: t.text }]}>{message.title}</Text>
              {message.detail ? <Text style={[styles.detail, { color: t.panel.muted }]}>{message.detail}</Text> : null}
            </View>
          </View>
        ) : null}
      </View>
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  feedback: {
    position: 'absolute', left: 14, right: 14, alignSelf: 'center', maxWidth: 460, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 17, borderWidth: 1,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700' },
  detail: { marginTop: 2, fontSize: 12, lineHeight: 17 },
});
