import { useState } from 'react';
import { Text } from 'react-native';
import { localDateISO, occurrenceEpoch, planDay, type AlarmGroup, type AlarmTime } from '@core';
import { getHolidayCalendar } from '@/services/holidays';
import { changeDay } from '@/services/dayOverrides';
import { clockLabel } from '@/lib/clock';
import { cnDate } from '@/lib/labels';
import { makeId } from '@/lib/templates';
import { useTheme } from '@/theme';
import { AppDialog, DialogCopy } from './AppDialog';
import { AlarmTimeRows } from './AlarmTimeRows';
import { TimeGridPicker } from './TimeWheel';
import { useFeedback } from './Feedback';

type PendingTime = { id: string; hour: number; minute: number; label: string };

export function suggestTime(date: string): PendingTime {
  const soon = new Date(Date.now() + 120_000);
  const sameDay = localDateISO(soon) === date;
  return { id: makeId('t'), hour: sameDay ? soon.getHours() : 7, minute: sameDay ? soon.getMinutes() : 0, label: '' };
}

export function DayEditor({ group, date, mode, onClose }: {
  group: AlarmGroup; date: string; mode: 'replace' | 'extra'; onClose: () => void;
}) {
  const t = useTheme();
  const notify = useFeedback();
  const extra = mode === 'extra';
  const [times, setTimes] = useState(() => planDay(group, getHolidayCalendar(), date).times);
  const [pending, setPending] = useState<PendingTime | null>(() => extra ? suggestTime(date) : null);
  const [error, setError] = useState('');
  const list = times.filter((time) => time.id !== pending?.id);

  function save(next: AlarmTime | null) {
    try {
      const undo = changeDay(group.id, date, (previous) => next
        ? { ...previous, extraTimes: [...(previous?.extraTimes ?? []), next] }
        : { times });
      onClose();
      notify(next ? '已补一次' : '已修改当天', [cnDate(date), group.name, next ? clockLabel(next) : times.length + ' 次响铃'].join(' · '),
        'success', 'checkmark', { label: '撤销', run: () => {
          if (undo()) notify('已撤销当天调整');
          else notify('这一天有新的修改', '可在月历查看当前安排。', 'warning');
        } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '当天排班保存失败。');
    }
  }

  function confirmTime() {
    if (!pending) return;
    if (list.some((time) => time.hour === pending.hour && time.minute === pending.minute)) {
      setError('这个时间已经在当天的班表里。');
      return;
    }
    if (occurrenceEpoch({ ...pending, date }) <= Date.now()) {
      setError('请选择尚未到达的时间。');
      return;
    }
    const time: AlarmTime = { ...pending, label: pending.label.trim() || undefined };
    if (extra) save(time);
    else {
      setTimes([...list, time].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
      setPending(null);
      setError('');
    }
  }

  return (
    <AppDialog title={extra ? '补一次响铃' : pending ? '选当天的响铃时间' : '仅修改这一天'}
      cancel confirm={extra ? '补这一次' : pending ? '选定时间' : '保存当天'} onConfirm={pending ? confirmTime : () => save(null)}
      onClose={() => {
        if (pending && !extra) {
          setPending(null);
          setError('');
        } else onClose();
      }}>
      <DialogCopy>{cnDate(date)} · {group.name}</DialogCopy>
      {pending ? <TimeGridPicker value={pending} onChange={(value) => {
        setPending({ ...pending, ...value });
        setError('');
      }} /> : (
        <>
          <DialogCopy>{times.length ? '这些时间只在所选日期生效。' : '保存后，这个班组当天休息。'}</DialogCopy>
          <AlarmTimeRows times={times}
            onAdd={() => setPending(suggestTime(date))}
            onEdit={(time) => setPending({ ...time, label: time.label ?? '' })}
            onRemove={(id) => setTimes(times.filter((time) => time.id !== id))} />
        </>
      )}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: t.panel.danger }}>{error}</Text> : null}
    </AppDialog>
  );
}
