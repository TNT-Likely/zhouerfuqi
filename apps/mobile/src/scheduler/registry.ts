import { createMMKV } from 'react-native-mmkv';
import type { AlarmDelivery } from '../gateway/types';

const mmkv = createMMKV({ id: 'registry.v1' });

export interface RegistryEntry {
  epochMs: number;
  title: string;
  delivery?: AlarmDelivery;
}

/**
 * 物化注册表:期望注册到原生的响铃集合(id → 时间)。
 * syncAll 以它为基准做 diff,保证幂等。
 */
export const registry = {
  get(): Record<string, RegistryEntry> {
    const raw = mmkv.getString('map');
    try {
      return raw ? (JSON.parse(raw) as Record<string, RegistryEntry>) : {};
    } catch {
      return {};
    }
  },
  set(map: Record<string, RegistryEntry>) {
    mmkv.set('map', JSON.stringify(map));
  },
};
