import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { cacheDirectory, deleteAsync } from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '@/i18n';
import { planningMessages } from '@/i18n/planning';
import { useTheme } from '@/theme';
import { usePrefs } from '@/stores/prefs';
import { AppDialog, DialogCopy } from './AppDialog';
import { PanelButton } from './Panel';
import { useFeedback } from './Feedback';

const defaultAvatar = require('../../assets/default-avatar.png');
const size = 256;

export function Avatar({ image, size }: { image: string | null; size: number }) {
  return <Image source={image ? { uri: image } : defaultAvatar} resizeMode="cover"
    style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

async function prepareAvatar(uri: string): Promise<string> {
  const initial = ImageManipulator.manipulate(uri, { maxWidth: 2048, maxHeight: 2048 });
  try {
    const original = await initial.renderAsync();
    try {
      const side = Math.min(original.width, original.height);
      const context = ImageManipulator.manipulate(original);
      try {
        const cropped = await context.crop({
          originX: Math.floor((original.width - side) / 2),
          originY: Math.floor((original.height - side) / 2),
          width: side,
          height: side,
        }).resize({ width: size, height: size }).renderAsync();
        try {
          const result = await cropped.saveAsync({ base64: true, compress: 0.86, format: SaveFormat.JPEG });
          await deleteAsync(result.uri, { idempotent: true }).catch(() => {});
          if (!result.base64) throw new Error('Missing image data');
          return 'data:image/jpeg;base64,' + result.base64;
        } finally {
          cropped.release();
        }
      } finally {
        context.release();
      }
    } finally {
      original.release();
    }
  } finally {
    initial.release();
  }
}

export function AvatarEditor({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { avatar: copy } = planningMessages[useLocale()];
  const showFeedback = useFeedback();
  const avatar = usePrefs((state) => state.avatarImage);
  const setAvatar = usePrefs((state) => state.setAvatarImage);
  const [draft, setDraft] = useState(avatar);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const picking = useRef(false);

  async function pickPhoto() {
    if (picking.current) return;
    picking.current = true;
    setBusy(true);
    setError('');
    try {
      const selection = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const uri = selection.assets?.[0]?.uri;
      if (!uri) return;
      try {
        setDraft(await prepareAvatar(uri));
      } finally {
        if (cacheDirectory && uri.startsWith(cacheDirectory)) {
          await deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      }
    } catch {
      setError(copy.readFailed);
    } finally {
      picking.current = false;
      setBusy(false);
    }
  }

  return (
    <AppDialog title={copy.title} confirm={copy.save} cancel onClose={onClose} busy={busy}
      onConfirm={() => {
        if (picking.current) return;
        try {
          setAvatar(draft);
          onClose();
          showFeedback(copy.saved);
        } catch {
          setError(copy.saveFailed);
        }
      }}>
      <LinearGradient colors={[t.accentSoft, t.panel.raised]} style={[styles.preview, { borderColor: t.panel.border }]}>
        <View style={[styles.frame, { backgroundColor: t.panel.surface, borderColor: t.heroBorder }]}>
          <Avatar image={draft} size={84} />
        </View>
        <Text style={[styles.label, { color: t.text }]}>{draft ? copy.custom : copy.default}</Text>
        <DialogCopy centered>{copy.cropHint}</DialogCopy>
      </LinearGradient>
      <View style={styles.actions}>
        <PanelButton label={busy ? copy.loading : copy.choose} icon="image-outline"
          onPress={() => void pickPhoto()} disabled={busy} grow />
        <PanelButton label={copy.reset} variant="text" disabled={busy} onPress={() => {
          setDraft(null);
          setError('');
        }} />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: t.panel.danger }}>{error}</Text> : null}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 19, paddingVertical: 17, paddingHorizontal: 12 },
  frame: { padding: 3, borderRadius: 48, borderWidth: 1, marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 6 },
});
