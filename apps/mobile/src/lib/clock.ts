import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { pad2 } from '@core';

export function clockLabel({ hour, minute }: { hour: number; minute: number }): string {
  return pad2(hour) + ':' + pad2(minute);
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
