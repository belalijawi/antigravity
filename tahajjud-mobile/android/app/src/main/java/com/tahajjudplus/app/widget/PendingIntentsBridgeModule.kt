package com.tahajjudplus.app.widget

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments
import org.json.JSONArray

/**
 * Reads/clears prayer logs written by LogPrayerAction (the widget's "Log"
 * button) — the Android counterpart of ios/Tahajjud/PendingIntentsBridge.swift.
 * utils/pendingIntents.ts drains these into the real tracker on app
 * launch/foreground, same JS logic on both platforms.
 */
class PendingIntentsBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PendingIntentsBridge"

    @ReactMethod
    fun consumePendingLogs(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PENDING_LOGS_KEY, null)
        val result: WritableArray = Arguments.createArray()
        if (raw != null) {
            try {
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) result.pushString(arr.getString(i))
            } catch (e: Exception) { /* ignore, return what we have */ }
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun ackPendingLogs(entries: com.facebook.react.bridge.ReadableArray, promise: Promise) {
        val toRemove = mutableSetOf<String>()
        for (i in 0 until entries.size()) entries.getString(i)?.let { toRemove.add(it) }

        val prefs = reactApplicationContext.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PENDING_LOGS_KEY, null)
        if (raw != null) {
            try {
                val arr = JSONArray(raw)
                val remaining = JSONArray()
                for (i in 0 until arr.length()) {
                    val entry = arr.getString(i)
                    if (!toRemove.contains(entry)) remaining.put(entry)
                }
                prefs.edit().putString(PENDING_LOGS_KEY, remaining.toString()).apply()
            } catch (e: Exception) { /* ignore */ }
        }
        promise.resolve(null)
    }
}
