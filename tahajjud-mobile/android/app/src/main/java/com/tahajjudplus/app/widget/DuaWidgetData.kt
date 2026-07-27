package com.tahajjudplus.app.widget

import android.content.Context
import org.json.JSONObject

private const val DUA_WIDGET_DATA_KEY = "dua_widget_data"

/** Mirrors DuaWidgetData in ios/TahajjudWidget/TahajjudWidget.swift. */
data class DuaWidgetData(
    val title: String,
    val arabic: String,
    val translation: String,
) {
    companion object {
        val placeholder = DuaWidgetData(
            title = "Rabbana Atina",
            arabic = "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً",
            translation = "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
        )

        /** Returns null when nothing has been pinned yet, mirroring the Swift load(). */
        fun load(context: Context): DuaWidgetData? {
            val prefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(DUA_WIDGET_DATA_KEY, null) ?: return null
            return try {
                val json = JSONObject(raw)
                val d = DuaWidgetData(
                    title = json.optString("title", ""),
                    arabic = json.optString("arabic", ""),
                    translation = json.optString("translation", ""),
                )
                if (d.title.isEmpty() && d.arabic.isEmpty() && d.translation.isEmpty()) null else d
            } catch (e: Exception) {
                null
            }
        }
    }
}
