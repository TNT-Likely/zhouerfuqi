package expo.modules.zfalarm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONArray

class ZfPlanWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) manager.updateAppWidget(id, views(context))
  }

  companion object {
    private const val PREFS = "zf_widget"

    fun updatePlan(context: Context, json: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("items", json).apply()
      refresh(context)
    }

    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, ZfPlanWidget::class.java)
      if (manager.getAppWidgetIds(provider).isNotEmpty()) manager.updateAppWidget(provider, views(context))
    }

    private fun views(context: Context): RemoteViews {
      val items = JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("items", "[]"))
      val now = System.currentTimeMillis()
      val next = (0 until items.length()).asSequence().map { items.getJSONObject(it) }
        .firstOrNull { it.getLong("epochMs") > now }
      return RemoteViews(context.packageName, R.layout.zf_widget).apply {
        setTextViewText(R.id.zf_widget_time, next?.optString("time") ?: "—")
        setTextViewText(R.id.zf_widget_title, next?.optString("title") ?: context.getString(R.string.zf_widget_empty))
        setTextViewText(R.id.zf_widget_date, next?.optString("date").orEmpty())
        setContentDescription(R.id.zf_widget_root, listOfNotNull(
          context.getString(R.string.zf_widget_caption),
          next?.optString("date"), next?.optString("time"), next?.optString("title"),
        ).joinToString("，"))
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
          val tap = PendingIntent.getActivity(context, 43, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
          setOnClickPendingIntent(R.id.zf_widget_root, tap)
        }
      }
    }
  }
}
