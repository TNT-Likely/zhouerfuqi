import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { AlarmGroup } from '@core';

const mmkv = createMMKV({ id: 'groups.v1' });

function load(): AlarmGroup[] | null {
  try {
    const raw = mmkv.getString('groups');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed as AlarmGroup[] : null;
  } catch {
    return null;
  }
}

function persist(groups: AlarmGroup[]) {
  mmkv.set('groups', JSON.stringify(groups));
}

interface GroupsState {
  groups: AlarmGroup[];
  upsert: (group: AlarmGroup) => void;
  remove: (id: string) => void;
  setEnabled: (id: string, on: boolean) => void;
  replaceAll: (groups: AlarmGroup[]) => void;
}

export const useGroups = create<GroupsState>((set, get) => {
  return {
    groups: load() ?? [],
    upsert: (group) => {
      const current = get().groups;
      const groups = current.some((g) => g.id === group.id)
        ? current.map((g) => g.id === group.id ? group : g)
        : [...current, group];
      persist(groups);
      set({ groups });
    },
    remove: (id) => {
      const groups = get().groups.filter((g) => g.id !== id);
      persist(groups);
      set({ groups });
    },
    setEnabled: (id, on) => {
      const groups = get().groups.map((g) => (g.id === id ? { ...g, enabled: on } : g));
      persist(groups);
      set({ groups });
    },
    replaceAll: (groups) => {
      persist(groups);
      set({ groups });
    },
  };
});
