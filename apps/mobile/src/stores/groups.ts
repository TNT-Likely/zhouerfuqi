import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { AlarmGroup } from '@core';

const mmkv = createMMKV({ id: 'groups.v1' });

/** 首次启动的种子数据:还原用户当前的真实班制(周一~五 + 大周周六;2026-11-21 为大周周六) */
const SEED: AlarmGroup[] = [
  {
    id: 'work',
    name: '上班',
    enabled: true,
    holidayMode: 'china-smart',
    times: [
      { id: 't1', hour: 6, minute: 40, label: '第一道' },
      { id: 't2', hour: 6, minute: 50, label: '第二道' },
      { id: 't3', hour: 7, minute: 0, label: '底线' },
      { id: 't4', hour: 12, minute: 55, label: '午休' },
    ],
    rule: { kind: 'everyNWeeks', n: 2, weekdays: [1, 2, 3, 4, 5, 6], anchor: '2026-11-21' },
  },
];

function load(): AlarmGroup[] {
  try {
    const raw = mmkv.getString('groups');
    const parsed = raw ? (JSON.parse(raw) as AlarmGroup[]) : [];
    return parsed;
  } catch {
    return [];
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
}

export const useGroups = create<GroupsState>((set, get) => {
  const initial = load();
  if (initial.length === 0) persist(SEED);
  return {
    groups: initial.length ? initial : SEED,
    upsert: (group) => {
      const groups = [...get().groups.filter((g) => g.id !== group.id), group];
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
  };
});
