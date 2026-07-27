package com.tahajjudplus.app.widget

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.updateAll
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** Shared prefs key for the pending-prayer-logs JSON array — see PendingIntentsBridgeModule. */
const val PENDING_LOGS_KEY = "pending_prayer_logs"
val PrayerKeyParam = ActionParameters.Key<String>("prayer")

/**
 * Short tap-confirmation buzz, matching the app's haptic.light() feel
 * elsewhere (utils/haptic.ts). Glance actions run in-process so, unlike
 * iOS's separate widget extension, this is actually reachable here.
 */
private fun triggerHapticFeedback(context: Context) {
    try {
        val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(40)
        }
    } catch (e: Exception) { /* best-effort — never block the actual log over this */ }
}

/**
 * Lets the widget's "Log" button log a prayer without opening the app.
 * Glance action callbacks run in-process (unlike iOS's separate widget
 * extension), so there's no "app was killed" reliability caveat here —
 * still routed through the same pending-log queue as iOS for one shared
 * drain path in utils/pendingIntents.ts.
 */
class LogPrayerAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val prayer = parameters[PrayerKeyParam] ?: return
        triggerHapticFeedback(context)
        val prefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)

        val entries = mutableListOf<String>()
        val existingRaw = prefs.getString(PENDING_LOGS_KEY, null)
        if (existingRaw != null) {
            try {
                val arr = JSONArray(existingRaw)
                for (i in 0 until arr.length()) entries.add(arr.getString(i))
            } catch (e: Exception) { /* ignore, start fresh */ }
        }
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(java.util.Date())
        entries.add("$prayer|$iso")
        prefs.edit().putString(PENDING_LOGS_KEY, JSONArray(entries).toString()).apply()

        // Optimistic UI: clear the loggable-prayer button immediately rather
        // than waiting for the app to next recompute it.
        val rawWidgetData = prefs.getString("widget_data", null)
        if (rawWidgetData != null) {
            try {
                val json = JSONObject(rawWidgetData)
                json.remove("loggablePrayer")
                prefs.edit().putString("widget_data", json.toString()).apply()
            } catch (e: Exception) { /* ignore */ }
        }

        TahajjudGlanceWidget().updateAll(context)
    }
}
