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

    /**
     * setAlarmClock 到点触发 ZfAlarmFireReceiver，由闹钟通知打开 AlarmActivity。
     * requestCode = epochMs/1000(确定性,取消可重算);id→epochMs 存 SharedPreferences。
     */
    Function("scheduleAlarms") { alarms: List<Map<String, Any?>>, accent: String ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      var count = 0
      for (a in alarms) {
        val id = a["id"] as? String ?: continue
        val epochMs = (a["epochMs"] as? Double)?.toLong() ?: continue
        val title = a["title"] as? String ?: "闹钟"
        val body = a["body"] as? String ?: ""
        val groupId = a["groupId"] as? String ?: ""
        val timeId = a["timeId"] as? String ?: ""
        val timeLabel = a["timeLabel"] as? String ?: ""
        val requestCode = (epochMs / 1000).toInt()

        prefs.edit()
          .putLong(id, epochMs)
          .putString("$id:title", title)
          .putString("$id:body", body)
          .putString("$id:group", groupId)
          .putString("$id:timeId", timeId)
          .putString("$id:timeLabel", timeLabel)
          .putString("$id:accent", accent)
          .apply()

        val fire = Intent(context, ZfAlarmFireReceiver::class.java).apply {
          putExtra(AlarmActivity.EXTRA_ID, id)
          putExtra(AlarmActivity.EXTRA_EPOCH, epochMs)
          putExtra(AlarmActivity.EXTRA_TITLE, title)
          putExtra(AlarmActivity.EXTRA_BODY, body)
          putExtra(AlarmActivity.EXTRA_GROUP, groupId)
          putExtra(AlarmActivity.EXTRA_TIME_ID, timeId)
          putExtra(AlarmActivity.EXTRA_TIME_LABEL, timeLabel)
          putExtra(AlarmActivity.EXTRA_ACCENT, accent)
        }
        val firePi = PendingIntent.getBroadcast(
          context, requestCode, fire,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val openPi = PendingIntent.getActivity(
          context, requestCode + 1,
          context.packageManager.getLaunchIntentForPackage(context.packageName),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        am.setAlarmClock(AlarmManager.AlarmClockInfo(epochMs, openPi), firePi)
        count++
      }
      Log.i(TAG, "scheduleAlarms: $count scheduled")
      true
    }

    Function("cancelAlarms") { ids: List<String> ->
      val context = appContext.reactContext?.applicationContext ?: throw Exception("React context unavailable")
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      var count = 0
      for (id in ids) {
        val epochMs = prefs.getLong(id, 0L)
        if (epochMs == 0L) continue
        val requestCode = (epochMs / 1000).toInt()
        am.cancel(
          PendingIntent.getBroadcast(
            context, requestCode,
            Intent(context, ZfAlarmFireReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        )
        prefs.edit().remove(id).remove("$id:title").remove("$id:body").remove("$id:group")
          .remove("$id:timeId").remove("$id:timeLabel").remove("$id:accent").apply()
        count++
      }
      Log.i(TAG, "cancelAlarms: $count cancelled")
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
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) nm.areNotificationsEnabled() else true
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

    const val PREFS = "zf_alarm_native"
  }
}
