package expo.modules.zfalarm

import android.content.Context
import android.text.format.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal object ZfAlarmDisplay {
  fun time(context: Context, epochMs: Long): String =
    format(context, epochMs, if (DateFormat.is24HourFormat(context)) "Hm" else "hm")

  fun format(context: Context, epochMs: Long, skeleton: String): String {
    val locales = context.resources.configuration.locales
    val locale = (0 until locales.size()).asSequence()
      .mapNotNull { locales[it] }.firstOrNull { it.language == "en" || it.language == "zh" }
      ?: Locale.ENGLISH
    val pattern = DateFormat.getBestDateTimePattern(locale, skeleton)
    return SimpleDateFormat(pattern, locale).format(Date(epochMs))
  }
}
