import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'prefs.v1' });

export type Prefs = {
  /** 主题色索引,对应 src/theme.tsx 的 THEME_COLORS */
  themeIdx: number;
  setThemeIdx: (i: number) => void;
};

function loadThemeIdx(): number {
  try {
    const raw = mmkv.getString('themeIdx');
    const n = raw ? Number(JSON.parse(raw)) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export const usePrefs = create<Prefs>((set) => ({
  themeIdx: loadThemeIdx(),
  setThemeIdx: (i) => {
    try {
      mmkv.set('themeIdx', JSON.stringify(i));
    } catch {}
    set({ themeIdx: i });
  },
}));
