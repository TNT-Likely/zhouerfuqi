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
  avatarImage: string | null;
  setAvatarImage: (image: string | null) => void;
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = mmkv.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
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
  avatarImage: load<string | null>('avatarImage', null),
  setAvatarImage: (image) => {
    // Persist the small processed photo, independent of picker caches and file paths.
    mmkv.set('avatarImage', JSON.stringify(image));
    set({ avatarImage: image });
  },
}));
