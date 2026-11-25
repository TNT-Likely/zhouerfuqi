package expo.modules.zfalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * 闹钟触发器:setAlarmClock 到点 → 发全屏意图通知。
 * - 锁屏/灭屏:系统放行 fullScreenIntent → AlarmActivity 全屏接管(BAL 豁免走 FSI 通道)
 * - 亮屏解锁:横幅提醒(heads-up,渠道自带闹钟音)
 * 这是 Android 14+ 下三方闹钟 app 的合规标准姿势(BAL 不拦 FSI 通知)。
 */
class ZfAlarmFireReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmActivity.EXTRA_ID) ?: return
    val epochMs = intent.getLongExtra(AlarmActivity.EXTRA_EPOCH, 0L)
    if (epochMs <= 0L || !ZfAlarmSchedule.isCurrent(context, id, epochMs)) return
    val title = intent.getStringExtra(AlarmActivity.EXTRA_TITLE) ?: "闹钟"
    val body = intent.getStringExtra(AlarmActivity.EXTRA_BODY) ?: ""
    val groupId = intent.getStringExtra(AlarmActivity.EXTRA_GROUP) ?: ""
    val timeId = intent.getStringExtra(AlarmActivity.EXTRA_TIME_ID) ?: ""
    val timeLabel = intent.getStringExtra(AlarmActivity.EXTRA_TIME_LABEL) ?: ""
    val accent = intent.getStringExtra(AlarmActivity.EXTRA_ACCENT) ?: "#4096FF"

    ensureChannel(context)

    val contentIntent = PendingIntent.getActivity(
      context,
      0,
      Intent(context, AlarmActivity::class.java).apply {
        data = ZfAlarmSchedule.identity("ring", id)
        putExtra(AlarmActivity.EXTRA_ID, id)
        putExtra(AlarmActivity.EXTRA_EPOCH, epochMs)
        putExtra(AlarmActivity.EXTRA_TITLE, title)
        putExtra(AlarmActivity.EXTRA_BODY, body)
        putExtra(AlarmActivity.EXTRA_GROUP, groupId)
        putExtra(AlarmActivity.EXTRA_TIME_ID, timeId)
        putExtra(AlarmActivity.EXTRA_TIME_LABEL, timeLabel)
        putExtra(AlarmActivity.EXTRA_ACCENT, accent)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(if (body.isNotEmpty()) body else "响铃 · $timeLabel")
      .setStyle(NotificationCompat.BigTextStyle().bigText(if (body.isNotEmpty()) body else "响铃 · $timeLabel"))
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setContentIntent(contentIntent)
      .setFullScreenIntent(contentIntent, true)
      .setAutoCancel(true)
      .setOngoing(true)
      .setColor(Color.parseColor(accent))
      .build()

    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(id.hashCode(), notification)
    ZfAlarmSchedule.cancel(context, id)
    ZfPlanWidget.refresh(context)
    android.util.Log.i("ZfAlarmFire", "fired: $id (fsi notification posted)")
  }

  companion object {
    const val CHANNEL_ID = "zf_ring_v2"

    fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        "闹钟响铃",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "班制闹钟响铃通道(全屏响铃)"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 400, 300, 400, 300)
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        setSound(sound, Notification.AUDIO_ATTRIBUTES_DEFAULT)
      }
      nm.createNotificationChannel(channel)
    }
  }
}
