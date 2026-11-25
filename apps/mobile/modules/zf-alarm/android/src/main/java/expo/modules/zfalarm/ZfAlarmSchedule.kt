package expo.modules.zfalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import java.text.SimpleDateFormat
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.Locale

internal object ZfAlarmSchedule {
  private const val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  private const val FIND = PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE

  fun allowed(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager(context).canScheduleExactAlarms()

  fun schedule(context: Context, alarm: Map<String, Any?>, accent: String): String? {
    val id = alarm["id"] as? String ?: return null
    val epochMs = (alarm["epochMs"] as? Number)?.toLong() ?: return null
    if (epochMs <= System.currentTimeMillis()) return null
    val prefs = prefs(context)
    val title = alarm["title"] as? String ?: "闹钟"
    val body = alarm["body"] as? String ?: ""
    val groupId = alarm["groupId"] as? String ?: ""
    val timeId = alarm["timeId"] as? String ?: ""
    val timeLabel = alarm["timeLabel"] as? String ?: ""
    val date = alarm["date"] as? String

    cancelLegacy(context, prefs.getLong(id, 0L))
    prefs.edit().putLong(id, epochMs)
      .putString("$id:title", title)
      .putString("$id:body", body)
      .putString("$id:group", groupId)
      .putString("$id:timeId", timeId)
      .putString("$id:timeLabel", timeLabel)
      .putString("$id:accent", accent)
      .putString("$id:date", date)
      .apply()

    val fire = fireIntent(context, id).apply {
      putExtra(AlarmActivity.EXTRA_ID, id)
      putExtra(AlarmActivity.EXTRA_EPOCH, epochMs)
      putExtra(AlarmActivity.EXTRA_TITLE, title)
      putExtra(AlarmActivity.EXTRA_BODY, body)
      putExtra(AlarmActivity.EXTRA_GROUP, groupId)
      putExtra(AlarmActivity.EXTRA_TIME_ID, timeId)
      putExtra(AlarmActivity.EXTRA_TIME_LABEL, timeLabel)
      putExtra(AlarmActivity.EXTRA_ACCENT, accent)
    }
    val firePi = PendingIntent.getBroadcast(context, 0, fire, FLAGS)
    val openPi = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      PendingIntent.getActivity(context, 42, launch, FLAGS)
    }
    manager(context).setAlarmClock(AlarmManager.AlarmClockInfo(epochMs, openPi), firePi)
    return id
  }

  fun restore(context: Context) {
    if (!allowed(context)) return
    val now = System.currentTimeMillis()
    val prefs = prefs(context)
    val format = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)
    for ((id, value) in prefs.all) {
      if (value !is Long) continue
      val time = prefs.getString("$id:timeLabel", null)
      val date = prefs.getString("$id:date", null) ?: id.substringAfterLast(':').takeIf { it.length == 10 }
      val target = if (date != null && time != null) {
        runCatching {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            LocalDateTime.parse("${date}T$time").atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
          } else format.parse("$date $time")?.time
        }.getOrNull() ?: value
      } else value
      if (target <= now) {
        cancel(context, id)
        continue
      }
      schedule(context, mapOf(
        "id" to id, "epochMs" to target, "date" to date,
        "title" to prefs.getString("$id:title", "闹钟"), "body" to prefs.getString("$id:body", ""),
        "groupId" to prefs.getString("$id:group", ""), "timeId" to prefs.getString("$id:timeId", ""),
        "timeLabel" to time,
      ), prefs.getString("$id:accent", "#4096FF") ?: "#4096FF")
    }
  }

  fun isCurrent(context: Context, id: String, epochMs: Long): Boolean =
    prefs(context).getLong(id, 0L) == epochMs

  fun cancel(context: Context, id: String) {
    val prefs = prefs(context)
    cancelLegacy(context, prefs.getLong(id, 0L))
    PendingIntent.getBroadcast(context, 0, fireIntent(context, id), FIND)?.let { pending ->
      manager(context).cancel(pending)
      pending.cancel()
    }
    val editor = prefs.edit().remove(id)
    for (key in listOf("title", "body", "group", "timeId", "timeLabel", "accent", "date")) editor.remove("$id:$key")
    editor.apply()
  }

  private fun fireIntent(context: Context, id: String) =
    Intent(context, ZfAlarmFireReceiver::class.java).setData(identity("scheduled", id))

  fun identity(kind: String, id: String): Uri =
    Uri.Builder().scheme("zf-alarm").authority(kind).appendPath(id).build()

  private fun cancelLegacy(context: Context, epochMs: Long) {
    if (epochMs == 0L) return
    val intent = Intent(context, ZfAlarmFireReceiver::class.java)
    PendingIntent.getBroadcast(context, (epochMs / 1000).toInt(), intent, FIND)?.let { pending ->
      manager(context).cancel(pending)
      pending.cancel()
    }
  }

  private fun manager(context: Context) = context.getSystemService(AlarmManager::class.java)
  private fun prefs(context: Context) = context.getSharedPreferences("zf_alarm_native", Context.MODE_PRIVATE)
}
