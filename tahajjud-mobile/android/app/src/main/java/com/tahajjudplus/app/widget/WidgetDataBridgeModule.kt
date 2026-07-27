package com.tahajjudplus.app.widget

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Writes prayer/streak and dua data to shared prefs so the Glance widgets can
 * read it, then refreshes them — the Android analog of ios/Tahajjud/WidgetDataBridge.swift
 * writing to App Group UserDefaults and calling WidgetCenter.reloadAllTimelines().
 */
class WidgetDataBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val bridgeScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun getName() = "WidgetDataBridge"

    /**
     * Called from React Native with:
     *   - nextPrayer:     name of the next prayer (e.g. "Dhuhr")
     *   - nextPrayerTime: Unix timestamp (seconds) of the next prayer
     *   - streak:         current Tahajjud streak count
     *   - tahajjudStart:  Unix timestamp (seconds) of tonight's last-third start (0 if unknown)
     *   - loggablePrayer: lowercase key of a daily prayer that's started but isn't logged yet ("" if none)
     */
    @ReactMethod
    fun writeWidgetData(nextPrayer: String, nextPrayerTime: Double, streak: Double, tahajjudStart: Double, loggablePrayer: String) {
        val prefs = reactApplicationContext.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val payload = JSONObject().apply {
            put("nextPrayer", nextPrayer)
            put("nextPrayerTime", nextPrayerTime)
            put("streak", streak.toInt())
            put("updatedAt", System.currentTimeMillis() / 1000.0)
            if (tahajjudStart > 0) put("tahajjudStart", tahajjudStart)
            if (loggablePrayer.isNotEmpty()) put("loggablePrayer", loggablePrayer)
        }
        prefs.edit().putString("widget_data", payload.toString()).apply()
        refreshAllWidgets()
    }

    /** Writes the user's chosen dua for the Dua widget. Empty strings clear it. */
    @ReactMethod
    fun writeDuaWidgetData(title: String, arabic: String, translation: String) {
        val prefs = reactApplicationContext.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val payload = JSONObject().apply {
            put("title", title)
            put("arabic", arabic)
            put("translation", translation)
            put("updatedAt", System.currentTimeMillis() / 1000.0)
        }
        prefs.edit().putString("dua_widget_data", payload.toString()).apply()
        refreshAllWidgets()
    }

    /** Mirrors iOS's blanket WidgetCenter.shared.reloadAllTimelines() — refresh both widgets. */
    private fun refreshAllWidgets() {
        val context = reactApplicationContext
        bridgeScope.launch {
            TahajjudGlanceWidget().updateAll(context)
            TahajjudDuaGlanceWidget().updateAll(context)
        }
    }
}
