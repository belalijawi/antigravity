package com.tahajjudplus.app.widget

import android.content.Context
import org.json.JSONObject

/** Android analog of App Group UserDefaults — same-UID processes can share one prefs file. */
const val WIDGET_PREFS_NAME = "group.tahajjudplus"
private const val WIDGET_DATA_KEY = "widget_data"

/** Mirrors WidgetData in ios/TahajjudWidget/TahajjudWidget.swift. */
data class WidgetData(
    val nextPrayer: String,
    val nextPrayerTime: Long, // epoch seconds
    val streak: Int,
    val updatedAt: Long,
    val tahajjudStart: Long?, // epoch seconds, null if unknown
    // Lowercase key of a daily prayer that's started today but isn't logged
    // yet ("fajr", "dhuhr", ...) — drives the widget's "Log" button.
    val loggablePrayer: String? = null,
) {
    /**
     * tahajjudStart, but only while still meaningful to display — mirrors the
     * -6h/+24h freshness window in TahajjudWidget.swift's freshTahajjudStart,
     * so a stale night-before value doesn't linger all the following day.
     */
    fun freshTahajjudStart(nowSeconds: Long = System.currentTimeMillis() / 1000): Long? {
        val t = tahajjudStart ?: return null
        val sixHours = 6 * 3600
        val twentyFourHours = 24 * 3600
        return if (t > nowSeconds - sixHours && t < nowSeconds + twentyFourHours) t else null
    }

    /** The prayer key the "Log" button should target — an open Tahajjud gate wins. */
    fun loggableNow(nowSeconds: Long = System.currentTimeMillis() / 1000): String? {
        val fresh = freshTahajjudStart(nowSeconds)
        if (fresh != null && nowSeconds >= fresh) return "tahajjud"
        return loggablePrayer
    }

    companion object {
        val placeholder = WidgetData(
            nextPrayer = "Isha",
            nextPrayerTime = System.currentTimeMillis() / 1000 + 3600,
            streak = 7,
            updatedAt = System.currentTimeMillis() / 1000,
            tahajjudStart = System.currentTimeMillis() / 1000 + 18000,
            loggablePrayer = "asr",
        )

        fun load(context: Context): WidgetData {
            val prefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(WIDGET_DATA_KEY, null) ?: return placeholder
            return try {
                val json = JSONObject(raw)
                WidgetData(
                    nextPrayer = json.optString("nextPrayer", "Prayer"),
                    nextPrayerTime = json.optDouble("nextPrayerTime", 0.0).toLong(),
                    streak = json.optInt("streak", 0),
                    updatedAt = json.optDouble("updatedAt", 0.0).toLong(),
                    tahajjudStart = if (json.has("tahajjudStart")) json.optDouble("tahajjudStart").toLong() else null,
                    loggablePrayer = if (json.has("loggablePrayer")) json.optString("loggablePrayer") else null,
                )
            } catch (e: Exception) {
                placeholder
            }
        }
    }
}

/** Emoji per next-prayer name — mirrors prayerEmoji in TahajjudWidget.swift. */
fun prayerEmoji(nextPrayer: String): String = when (nextPrayer.lowercase()) {
    "fajr" -> "🌅"      // 🌅
    "dhuhr" -> "☀️"     // ☀️
    "asr" -> "🌤"       // 🌤
    "maghrib" -> "🌇"   // 🌇
    "isha" -> "🌃"      // 🌃
    else -> "🕌"        // 🕌
}

/** "Xh Ym" / "Ym" / "Now" — mirrors countdownText in TahajjudWidget.swift. */
fun countdownText(nextPrayerTimeSeconds: Long, nowSeconds: Long = System.currentTimeMillis() / 1000): String {
    val diff = nextPrayerTimeSeconds - nowSeconds
    if (diff <= 0) return "Now"
    val hours = diff / 3600
    val mins = (diff % 3600) / 60
    return if (hours > 0) "${hours}h ${mins}m" else "${mins}m"
}
