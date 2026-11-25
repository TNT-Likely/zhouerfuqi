import { useState } from 'react';
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { AppDialog, DialogCopy } from '@/components/AppDialog';
import { PanelList, PanelRow, PanelSection } from '@/components/Panel';
import { Sheet } from '@/components/Sheet';
import { useLocale } from '@/i18n';
import { commonCopy } from '@/i18n/settings';
import { aboutCopy } from '@/i18n/support';
import { useTheme } from '@/theme';
import { getVersion } from '../modules/zf-update/src';

const REPO = 'https://github.com/TNT-Likely/zhouerfuqi';
const ios = Platform.OS === 'ios';
const beta = ios ? 'https://testflight.apple.com/join/9vNcHgha' : REPO + '/issues/1';

export default function AboutScreen() {
  const t = useTheme();
  const locale = useLocale();
  const { appName } = commonCopy[locale];
  const copy = aboutCopy[locale];
  const [showTech, setShowTech] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const version = ios ? Constants.expoConfig?.version : getVersion().versionName;
  const open = (url: string) => () => { void Linking.openURL(url).catch(() => setLinkFailed(true)); };

  return (
    <Sheet title={copy.title} appearance="panel">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[t.accentSoft, t.panel.surface]} style={[styles.hero, { borderColor: t.heroBorder }]}>
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
          <Text style={[styles.name, { color: t.text }]}>{appName}</Text>
          <Text style={[styles.tagline, { color: t.panel.muted }]}>{copy.tagline}</Text>
          {version ? <Text style={[styles.version, { color: t.panel.accent, backgroundColor: t.accentSoft }]}>v{version}</Text> : null}
        </LinearGradient>

        <PanelSection title={copy.community}>
          <PanelRow icon="time-outline" title={copy.releases} detail={copy.releasesDetail} onPress={open(REPO + '/releases')} external />
          <PanelRow icon="chatbubble-ellipses-outline" title={copy.feedback} detail={copy.feedbackDetail}
            onPress={open(REPO + '/issues')} external divider />
          <PanelRow icon="flask-outline" title={copy.joinBeta} detail={ios ? copy.testFlight : copy.googlePlay}
            onPress={open(beta)} external divider />
          <PanelRow icon="logo-github" title={copy.sourceCode} onPress={open(REPO)} external divider />
        </PanelSection>

        <PanelSection title={copy.privacy}>
          <PanelRow icon="shield-checkmark-outline" title={copy.localSchedules} detail={copy.localSchedulesDetail} />
          <PanelRow icon="lock-closed-outline" title={copy.privacyPolicy}
            onPress={open(REPO + '/blob/main/docs/privacy.md' + (locale === 'en' ? '#privacy-policy-english' : ''))} external divider />
          <PanelRow icon="settings-outline" title={copy.technicalNotes} onPress={() => setShowTech(true)} divider />
        </PanelSection>
        <Text style={[styles.footer, { color: t.panel.muted }]}>MIT License © 2026 {appName}</Text>
      </ScrollView>
      {showTech ? (
        <AppDialog title={copy.technicalNotes} onClose={() => setShowTech(false)}>
          <PanelList inset>
            <PanelRow icon="calendar-outline" title={copy.scheduleEngine} detail={copy.scheduleEngineDetail} />
            <PanelRow icon="lock-closed-outline" title={copy.localStorage} detail={copy.localStorageDetail} divider />
            <PanelRow icon="alarm-outline" title={copy.alarms} detail={copy.alarmsDetail} divider />
          </PanelList>
        </AppDialog>
      ) : null}
      {linkFailed ? (
        <AppDialog title={copy.linkFailed} layout="center" tone="error" icon="alert-circle-outline" onClose={() => setLinkFailed(false)}>
          <DialogCopy centered>{copy.linkFailedDetail}</DialogCopy>
        </AppDialog>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 15, paddingBottom: 24 },
  hero: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 17, paddingBottom: 12 },
  logo: { width: 60, height: 60, borderRadius: 16 },
  name: { marginTop: 9, fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  tagline: { fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  version: { marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontSize: 11.5, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 11, paddingVertical: 4 },
});
