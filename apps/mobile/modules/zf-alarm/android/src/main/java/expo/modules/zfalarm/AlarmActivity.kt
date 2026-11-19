package expo.modules.zfalarm

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * 原生全屏响铃 Activity(对标系统时钟):
 * - setAlarmClock 触发 PendingIntent 直达本 Activity,锁屏/杀进程均可全屏接管
 * - showWhenLocked + turnScreenOn + keepScreenOn
 * - 铃声:系统闹钟音循环播放,音量 10 秒渐强;振动循环
 * - 原生按钮:稍后 9 分钟(原生重排)/ 关闭
 * - 自包含:全部状态来自 Intent extras,app 被杀不影响
 */
class AlarmActivity : Activity() {

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private var accent = "#4096FF"
  private var clockView: TextView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 锁屏显示 + 亮屏 + 常亮(老 API flag 兼容 minSdk 24)
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )

    accent = intent.getStringExtra(EXTRA_ACCENT) ?: "#4096FF"
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "闹钟"
    val groupId = intent.getStringExtra(EXTRA_GROUP) ?: ""
    val timeLabel = intent.getStringExtra(EXTRA_TIME_LABEL) ?: nowLabel()
    val alarmId = intent.getStringExtra(EXTRA_ID)

    // FSI 自动拉起时,清掉通知栏残留(autoCancel 只在用户点击时生效)
    alarmId?.let {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(it.hashCode())
    }

    buildUi(title, groupId, timeLabel)
    startRing()
  }

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

  private fun buildUi(title: String, groupId: String, timeLabel: String) {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#0B1220"))
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(64), dp(24), dp(40))
    }

    val brand = TextView(this).apply {
      text = "周 而 复 起 · 系 统 级 响 铃"
      setTextColor(Color.parseColor("#5B6E8F"))
      textSize = 11f
      letterSpacing = 0.15f
      gravity = Gravity.CENTER
    }
    root.addView(brand, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) })

    val clock = TextView(this).apply {
      text = nowLabel()
      setTextColor(Color.parseColor("#EDF2FA"))
      textSize = 78f
      typeface = Typeface.DEFAULT_BOLD
      letterSpacing = -0.04f
      gravity = Gravity.CENTER
    }
    clockView = clock
    root.addView(clock, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(40) })

    val live = TextView(this).apply {
      text = "响铃中 · 音量渐强 · 静音/勿扰不影响"
      setTextColor(Color.parseColor("#8FA3C4"))
      textSize = 12f
      gravity = Gravity.CENTER
    }
    root.addView(live, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) })

    val chip = TextView(this).apply {
      text = "$title · $timeLabel${if (groupId.isNotEmpty()) " · $groupId" else ""}"
      setTextColor(Color.parseColor("#EDF2FA"))
      textSize = 13f
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#14FFFFFF"))
        cornerRadius = dp(40).toFloat()
        setStroke(dp(1), Color.parseColor("#24FFFFFF"))
      }
      setPadding(dp(16), dp(8), dp(16), dp(8))
    }
    root.addView(chip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(18); gravity = Gravity.CENTER
    })

    val spacer = View(this)
    root.addView(spacer, LinearLayout.LayoutParams(1, 0, 1f))

    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }

    val snooze = Button(this).apply {
      text = "稍后 9 分钟"
      setTextColor(Color.WHITE)
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#1AFFFFFF"))
        cornerRadius = dp(14).toFloat()
      }
      setOnClickListener {
        scheduleSnooze()
        stopRing()
        finish()
      }
    }
    row.addView(snooze, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = dp(12) })

    val stop = Button(this).apply {
      text = "关 闭"
      setTextColor(Color.WHITE)
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      background = GradientDrawable().apply {
        setColor(Color.parseColor(accent))
        cornerRadius = dp(14).toFloat()
      }
      setOnClickListener {
        stopRing()
        finish()
      }
    }
    row.addView(stop, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

    root.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(24) })

    setContentView(root)
  }

  private fun startRing() {
    try {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      player = MediaPlayer().apply {
        setDataSource(this@AlarmActivity, uri)
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        isLooping = true
        prepare()
        // 音量渐强:从 15% 起,10 秒到 100%(STREAM_ALARM 独立于媒体/勿扰音量)
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM).coerceAtLeast(1)
        var step = 0
        val ramp = object : Runnable {
          override fun run() {
            step++
            val pct = 0.15f + 0.085f * step.coerceAtMost(10)
            am.setStreamVolume(AudioManager.STREAM_ALARM, (max * pct).toInt().coerceIn(1, max), 0)
            handler.postDelayed(this, 1000)
          }
        }
        am.setStreamVolume(AudioManager.STREAM_ALARM, (max * 0.15f).toInt().coerceIn(1, max), 0)
        start()
        handler.post(ramp)
      }
    } catch (e: Exception) {
      android.util.Log.e(TAG, "ringtone failed", e)
    }
    vibrator = getSystemService(Vibrator::class.java).apply {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 300, 400, 300), 0))
      } else {
        @Suppress("DEPRECATION")
        vibrate(longArrayOf(0, 400, 300, 400, 300), 0)
      }
    }
    // 每秒刷新时钟
    val tick = object : Runnable {
      override fun run() {
        clockView?.text = nowLabel()
        handler.postDelayed(this, 1000)
      }
    }
    tick.run()
  }

  private fun stopRing() {
    handler.removeCallbacksAndMessages(null)
    try {
      player?.stop()
      player?.release()
    } catch (_: Exception) {}
    player = null
    vibrator?.cancel()
    vibrator = null
  }

  /** 原生贪睡:+9 分钟再响(自包含,不依赖 JS) */
  private fun scheduleSnooze() {
    val epochMs = System.currentTimeMillis() + 9 * 60e3.toLong()
    val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val fire = Intent(this, AlarmActivity::class.java).apply {
      putExtra(EXTRA_ID, "snooze:$epochMs")
      putExtra(EXTRA_EPOCH, epochMs)
      putExtra(EXTRA_TITLE, "⏰ 贪睡 · 周而复起")
      putExtra(EXTRA_GROUP, intent.getStringExtra(EXTRA_GROUP) ?: "")
      putExtra(EXTRA_TIME_LABEL, "贪睡 9 分钟后")
      putExtra(EXTRA_ACCENT, accent)
    }
    val pi = PendingIntent.getActivity(
      this,
      (epochMs / 1000).toInt(),
      fire,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val openPi = PendingIntent.getActivity(
      this,
      (epochMs / 1000).toInt() + 1,
      packageManager.getLaunchIntentForPackage(packageName),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    am.setAlarmClock(AlarmManager.AlarmClockInfo(epochMs, openPi), pi)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    // 响铃页不允许误触返回(必须显式 稍后/关闭)
  }

  override fun onDestroy() {
    stopRing()
    super.onDestroy()
  }

  companion object {
    const val EXTRA_ID = "id"
    const val EXTRA_EPOCH = "epochMs"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_GROUP = "groupId"
    const val EXTRA_TIME_ID = "timeId"
    const val EXTRA_TIME_LABEL = "timeLabel"
    const val EXTRA_ACCENT = "accent"
    const val TAG = "ZfAlarmActivity"
    fun nowLabel(): String {
      val d = java.util.Calendar.getInstance()
      return String.format("%02d:%02d", d.get(java.util.Calendar.HOUR_OF_DAY), d.get(java.util.Calendar.MINUTE))
    }
  }
}
