import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '@/stores/prefs';

/**
 * 设计令牌 v2.1 —— 对齐 design/index.html v2.0「破晓时计」:
 * - 主题色可调:THEME_COLORS 调色板(默认「静海蓝」= 原主题蓝,不变),亮暗两态各自有适配值
 * - 中性表面沿用 v2 方案 D:暗色纯黑 scaffold + #1C1C1E surface + 主题色 30% 边框替代分割线
 * - 亮色:#FAFAFA scaffold + 白卡片 + hairline
 * - accentSoft/heroBg/heroBorder 全部由当前主色派生(换肤即全 app 生效)
 */
export const THEME_COLORS = [
  { name: '静海蓝', light: '#1677FF', dark: '#4096FF' },
  { name: '破晓琥珀', light: '#EA580C', dark: '#FB923C' },
  { name: '松石青翠', light: '#0D9488', dark: '#2DD4BF' },
  { name: '星夜靛蓝', light: '#4F46E5', dark: '#818CF8' },
  { name: '赤陶暖砂', light: '#D94E34', dark: '#F47A60' },
] as const;

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const tokens = {
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    text: '#F0F1ED',
    text2: 'rgba(255,255,255,0.62)',
    text3: 'rgba(255,255,255,0.40)',
    onPrimary: '#FFFFFF',
    green: '#34D399',
    red: '#F87171',
  },
  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surface2: '#F5F5F5',
    text: '#25282C',
    text2: 'rgba(0,0,0,0.54)',
    text3: '#9CA3AF',
    onPrimary: '#FFFFFF',
    green: '#22C55E',
    red: '#EF4444',
  },
} as const;

export type Tokens = {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  text2: string;
  text3: string;
  primary: string;
  onPrimary: string;
  accentSoft: string;
  green: string;
  red: string;
  heroBg: string;
  heroBorder: string;
};

const ThemeContext = createContext<Tokens>(buildTokens('dark', 0));

function buildTokens(scheme: 'dark' | 'light', themeIdx: number): Tokens {
  const base = tokens[scheme];
  const swatch = THEME_COLORS[themeIdx] ?? THEME_COLORS[0]!;
  const primary = scheme === 'dark' ? swatch.dark : swatch.light;
  const soft = scheme === 'dark' ? 0.16 : 0.10;
  const heroA = scheme === 'dark' ? 0.14 : 0.09;
  const heroB = scheme === 'dark' ? 0.34 : 0.24;
  return {
    ...base,
    primary,
    line: scheme === 'dark' ? rgba(primary, 0.30) : '#ECEEEF',
    accentSoft: rgba(primary, soft),
    heroBg: rgba(primary, heroA),
    heroBorder: rgba(primary, heroB),
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const themeIdx = usePrefs((s) => s.themeIdx);
  const t = useMemo(
    () => buildTokens(scheme === 'light' ? 'light' : 'dark', themeIdx),
    [scheme, themeIdx],
  );
  return <ThemeContext.Provider value={t}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Tokens {
  return useContext(ThemeContext);
}
