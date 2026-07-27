import Foundation

/// Reads/clears prayer logs written to the shared App Group by code that
/// can't run the RN JS engine directly — the widget's LogPrayerIntent
/// (ios/TahajjudWidget/LogPrayerIntent.swift). utils/pendingIntents.ts drains
/// these into the real tracker on app launch/foreground.
///
/// Entries are strings shaped "prayer|isoTimestamp", appended by whichever
/// native code logged the prayer. Consume returns the current list without
/// clearing it; only ack (called after a successful JS-side merge) removes
/// entries, so a crash between consume and ack just re-delivers next time.
@objc(PendingIntentsBridge)
class PendingIntentsBridge: NSObject {

    private let suiteName = "group.com.tahajjudplus"
    private let pendingLogsKey = "pending-prayer-logs"

    @objc(consumePendingLogs:rejecter:)
    func consumePendingLogs(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UserDefaults(suiteName: suiteName)
        resolve(defaults?.stringArray(forKey: pendingLogsKey) ?? [])
    }

    @objc(ackPendingLogs:resolver:rejecter:)
    func ackPendingLogs(
        _ entries: [String],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            resolve(nil)
            return
        }
        let toRemove = Set(entries)
        let remaining = (defaults.stringArray(forKey: pendingLogsKey) ?? []).filter { !toRemove.contains($0) }
        defaults.set(remaining, forKey: pendingLogsKey)
        resolve(nil)
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
