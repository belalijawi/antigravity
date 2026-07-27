import Foundation
import WidgetKit

/// Writes prayer/streak data to App Group shared UserDefaults so the
/// TahajjudWidget extension can read it and update the home-screen widget.
@objc(WidgetDataBridge)
class WidgetDataBridge: NSObject {

    private let suiteName = "group.com.tahajjudplus"
    private let storageKey = "widget_data"

    /// Called from React Native with:
    ///   - nextPrayer:      name of the next prayer (e.g. "Dhuhr") — fallback only, see prayerTimesJSON
    ///   - nextPrayerTime:  Unix timestamp (seconds) of the next prayer — fallback only
    ///   - streak:          current Tahajjud streak count
    ///   - tahajjudStart:   Unix timestamp (seconds) of tonight's last-third start (0 if unknown)
    ///   - loggablePrayer:  lowercase key of a daily prayer that's started but isn't logged yet ("" if none) — fallback only
    ///   - prayerTimesJSON: JSON object of today's 5 daily-prayer Unix timestamps (fajr/dhuhr/asr/maghrib/isha, 0 if unknown)
    ///   - todayDateStr:    "YYYY-MM-DD" (device-local) the above times and loggedToday apply to
    ///   - loggedToday:     lowercase keys of today's daily prayers already logged
    ///
    /// nextPrayer/nextPrayerTime/loggablePrayer are also stored as a fallback
    /// for widgets that haven't reloaded past a stale cache, but WidgetData
    /// (TahajjudWidget target) prefers deriving them live from
    /// prayerTimesJSON/todayDateStr/loggedToday against the CURRENT time —
    /// that's what lets the widget stay correct across a prayer transition
    /// without needing the app reopened to push a fresh snapshot.
    @objc func writeWidgetData(
        _ nextPrayer: String,
        nextPrayerTime: Double,
        streak: NSNumber,
        tahajjudStart: Double,
        loggablePrayer: String,
        prayerTimesJSON: String,
        todayDateStr: String,
        loggedToday: [String]
    ) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }

        var payload: [String: Any] = [
            "nextPrayer":     nextPrayer,
            "nextPrayerTime": nextPrayerTime,
            "streak":         streak.intValue,
            "updatedAt":      Date().timeIntervalSince1970,
            "prayerTimesJSON": prayerTimesJSON,
            "todayDateStr":   todayDateStr,
            "loggedToday":    loggedToday,
        ]
        if tahajjudStart > 0 {
            payload["tahajjudStart"] = tahajjudStart
        }
        if !loggablePrayer.isEmpty {
            payload["loggablePrayer"] = loggablePrayer
        }

        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            defaults.set(data, forKey: storageKey)
        }

        // Tell WidgetKit to refresh all timelines immediately
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Writes the user's chosen dua for the Dua widget. Empty strings clear it.
    @objc func writeDuaWidgetData(
        _ title: String,
        arabic: String,
        translation: String
    ) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }
        let payload: [String: Any] = [
            "title":       title,
            "arabic":      arabic,
            "translation": translation,
            "updatedAt":   Date().timeIntervalSince1970,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            defaults.set(data, forKey: "dua_widget_data")
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
