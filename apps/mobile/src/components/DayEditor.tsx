import { useState } from 'react';
import { Text } from 'react-native';
import { localDateISO, occurrenceEpoch, planDay, type AlarmGroup, type AlarmTime } from '@core';
import { getHolidayCalendar } from '@/services/holidays';
import { changeDay } from '@/services/dayOverrides';
import { useLocale } from '@/i18n';
import { planningMessages } from '@/i18n/planning';
import { clockLabel } from '@/lib/clock';
import { dateLabel } from '@/lib/labels';
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
  const locale = useLocale();
  const { common, dayEditor: copy } = planningMessages[locale];
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
      notify(next ? copy.extraAdded : copy.daySaved,
        [dateLabel(date, locale), group.name, next ? clockLabel(next, locale) : common.alarmCount(times.length)].join(' · '),
        'success', 'checkmark', { label: common.undo, run: () => {
          if (undo()) notify(copy.undone);
          else notify(common.dayChanged, common.checkCalendar, 'warning');
        } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.saveFailed);
    }
  }

  function confirmTime() {
    if (!pending) return;
    if (list.some((time) => time.hour === pending.hour && time.minute === pending.minute)) {
      setError(copy.duplicateTime);
      return;
    }
    if (occurrenceEpoch({ ...pending, date }) <= Date.now()) {
      setError(copy.needFutureTime);
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
    <AppDialog title={extra ? copy.extraTitle : pending ? copy.selectTitle : copy.editTitle}
      cancel confirm={extra ? copy.addOnce : pending ? copy.chooseTime : copy.saveDay} onConfirm={pending ? confirmTime : () => save(null)}
      onClose={() => {
        if (pending && !extra) {
          setPending(null);
          setError('');
        } else onClose();
      }}>
      <DialogCopy>{dateLabel(date, locale)} · {group.name}</DialogCopy>
      {pending ? <TimeGridPicker value={pending} onChange={(value) => {
        setPending({ ...pending, ...value });
        setError('');
      }} /> : (
        <>
          <DialogCopy>{times.length ? copy.timesDetail : copy.restDetail}</DialogCopy>
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
