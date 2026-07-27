import AppIntents
import WidgetKit
import Foundation

/// Lets the "Log" button on the widget log a prayer without opening the app.
/// Writes a pending entry to the shared App Group; utils/pendingIntents.ts
/// drains it into the real tracker next time the app launches or foregrounds
/// (see ios/Tahajjud/PendingIntentsBridge.swift for the RN-facing half).
@available(iOS 17.0, *)
struct LogPrayerIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Prayer"
    static var description = IntentDescription("Logs a prayer in Tahajjud+ for today.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Prayer")
    var prayer: String

    init() { self.prayer = "" }
    init(prayer: String) { self.prayer = prayer }

    func perform() async throws -> some IntentResult {
        let appGroup = "group.com.tahajjudplus"
        guard let defaults = UserDefaults(suiteName: appGroup) else { return .result() }

        var pending = defaults.stringArray(forKey: "pending-prayer-logs") ?? []
        pending.append("\(prayer)|\(ISO8601DateFormatter().string(from: Date()))")
        defaults.set(pending, forKey: "pending-prayer-logs")

        // Optimistic UI: mark this prayer logged immediately rather than
        // waiting for the app to next recompute it. WidgetData now derives
        // loggableNow live from loggedToday against the current time (see
        // TahajjudWidget.swift), so appending here is what actually makes
        // the button correctly move on to the NEXT loggable prayer (or
        // disappear) right away — not just hide until the app reopens. The
        // app's own updateWidget() call is still the source of truth going
        // forward and will overwrite this with the real tracker state.
        if let data = defaults.data(forKey: "widget_data"),
           var json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            json.removeValue(forKey: "loggablePrayer") // clear the legacy fallback field too
            if prayer != "tahajjud" {
                var loggedToday = json["loggedToday"] as? [String] ?? []
                if !loggedToday.contains(prayer) { loggedToday.append(prayer) }
                json["loggedToday"] = loggedToday
            }
            if let updated = try? JSONSerialization.data(withJSONObject: json) {
                defaults.set(updated, forKey: "widget_data")
            }
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
