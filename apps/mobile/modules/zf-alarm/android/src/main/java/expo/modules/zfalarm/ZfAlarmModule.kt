package expo.modules.zfalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

private const val TAG = "ZfAlarm"

/** Headless 重排任务:app 被杀后由系统拉起 JS 执行 syncAll */
class ZfResyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    Log.i(TAG, "resync task starting")
    return HeadlessJsTaskConfig(TASK_NAME, Arguments.createMap(), TASK_TIMEOUT_MS, true)
  }

  companion object {
    const val TASK_NAME = "ZfResync"
    const val TASK_TIMEOUT_MS = 30000L

    fun startResync(context: Context) {
      Log.i(TAG, "startResync")
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, ZfResyncService::class.java))
    }
  }
}

/** 触发器:每日刷新闹钟 + 开机/改时间/改时区 → 拉起重排 */
class ZfAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.i(TAG, "onReceive action=${intent.action}")
    when (intent.action) {
      ACTION_REFRESHER -> {
        // 自续期:排明天的刷新点,再触发一次重排
        ZfAlarmModule.scheduleRefresherAt(context)
        ZfResyncService.startResync(context)
      }
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_DATE_CHANGED,
      -> ZfResyncService.startResync(context)
    }
  }

  companion object {
    const val ACTION_REFRESHER = "expo.modules.zfalarm.REFRESHER"
    const val REQUEST_CODE = 1001
  }
}

class ZfAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZfAlarm")

    Function("scheduleRefresher") { hour: Int, minute: Int ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      Log.i(TAG, "scheduleRefresher called: $hour:$minute")
      scheduleRefresherAt(context, hour, minute)
      true
    }
  }

  companion object {
    /**
     * 注册/刷新每日刷新精确闹钟。
     * 用 setAlarmClock(与主闹钟同类):MIUI 对非白名单应用的
     * setExactAndAllowWhileIdle 会静默丢弃,而 setAlarmClock 类豁免。
     */
    fun scheduleRefresherAt(context: Context, hour: Int = 3, minute: Int = 30) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
      }
      val pi = PendingIntent.getBroadcast(
        context,
        ZfAlarmReceiver.REQUEST_CODE,
        Intent(context, ZfAlarmReceiver::class.java).setAction(ZfAlarmReceiver.ACTION_REFRESHER),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val info = AlarmManager.AlarmClockInfo(cal.timeInMillis, null)
      am.setAlarmClock(info, pi)
      Log.i(TAG, "refresher scheduled at ${cal.time} (setAlarmClock)")
    }
  }
}
