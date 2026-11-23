package expo.modules.zfalarm

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
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
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 原生全屏响铃 Activity(对标系统时钟):
 * - setAlarmClock 触发 PendingIntent 直达本 Activity,锁屏/杀进程均可全屏接管
 * - showWhenLocked + turnScreenOn + keepScreenOn
 * - 沉浸式全屏:隐藏状态栏/导航栏,挖孔区穿透(整块屏幕都是响铃页)
 * - 设计:「破晓时计」暗底 + 主题色破晓光晕(呼吸动画)+ 细体大字钟面 + 胶囊按钮
 * - 铃声:系统闹钟音循环播放,音量 10 秒渐强;振动循环
 * - 原生按钮:稍后 9 分钟(原生重排)/ 关闭
 * - 自包含:全部状态来自 Intent extras,app 被杀不影响
 */
class AlarmActivity : Activity() {

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private var accentColor = Color.parseColor("#4096FF")
  private val animators = mutableListOf<ValueAnimator>()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 锁屏显示 + 亮屏 + 常亮(flag 兼容 minSdk 24,27+ 走新 API)
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }

    window.attributes = window.attributes.apply {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
      // 响铃页固定 90% 亮度,避免锁屏自动亮度把界面压暗
      screenBrightness = 0.9f
    }

    accentColor = try {
      Color.parseColor(intent.getStringExtra(EXTRA_ACCENT))
    } catch (_: Exception) {
      Color.parseColor("#4096FF")
    }
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "闹钟"
    val groupId = intent.getStringExtra(EXTRA_GROUP) ?: ""
    val timeLabel = intent.getStringExtra(EXTRA_TIME_LABEL) ?: nowLabel()
    val alarmId = intent.getStringExtra(EXTRA_ID)

    // FSI 自动拉起时,清掉通知栏残留(autoCancel 只在用户点击时生效)
    alarmId?.let {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(it.hashCode())
    }

    buildUi(title, groupId, timeLabel)

    // setContentView 创建 DecorView 后才能获取沉浸式全屏的控制器。
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(false)
      window.insetsController?.apply {
        hide(WindowInsets.Type.systemBars())
        systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_FULLSCREEN
          or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
    }

    startRing()
  }

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
  private fun accentTint(alpha: Int): Int = ColorUtils.setAlphaComponent(accentColor, alpha)
  private fun white(alpha: Int): Int = ColorUtils.setAlphaComponent(Color.WHITE, alpha)

  private fun dateLabel(): String =
    SimpleDateFormat("M月d日 EEEE", Locale.CHINA).format(Date())

  private fun buildUi(title: String, groupId: String, timeLabel: String) {
    val dec = AccelerateDecelerateInterpolator()

    // 底:纵向渐变近黑(上冷下沉),光晕单独一层做「破晓」感
    val root = FrameLayout(this).apply {
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.parseColor("#12151C"), Color.parseColor("#06070B")),
      )
    }

    // 破晓光晕:主题色径向渐变,置于顶部(呼吸动画在 startRing 后启动)
    val glow = View(this).apply {
      background = GradientDrawable().apply {
        gradientType = GradientDrawable.RADIAL_GRADIENT
        colors = intArrayOf(accentTint(0x3C), accentTint(0x00))
        setGradientCenter(0.5f, 0.1f)
        setGradientRadius(resources.displayMetrics.widthPixels * 0.78f)
      }
      alpha = 0.85f
    }
    root.addView(
      glow,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        dp(480),
        Gravity.TOP or Gravity.CENTER_HORIZONTAL,
      ),
    )

    val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

    col.addView(View(this), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 0.24f))

    val brand = TextView(this).apply {
      text = "周 而 复 起"
      setTextColor(white(0x66))
      textSize = 11f
      letterSpacing = 0.35f
      gravity = Gravity.CENTER
    }
    col.addView(brand, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    // 钟面:排班时间为大字(原生闹钟语义);贪睡等非时刻文案退回当前时间
    val heroText = if (timeLabel.matches(Regex("^\\d{1,2}:\\d{2}$"))) timeLabel else nowLabel()
    val hero = TextView(this).apply {
      text = heroText
      setTextColor(Color.parseColor("#F4F6FA"))
      textSize = 96f
      typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
      letterSpacing = -0.02f
      includeFontPadding = false
      gravity = Gravity.CENTER
    }
    col.addView(
      hero,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) },
    )

    val date = TextView(this).apply {
      text = dateLabel()
      setTextColor(white(0x8C))
      textSize = 14f
      gravity = Gravity.CENTER
    }
    col.addView(
      date,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) },
    )

    // 闹钟标识胶囊:主题色软底 + 描边;时刻已上大字则不再重复
    val pillParts = mutableListOf<String>()
    if (title.isNotBlank()) pillParts.add(title)
    if (groupId.isNotBlank() && groupId !in pillParts) pillParts.add(groupId)
    if (timeLabel.isNotBlank() && timeLabel != heroText) pillParts.add(timeLabel)
    if (pillParts.isEmpty()) pillParts.add("闹钟")
    val pill = TextView(this).apply {
      text = pillParts.joinToString(" · ")
      setTextColor(accentTint(0xE6))
      textSize = 13f
      maxLines = 1
      ellipsize = android.text.TextUtils.TruncateAt.END
      background = GradientDrawable().apply {
        cornerRadius = dp(40).toFloat()
        setColor(accentTint(0x2E))
        setStroke(dp(1), accentTint(0x55))
      }
      setPadding(dp(18), dp(9), dp(18), dp(9))
    }
    col.addView(
      pill,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(20); gravity = Gravity.CENTER_HORIZONTAL
      },
    )

    // 状态行:呼吸圆点 + 响铃中提示
    val liveRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
    val dot = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(accentColor)
      }
    }
    liveRow.addView(
      dot,
      LinearLayout.LayoutParams(dp(8), dp(8)).apply { gravity = Gravity.CENTER_VERTICAL; marginEnd = dp(8) },
    )
    val live = TextView(this).apply {
      text = "响铃中 · 音量渐强 · 静音/勿扰不影响"
      setTextColor(white(0x73))
      textSize = 12f
    }
    liveRow.addView(live)
    col.addView(
      liveRow,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16) },
    )

    col.addView(View(this), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

    // 按钮排:大胶囊,拇指可达;稍后=描边弱化,关闭=主题色实底
    val btnRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }

    val snoozeBg = GradientDrawable().apply {
      cornerRadius = dp(31).toFloat()
      setColor(white(0x14))
      setStroke(dp(1), white(0x2E))
    }
    val snooze = TextView(this).apply {
      text = "稍后 9 分钟"
      setTextColor(Color.WHITE)
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      background = RippleDrawable(ColorStateList.valueOf(white(0x2E)), snoozeBg, null)
    }
    snooze.setOnClickListener {
      scheduleSnooze()
      stopRing()
      finish()
    }
    btnRow.addView(
      snooze,
      LinearLayout.LayoutParams(0, dp(62), 1f).apply { marginEnd = dp(14) },
    )

    val stopBg = GradientDrawable().apply {
      cornerRadius = dp(31).toFloat()
      setColor(accentColor)
    }
    val stop = TextView(this).apply {
      text = "关 闭"
      setTextColor(Color.WHITE)
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      background = RippleDrawable(ColorStateList.valueOf(white(0x30)), stopBg, null)
    }
    stop.setOnClickListener {
      stopRing()
      finish()
    }
    btnRow.addView(stop, LinearLayout.LayoutParams(0, dp(62), 1f))

    col.addView(
      btnRow,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(20), dp(4), dp(20), dp(4))
      },
    )

    col.addView(View(this), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(20)))

    root.addView(col, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    setContentView(root)

    // 入场:整体淡入,钟面微缩放归位,按钮自下而上
    root.alpha = 0f
    root.animate().alpha(1f).setDuration(240).start()
    hero.alpha = 0f
    hero.scaleX = 0.965f
    hero.scaleY = 0.965f
    hero.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(460).setInterpolator(dec).start()
    btnRow.alpha = 0f
    btnRow.translationY = dp(28).toFloat()
    btnRow.animate().alpha(1f).translationY(0f).setStartDelay(120).setDuration(340).setInterpolator(dec).start()

    // 呼吸动画:光晕明暗 + 圆点脉动(引用存表,退出统一取消)
    animators.add(
      ObjectAnimator.ofFloat(glow, View.ALPHA, 0.5f, 1f).apply {
        duration = 2200
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        interpolator = dec
        start()
      },
    )
    animators.add(
      ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 1100
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        addUpdateListener { a ->
          val f = a.animatedValue as Float
          dot.scaleX = 1f + 0.9f * f
          dot.scaleY = dot.scaleX
          dot.alpha = 1f - 0.55f * f
        }
        start()
      },
    )
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
  }

  private fun stopRing() {
    handler.removeCallbacksAndMessages(null)
    animators.forEach { it.cancel() }
    animators.clear()
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
      putExtra(EXTRA_TITLE, "贪睡")
      putExtra(EXTRA_GROUP, intent.getStringExtra(EXTRA_GROUP) ?: "")
      putExtra(EXTRA_TIME_LABEL, "贪睡 9 分钟后")
      putExtra(EXTRA_ACCENT, String.format("#%06X", 0xFFFFFF and accentColor))
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
