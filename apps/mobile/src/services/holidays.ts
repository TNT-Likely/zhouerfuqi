import { HolidayCalendar, type HolidayData } from '@core';
import data2026 from '../../assets/holidays/2026.json';

// [M1] 内置 holiday-cn 年度快照(离线兜底);在线更新与用户覆盖放 M3
const DATAS: HolidayData[] = [data2026 as HolidayData];
let calendar: HolidayCalendar | null = null;

export function getHolidayCalendar(): HolidayCalendar {
  if (!calendar) calendar = new HolidayCalendar(...DATAS);
  return calendar;
}

export function holidayInfo() {
  return {
    years: DATAS.map((d) => d.year),
    days: DATAS.reduce((n, d) => n + d.days.length, 0),
    source: 'holiday-cn (MIT)',
  };
}
