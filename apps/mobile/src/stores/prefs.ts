import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'prefs.v1' });

export type AppearanceMode = 'system' | 'light' | 'dark';

export type Prefs = {
  /** 主题色索引,对应 src/theme.tsx 的 THEME_COLORS */
  themeIdx: number;
  setThemeIdx: (i: number) => void;
  /** 外观模式:跟随系统 / 亮色 / 暗色 */
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  /** 头像 emoji(设置页展示) */
  avatarEmoji: string;
  setAvatarEmoji: (e: string) => void;
  /** 界面语言(v0.2.x 仅中文,预留) */
  lang: 'zh-CN';
  setLang: (l: 'zh-CN') => void;
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = mmkv.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 默认头像 v2.1:破晓 🌅;旧默认 ⏰ 一次性迁移(带标记,用户主动选回 ⏰ 不再覆盖) */
function loadAvatar(): string {
  const dflt = '🌅';
  try {
    const raw = mmkv.getString('avatarEmoji');
    if (raw == null) return dflt;
    const v = JSON.parse(raw) as string;
    if (v === '⏰' && !mmkv.getString('avatarEmojiMigrated')) {
      mmkv.set('avatarEmojiMigrated', JSON.stringify(true));
      return dflt;
    }
    return v || dflt;
  } catch {
    return dflt;
  }
}

export const usePrefs = create<Prefs>((set) => ({
  themeIdx: load('themeIdx', 0),
  setThemeIdx: (i) => {
    try {
      mmkv.set('themeIdx', JSON.stringify(i));
    } catch {}
    set({ themeIdx: i });
  },
  mode: load<AppearanceMode>('mode', 'system'),
  setMode: (m) => {
    try {
      mmkv.set('mode', JSON.stringify(m));
    } catch {}
    set({ mode: m });
  },
  avatarEmoji: loadAvatar(),
  setAvatarEmoji: (e) => {
    try {
      mmkv.set('avatarEmoji', JSON.stringify(e));
    } catch {}
    set({ avatarEmoji: e });
  },
  lang: 'zh-CN',
  setLang: (l) => {
    try {
      mmkv.set('lang', JSON.stringify(l));
    } catch {}
    set({ lang: l });
  },
}));
