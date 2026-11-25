import { getCalendars, getLocales, useLocales } from 'expo-localization';
import type { Weekday } from '@core';

export type AppLocale = 'zh-CN' | 'en';

function resolveLocale(locales: ReturnType<typeof getLocales>): AppLocale {
  const supported = locales.find(({ languageCode }) => languageCode === 'zh' || languageCode === 'en');
  return supported?.languageCode === 'zh' ? 'zh-CN' : 'en';
}

export function getLocale(): AppLocale {
  return resolveLocale(getLocales());
}

export function useLocale(): AppLocale {
  return resolveLocale(useLocales());
}

function deviceRegion(): string | null | undefined {
  // Android can put a regionless per-app language ahead of the device locales.
  return getLocales().find(({ regionCode }) => regionCode)?.regionCode;
}

export function formattingLocale(locale: AppLocale): string {
  return locale === 'en' ? `en-${deviceRegion() || 'US'}` : 'zh-CN';
}

export function getFirstWeekday(): Weekday {
  const first = getCalendars()[0]?.firstWeekday;
  // Expo follows the system calendar, whose weekday numbering starts on Sunday.
  return first == null ? (getLocale() === 'zh-CN' ? 1 : 7) : (first === 1 ? 7 : first - 1) as Weekday;
}

export function usesChineseHolidaysByDefault(): boolean {
  const region = deviceRegion();
  return region ? region === 'CN' : getLocale() === 'zh-CN';
}
