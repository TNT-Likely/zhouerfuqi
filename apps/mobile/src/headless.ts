import { syncAll } from './scheduler/sync';

/**
 * 每日 03:30 / 开机 / 改时间 / 改时区 → 由 zf-alarm 原生模块通过
 * HeadlessJsTaskService 拉起本任务:无 UI 状态下完成滚动重排。
 */
export function registerResyncHeadless(): void {
  const { AppRegistry } = require('react-native');
  AppRegistry.registerHeadlessTask('ZfResync', () => async () => {
    console.log('[zf] headless resync start');
    try {
      await syncAll();
      console.log('[zf] headless resync done');
    } catch (e: any) {
      console.log('[zf] headless resync failed:', e?.message ?? e);
    }
  });
}
