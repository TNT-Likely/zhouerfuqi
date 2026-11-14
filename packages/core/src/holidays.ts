/**
 * 中国法定节假日数据,格式与 holiday-cn(https://github.com/NateScarlet/holiday-cn,
 * MIT)一致,可直接吞入其发布的年度 JSON。
 */
export interface HolidayDay {
  /** 节日名称,如 "元旦" */
  name: string;
  /** ISO `yyyy-mm-dd` */
  date: string;
  /** true = 放假,false = 调休补班(要上班) */
  isOffDay: boolean;
}

export interface HolidayData {
  /** 按国务院文件标题年份 */
  year: number;
  papers?: string[];
  days: HolidayDay[];
}

export class HolidayCalendar {
  private readonly byDate = new Map<string, boolean>();

  constructor(...datas: HolidayData[]) {
    for (const data of datas) {
      for (const day of data.days) {
        this.byDate.set(day.date, day.isOffDay);
      }
    }
  }

  /**
   * 查询某日状态:
   * - `true`:法定休息日(放假)
   * - `false`:调休补班日(法定要上班)
   * - `undefined`:无数据(普通日子,周末按星期几判断)
   */
  statusOf(date: string): boolean | undefined {
    return this.byDate.get(date);
  }
}
