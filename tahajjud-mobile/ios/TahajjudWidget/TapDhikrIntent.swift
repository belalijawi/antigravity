import AppIntents
import WidgetKit
import Foundation

/// The six built-in dhikrs, mirroring components/TasbeehCard.tsx's
/// getBuiltIn() — rawValue matches that file's `id` field so a tap here and
/// a tap in-app land on conceptually the same counter. Custom (user-added)
/// dhikrs aren't offered here: they only exist in the app's own AsyncStorage,
/// not synced to the widget's App Group, so there's nothing for a widget
/// instance to point at until/unless that sync is built.
@available(iOS 17.0, *)
enum DhikrChoice: String, AppEnum {
    case subhan, hamd, akbar, istighfar, tahleel, salawat

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Dhikr"
    static var caseDisplayRepresentations: [DhikrChoice: DisplayRepresentation] = [
        .subhan:    "SubhanAllah",
        .hamd:      "Alhamdulillah",
        .akbar:     "Allahu Akbar",
        .istighfar: "Astaghfirullah",
        .tahleel:   "La ilaha illallah",
        .salawat:   "Allahuma Salli 'ala Muhammad",
    ]

    /// Matches TasbeehCard.tsx's per-dhikr `target` exactly — round-complete
    /// behavior (see TapDhikrIntent.perform below) needs to agree with the
    /// in-app counter, or "33 on the Lock Screen" and "33 in the app" would
    /// silently mean different things for the same dhikr.
    var target: Int {
        switch self {
        case .subhan, .hamd: return 33
        case .akbar: return 34
        case .istighfar, .tahleel, .salawat: return 100
        }
    }

    var displayName: String {
        switch self {
        case .subhan:    return "SubhanAllah"
        case .hamd:      return "Alhamdulillah"
        case .akbar:     return "Allahu Akbar"
        case .istighfar: return "Astaghfirullah"
        case .tahleel:   return "La ilaha illallah"
        case .salawat:   return "Allahuma Salli 'ala Muhammad"
        }
    }
}

/// Per-widget-instance configuration — long-press → Edit Widget lets someone
/// pick which dhikr THIS Lock Screen counter tracks, since the tiny accessory
/// sizes have no room for an in-place picker the way the in-app card does.
@available(iOS 17.0, *)
struct DhikrWidgetConfigIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Dhikr Counter"
    static var description = IntentDescription("Choose which dhikr this counter tracks.")

    @Parameter(title: "Dhikr")
    var dhikr: DhikrChoice

    // The default shown when a widget is first added, before anyone's
    // opened its configuration — deliberately set here, not via a
    // `default:` argument on @Parameter (AppIntents' Parameter initializer
    // has no such overload for AppEnum-typed properties).
    init() { self.dhikr = .subhan }
    init(dhikr: DhikrChoice) { self.dhikr = dhikr }
}

/// Lets the Lock Screen dhikr widget count a tap without opening the app —
/// same shape as LogPrayerIntent.swift: openAppWhenRun = false, writes to the
/// shared App Group, reloads the widget's own timeline immediately for
/// instant visual feedback, and leaves reconciliation with the real app
/// state (leaderboard sync, Stats totals) to the next launch/foreground —
/// see DhikrIntentsBridge.swift (native half) and
/// utils/dhikrLeaderboardTracker.ts (JS half) for the drain.
@available(iOS 17.0, *)
struct TapDhikrIntent: AppIntent {
    static var title: LocalizedStringResource = "Tap Dhikr"
    static var description = IntentDescription("Counts one dhikr tap from the Lock Screen widget.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Dhikr ID")
    var dhikrId: String

    @Parameter(title: "Target")
    var target: Int

    init() { self.dhikrId = DhikrChoice.subhan.rawValue; self.target = DhikrChoice.subhan.target }
    init(dhikrId: String, target: Int) {
        self.dhikrId = dhikrId
        self.target = target
    }

    func perform() async throws -> some IntentResult {
        let appGroup = "group.com.tahajjudplus"
        guard let defaults = UserDefaults(suiteName: appGroup) else { return .result() }

        // In-progress round count for THIS specific dhikr — wraps back to 0
        // on hitting target, same reset-on-complete behavior as
        // TasbeehCard.tsx's handleTap, so a round completed from the Lock
        // Screen feels identical to one completed in the app.
        let countKey = "widget_dhikr_count_\(dhikrId)"
        let current = defaults.integer(forKey: countKey)
        let next = current + 1
        defaults.set(next >= target ? 0 : next, forKey: countKey)

        // Every real tap counts toward this dhikr's own pending total
        // regardless of whether it completed a round — drained into the
        // app's durable debounced leaderboard sync AND TasbeehCard's Stats
        // totals next launch/foreground (see DhikrIntentsBridge.swift +
        // utils/dhikrLeaderboardTracker.ts). Keyed per-dhikr (not a single
        // flat counter) so the drain can credit each dhikr's own Stats
        // breakdown correctly, not just the combined leaderboard sum.
        let pendingKey = "pending-dhikr-taps-widget-\(dhikrId)"
        defaults.set(defaults.integer(forKey: pendingKey) + 1, forKey: pendingKey)

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
