/** 原生网关接口:上层只认接口,实现可替换(notify-kit → AlarmKit → 自研引擎) */
export interface MaterializedAlarm {
  /** `${groupId}:${timeId}:${date}`,物化注册表的幂等键 */
  id: string;
  /** 本地时区的触发时刻 */
  epochMs: number;
  groupId: string;
  timeId: string;
  timeLabel: string;
  title: string;
  body: string;
}

export interface AlarmPermissionStatus {
  notifications: boolean;
  exactAlarms: boolean;
}

export interface AlarmGateway {
  init(): Promise<void>;
  schedule(alarms: MaterializedAlarm[]): Promise<void>;
  cancel(ids: string[]): Promise<void>;
  requestPermissions(): Promise<AlarmPermissionStatus>;
  status(): Promise<AlarmPermissionStatus>;
}
