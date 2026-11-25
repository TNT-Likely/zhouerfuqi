import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getCalendars } from 'expo-localization';
import { formattingLocale, getLocale } from '../i18n';

export function clockLabel({ hour, minute }: { hour: number; minute: number }, locale = getLocale()): string {
  const uses24Hours = getCalendars()[0]?.uses24hourClock ?? (locale === 'zh-CN');
  return new Intl.DateTimeFormat(formattingLocale(locale), {
    hour: uses24Hours ? '2-digit' : 'numeric', minute: '2-digit', hourCycle: uses24Hours ? 'h23' : 'h12',
  }).format(new Date(2000, 0, 1, hour, minute));
}

export function useClock(periodMs: number | null = 15_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = periodMs === null ? undefined : setInterval(tick, periodMs);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') tick(); });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [periodMs]);
  return now;
}
