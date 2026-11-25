import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { expandGroups, localDateISO, occurrenceEpoch, type AlarmGroup } from '@core';
import { getHolidayCalendar } from './holidays';
import { cnDate } from '../lib/labels';
import { clockLabel } from '../lib/clock';

type WidgetBridge = { updateWidgetPlan(json: string): void };

export function publishWidgetPlan(groups: AlarmGroup[]): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const widget = requireOptionalNativeModule<WidgetBridge>(Platform.OS === 'ios' ? 'ZfAlarmIos' : 'ZfAlarm');
    const names = new Map(groups.map((group) => [group.id, group.name]));
    const now = new Date();
    const items = expandGroups(groups, getHolidayCalendar(), localDateISO(now), 14)
      .map((item) => ({
        epochMs: occurrenceEpoch(item), date: cnDate(item.date), time: clockLabel(item),
        title: [names.get(item.groupId), item.shiftName, item.label].filter(Boolean).join(' · '),
      }))
      .filter((item) => item.epochMs > now.getTime())
      .slice(0, 64);
    widget?.updateWidgetPlan(JSON.stringify(items));
  } catch (error) {
    console.warn('桌面小组件更新失败', error);
  }
}
