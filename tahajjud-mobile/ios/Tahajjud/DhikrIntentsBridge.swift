import Foundation

/// Reads/clears the per-dhikr tap counts accumulated by the Lock Screen
/// widget's TapDhikrIntent (ios/TahajjudWidget/TapDhikrIntent.swift) — that
/// code can't run the RN JS engine directly, so taps land in the shared App
/// Group instead, keyed per dhikr id so the JS side can credit both the
/// combined leaderboard total AND each dhikr's own Stats breakdown (see
/// utils/dhikrLeaderboardTracker.ts's drainPendingWidgetDhikrTaps, which
/// mirrors this ID list — keep both in sync with DhikrChoice in
/// TapDhikrIntent.swift if the built-in dhikr list ever changes).
///
/// Same consume-then-ack shape as PendingIntentsBridge: consume returns the
/// current pending counts without clearing them, and only ack (called after
/// a successful JS-side sync) subtracts what was actually consumed — so a
/// crash or failure between consume and ack just re-delivers the same
/// counts next time, rather than losing them.
@objc(DhikrIntentsBridge)
class DhikrIntentsBridge: NSObject {

    private let suiteName = "group.com.tahajjudplus"
    private let pendingKeyPrefix = "pending-dhikr-taps-widget-"
    private let dhikrIds = ["subhan", "hamd", "akbar", "istighfar", "tahleel", "salawat"]

    @objc(consumePendingDhikrTaps:rejecter:)
    func consumePendingDhikrTaps(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UserDefaults(suiteName: suiteName)
        var result: [String: Int] = [:]
        for id in dhikrIds {
            let n = defaults?.integer(forKey: pendingKeyPrefix + id) ?? 0
            if n > 0 { result[id] = n }
        }
        resolve(result)
    }

    @objc(ackPendingDhikrTaps:resolver:rejecter:)
    func ackPendingDhikrTaps(
        _ amounts: [String: NSNumber],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            resolve(nil)
            return
        }
        // Subtract rather than zero, per dhikr — a tap that landed on the
        // Lock Screen between consume and ack (widget used while the app was
        // mid-drain) must survive, not be silently erased by this ack.
        for (id, amount) in amounts {
            let key = pendingKeyPrefix + id
            let current = defaults.integer(forKey: key)
            defaults.set(max(0, current - amount.intValue), forKey: key)
        }
        resolve(nil)
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
