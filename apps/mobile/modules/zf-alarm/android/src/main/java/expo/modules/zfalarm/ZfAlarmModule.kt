package expo.modules.zfalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
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
        if (ZfAlarmModule.refresherEnabled(context)) ZfAlarmModule.scheduleRefresherAt(context)
        startResync(context)
      }
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_DATE_CHANGED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      -> {
        runCatching {
          ZfAlarmSchedule.restore(context)
          if (ZfAlarmModule.refresherEnabled(context)) ZfAlarmModule.scheduleRefresherAt(context)
        }.onFailure { Log.w(TAG, "Could not restore alarms", it) }
        ZfPlanWidget.refresh(context)
        startResync(context)
      }
    }
  }

  private fun startResync(context: Context) {
    runCatching { ZfResyncService.startResync(context) }.onFailure { Log.w(TAG, "Headless resync unavailable", it) }
  }

  companion object {
    const val ACTION_REFRESHER = "expo.modules.zfalarm.REFRESHER"
    const val REQUEST_CODE = 1001
  }
}

class ZfAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZfAlarm")

    Function("updateWidgetPlan") { json: String ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      ZfPlanWidget.updatePlan(context, json)
    }

    Function("scheduleRefresher") { hour: Int, minute: Int ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      Log.i(TAG, "scheduleRefresher called: $hour:$minute")
      setRefresherPreference(context, true)
      scheduleRefresherAt(context, hour, minute)
      true
    }

    Function("setRefresherEnabled") { enabled: Boolean ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      setRefresherPreference(context, enabled)
      if (enabled) scheduleRefresherAt(context)
      else refresherIntent(context, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)?.let {
        context.getSystemService(AlarmManager::class.java).cancel(it)
        it.cancel()
      }
    }

    Function("scheduleAlarms") { alarms: List<Map<String, Any?>>, accent: String ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      alarms.mapNotNull { ZfAlarmSchedule.schedule(context, it, accent) }
    }

    Function("cancelAlarms") { ids: List<String> ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      ids.forEach { ZfAlarmSchedule.cancel(context, it) }
      true
    }

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      ZfAlarmSchedule.allowed(context)
    }

    Function("canUseFullScreenIntent") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val nm = context.getSystemService(android.app.NotificationManager::class.java)
      Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || nm.canUseFullScreenIntent()
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        .setData(Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function false
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      context.startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
        .setData(Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    }

    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** 拉起「忽略电池优化」系统确认框(闹钟类应用的合规豁免申请) */
    Function("requestIgnoreBatteryOptimization") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
      if (pm.isIgnoringBatteryOptimizations(context.packageName)) return@Function true
      val i = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(i)
      true
    }

    Function("areNotificationsEnabled") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
      nm.areNotificationsEnabled() && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        nm.getNotificationChannel(ZfAlarmFireReceiver.CHANNEL_ID)?.importance != android.app.NotificationManager.IMPORTANCE_NONE)
    }

    Function("ensureAlarmNotificationChannel") {
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      ZfAlarmFireReceiver.ensureChannel(context)
    }

    Function("openNotificationSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      context.startActivity(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      true
    }
  }

  companion object {
    fun refresherEnabled(context: Context): Boolean =
      context.getSharedPreferences("zf_refresher", Context.MODE_PRIVATE).getBoolean("enabled", false)

    private fun setRefresherPreference(context: Context, enabled: Boolean) {
      context.getSharedPreferences("zf_refresher", Context.MODE_PRIVATE).edit().putBoolean("enabled", enabled).apply()
    }

    private fun refresherIntent(context: Context, flags: Int) = PendingIntent.getBroadcast(
      context, ZfAlarmReceiver.REQUEST_CODE,
      Intent(context, ZfAlarmReceiver::class.java).setAction(ZfAlarmReceiver.ACTION_REFRESHER), flags,
    )

    /**
     * 注册/刷新每日刷新精确闹钟。
     * 用 setAlarmClock(与主闹钟同类):MIUI 对非白名单应用的
     * setExactAndAllowWhileIdle 会静默丢弃,而 setAlarmClock 类豁免。
     */
    fun scheduleRefresherAt(context: Context, hour: Int = 3, minute: Int = 30) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (!ZfAlarmSchedule.allowed(context)) return
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
      }
      val pi = refresherIntent(context, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) ?: return
      val info = AlarmManager.AlarmClockInfo(cal.timeInMillis, null)
      am.setAlarmClock(info, pi)
      Log.i(TAG, "refresher scheduled at ${cal.time} (setAlarmClock)")
    }

  }
}
