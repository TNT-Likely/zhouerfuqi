import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/** 设计令牌,与 design/index.html 的 CSS 变量一一对应 */
export const tokens = {
  dark: {
    bg: '#0B1220', surface: '#121B2E', surface2: '#182438', line: '#22304B',
    text: '#EDF2FA', text2: '#8FA3C2', text3: '#5B6E8F',
    primary: '#FF7A45', onPrimary: '#20100A',
    blue: '#4D9DFF', green: '#3ECF8E', amber: '#FFB547', red: '#FF6B6B',
  },
  light: {
    bg: '#F2F6FC', surface: '#FFFFFF', surface2: '#EAF0F8', line: '#D9E3F0',
    text: '#17233B', text2: '#5D6E8C', text3: '#8B9CB8',
    primary: '#FF7A45', onPrimary: '#FFFFFF',
    blue: '#2E7CD6', green: '#149A5E', amber: '#C9821B', red: '#E05252',
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
