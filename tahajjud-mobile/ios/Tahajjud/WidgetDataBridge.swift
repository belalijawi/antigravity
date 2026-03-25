import Foundation
import WidgetKit

/// Writes prayer/streak data to App Group shared UserDefaults so the
/// TahajjudWidget extension can read it and update the home-screen widget.
@objc(WidgetDataBridge)
class WidgetDataBridge: NSObject {

    private let suiteName = "group.com.tahajjudplus.app"
    private let storageKey = "widget_data"

    /// Called from React Native with:
    ///   - nextPrayer:     name of the next prayer (e.g. "Dhuhr")
    ///   - nextPrayerTime: Unix timestamp (seconds) of the next prayer
    ///   - streak:         current Tahajjud streak count
    @objc func writeWidgetData(
        _ nextPrayer: String,
        nextPrayerTime: Double,
        streak: NSNumber
    ) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }

        let payload: [String: Any] = [
            "nextPrayer":     nextPrayer,
            "nextPrayerTime": nextPrayerTime,
            "streak":         streak.intValue,
            "updatedAt":      Date().timeIntervalSince1970,
        ]

        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            defaults.set(data, forKey: storageKey)
        }

        // Tell WidgetKit to refresh all timelines immediately
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
