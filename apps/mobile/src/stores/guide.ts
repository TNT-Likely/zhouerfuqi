import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'guide.v1' });

function load(): boolean[] {
  try {
    const raw = mmkv.getString('steps');
    return raw ? (JSON.parse(raw) as boolean[]) : [false, false, false];
  } catch {
    return [false, false, false];
  }
}

interface GuideState {
  steps: boolean[];
  toggle: (i: number) => void;
}

export const useGuide = create<GuideState>((set, get) => ({
  steps: load(),
  toggle: (i) => {
    const steps = [...get().steps];
    steps[i] = !steps[i];
    mmkv.set('steps', JSON.stringify(steps));
    set({ steps });
  },
}));
