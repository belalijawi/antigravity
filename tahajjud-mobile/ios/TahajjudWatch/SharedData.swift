// Shared App Group access — same UserDefaults suite that the iOS app and
// the widget extension already use (group.com.tahajjudplus).
//
// READS (populated by the iPhone every time prayer times recompute):
//   - widget_data (JSON): nextPrayer name, nextPrayerTime, streak, tahajjudStart
//
// WRITES (drained by the iPhone on next foreground via drainPendingPrayerLogs):
//   - pending-prayer-logs (array of "prayer|isoTimestamp" strings)

import Foundation

enum SharedData {
    static let appGroup = "group.com.tahajjudplus"

    struct PrayerSnapshot {
        let nextPrayer: String
        let nextPrayerTime: Date
        let streak: Int
        let tahajjudStart: Date?
        let updatedAt: Date
    }

    static func loadSnapshot() -> PrayerSnapshot? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_data"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }

        let nextPrayer = json["nextPrayer"] as? String ?? "Prayer"
        let nextPrayerTime = (json["nextPrayerTime"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let streak = json["streak"] as? Int ?? 0
        let updatedAt = (json["updatedAt"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let tahajjudStart = (json["tahajjudStart"] as? Double).map { Date(timeIntervalSince1970: $0) }

        return PrayerSnapshot(
            nextPrayer: nextPrayer,
            nextPrayerTime: nextPrayerTime,
            streak: streak,
            tahajjudStart: tahajjudStart,
            updatedAt: updatedAt,
        )
    }

    /// Queue a prayer log for the iPhone to merge into the tracker.
    /// Same format used by Siri/App Intents — "prayer|iso8601".
    static func queuePrayerLog(_ prayer: String) {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return }
        var pending = defaults.stringArray(forKey: "pending-prayer-logs") ?? []
        let entry = "\(prayer)|\(ISO8601DateFormatter().string(from: Date()))"
        pending.append(entry)
        defaults.set(pending, forKey: "pending-prayer-logs")
    }
}
