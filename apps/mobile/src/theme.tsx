import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/**
 * 设计令牌 v2 —— 对齐 design/index.html v0.3(参考 beecount-design):
 * - 三主色:主题蓝(主操作/排班) + 放行绿 + 警示红,其余中性灰阶
 * - 暗色方案 D:纯黑 scaffold + #1C1C1E surface + 主题色 30% 边框替代分割线
 * - 亮色:#FAFAFA scaffold + 白卡片 + #ECEEEF hairline
 * - accent 9%/14% 淡染用于 Hero 类强调卡(不再用浓烈渐变)
 */
export const tokens = {
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    line: 'rgba(64,150,255,0.30)', // 主题色 30% 边框(方案 D)
    text: '#F0F1ED',
    text2: 'rgba(255,255,255,0.62)',
    text3: 'rgba(255,255,255,0.40)',
    primary: '#4096FF',
    onPrimary: '#FFFFFF',
    accentSoft: 'rgba(64,150,255,0.16)',
    green: '#34D399',
    red: '#F87171',
    heroBg: 'rgba(64,150,255,0.14)',
    heroBorder: 'rgba(64,150,255,0.34)',
  },
  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surface2: '#F5F5F5',
    line: '#ECEEEF',
    text: '#25282C',
    text2: 'rgba(0,0,0,0.54)',
    text3: '#9CA3AF',
    primary: '#1677FF',
    onPrimary: '#FFFFFF',
    accentSoft: 'rgba(22,119,255,0.10)',
    green: '#22C55E',
    red: '#EF4444',
    heroBg: 'rgba(22,119,255,0.09)',
    heroBorder: 'rgba(22,119,255,0.24)',
  },
} as const;

export type Tokens = { [K in keyof (typeof tokens)['dark']]: string };

const ThemeContext = createContext<Tokens>(tokens.dark);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const t = scheme === 'light' ? tokens.light : tokens.dark;
  return <ThemeContext.Provider value={t}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Tokens {
  return useContext(ThemeContext);
}
