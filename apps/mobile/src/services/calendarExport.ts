import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { expandGroups, pad2, type AlarmGroup } from '@core';
import { getHolidayCalendar } from './holidays';

function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function fold(line: string): string {
  let result = '';
  let size = 0;
  for (const char of line) {
    const point = char.codePointAt(0)!;
    const bytes = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (size + bytes > 75) {
      result += '\r\n ';
      size = 1;
    }
    size += bytes;
    result += char;
  }
  return result;
}

export async function exportCalendar(groups: AlarmGroup[], start: string, days: number): Promise<void> {
  const items = expandGroups(groups, getHolidayCalendar(), start, days);
  if (!items.length) throw new Error('这段时间内没有已启用的响铃计划。');
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('当前设备无法分享日历文件。');
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//周而复起//Schedule//ZH', 'CALSCALE:GREGORIAN'];
  for (const item of items) {
    const date = item.date.replace(/-/g, '');
    const title = [names.get(item.groupId), item.shiftName, item.label].filter(Boolean).join(' · ');
    lines.push('BEGIN:VEVENT',
      'UID:' + [item.groupId, item.timeId, item.date].map(encodeURIComponent).join('.') + '@zhouerfuqi.local',
      'DTSTAMP:' + stamp,
      'DTSTART:' + date + 'T' + pad2(item.hour) + pad2(item.minute) + '00',
      'DURATION:PT1M',
      'SUMMARY:' + escape(title || '排班响铃'),
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR', '');
  const uri = FileSystem.cacheDirectory + 'zhouerfuqi-' + start + '.ics';
  await FileSystem.writeAsStringAsync(uri, lines.map(fold).join('\r\n'));
  await Sharing.shareAsync(uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: '导出班表' });
}
