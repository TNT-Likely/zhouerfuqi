package expo.modules.zfalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import java.util.Calendar

/** 供 HeadlessJsTaskService 拉起的重排任务配置 */
class ZfResyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(TASK_NAME, Arguments.createBundle(), TASK_TIMEOUT_MS, true)
  }

  companion object {
    const val TASK_NAME = "ZfResync"
    const val TASK_TIMEOUT_MS = 30000L

    fun startResync(context: Context) {
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, ZfResyncService::class.java))
    }
  }
}

class ZfAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_REFRESHER -> {
        // 自续期:排明天的 03:30,再触发一次重排
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

class ZfAlarmModule {
  companion object {
    /** 注册/刷新每日 03:30 自刷新精确闹钟(allow-while-idle,自续期) */
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
      // allow-while-idle:Doze 下也会(宽松)触发,足以完成滚动重排
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
      } else {
        am.setExact(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
      }
    }
  }
}
