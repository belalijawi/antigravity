import WidgetKit
import SwiftUI

// MARK: - Shared data model

struct WidgetData: Codable {
    var streak: Int
    var updatedAt: Date
    var tahajjudStart: Date?

    // ── Raw ingredients for LIVE computation ──────────────────────────────
    // "Next prayer" and "loggable prayer" used to be computed once in JS and
    // baked into this struct at push time — correct only until the next
    // prayer transition, then stuck (e.g. "Log Dhuhr" still showing well
    // after Asr had also started, because nothing told the widget time had
    // moved on while the app stayed closed). Storing the raw times instead
    // and computing against Date() on every render fixes that: WidgetKit
    // reloads this struct on its own schedule (see refresh policy below)
    // regardless of whether the app is open.
    var prayerTimesToday: [String: Date]   // keys: fajr/dhuhr/asr/maghrib/isha
    var todayDateStr: String?              // "YYYY-MM-DD", device-local — which day loggedToday applies to
    var loggedToday: [String]              // lowercase prayer keys already logged today

    // Fallback snapshot — used only when prayerTimesToday is empty, i.e. a
    // widget still showing a cached blob from before this field existed.
    var fallbackNextPrayer: String
    var fallbackNextPrayerTime: Date
    var fallbackLoggablePrayer: String?

    private static let prayerOrder = ["fajr", "dhuhr", "asr", "maghrib", "isha"]

    /// "YYYY-MM-DD" in the device's local calendar — matches the JS side's
    /// localDateStr() semantics so date comparisons agree.
    private static func localDateStr(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // ── "As of" derivations ────────────────────────────────────────────
    // Parameterized on an explicit reference date rather than reading Date()
    // ambiently. WidgetKit pre-renders every entry in a timeline once, right
    // after getTimeline() returns — a SwiftUI view that reads Date() inside
    // its body sees whatever "now" was at that single generation moment for
    // EVERY entry, so a multi-entry timeline (one entry per upcoming prayer
    // transition) would show the same stale prayer for every entry instead
    // of advancing on its own. Each entry instead bakes in its own
    // nextPrayer/nextPrayerTime/loggableNow computed as of ITS OWN date, so
    // the widget flips to the correct prayer automatically as each entry's
    // date arrives — no reload, and no tapping the widget first, required.

    private func liveNext(asOf now: Date) -> (name: String, date: Date)? {
        guard !prayerTimesToday.isEmpty else { return nil }
        for key in Self.prayerOrder {
            guard let t = prayerTimesToday[key], t > now else { continue }
            return (key.prefix(1).uppercased() + key.dropFirst(), t)
        }
        // All of today's have passed — next is Fajr. Roll it forward a day
        // at a time until it's actually in the future, so this stays correct
        // even if the widget goes unrefreshed for more than one day.
        guard var fajr = prayerTimesToday["fajr"] else { return nil }
        var guardCount = 0
        while fajr <= now && guardCount < 14 {
            fajr = fajr.addingTimeInterval(24 * 3600)
            guardCount += 1
        }
        return ("Fajr", fajr)
    }

    func nextPrayer(asOf now: Date) -> String { liveNext(asOf: now)?.name ?? fallbackNextPrayer }
    func nextPrayerTime(asOf now: Date) -> Date { liveNext(asOf: now)?.date ?? fallbackNextPrayerTime }

    /// tahajjudStart, but only while it's still meaningful to display. The
    /// app writes whatever night it last calculated — opened at 1am that's
    /// the night already in progress — and the widget would otherwise keep
    /// showing that stale time all the following day. Allow a grace window
    /// after the start (the gate stays open for the last third itself),
    /// then hide rather than mislead.
    func freshTahajjudStart(asOf now: Date) -> Date? {
        guard let t = tahajjudStart else { return nil }
        guard t > now.addingTimeInterval(-6 * 3600),
              t < now.addingTimeInterval(24 * 3600) else { return nil }
        return t
    }

    /// The most recent of today's daily prayers whose time has started but
    /// that isn't in loggedToday yet. nil if prayerTimesToday is unavailable,
    /// or if todayDateStr doesn't match today (the pushed data is stale by
    /// more than a day, so loggedToday would refer to the wrong day — better
    /// to fall back than guess wrong).
    private func liveLoggablePrayer(asOf now: Date) -> String? {
        guard !prayerTimesToday.isEmpty,
              let stamped = todayDateStr, stamped == Self.localDateStr(now)
        else { return nil }
        var best: (prayer: String, time: Date)?
        for key in Self.prayerOrder {
            guard let t = prayerTimesToday[key], t <= now else { continue }
            if loggedToday.contains(key) { continue }
            if best == nil || t > best!.time { best = (key, t) }
        }
        return best?.prayer
    }

    /// The prayer key the widget's "Log" button should target as of `now`,
    /// if any — the open Tahajjud gate takes priority over a daily prayer.
    func loggableNow(asOf now: Date) -> String? {
        if let t = freshTahajjudStart(asOf: now), now >= t { return "tahajjud" }
        return liveLoggablePrayer(asOf: now) ?? fallbackLoggablePrayer
    }

    static let placeholder = WidgetData(
        streak: 7,
        updatedAt: Date(),
        tahajjudStart: Date().addingTimeInterval(18000), // ~5 hours from now
        prayerTimesToday: [:],
        todayDateStr: nil,
        loggedToday: [],
        fallbackNextPrayer: "Isha",
        fallbackNextPrayerTime: Date().addingTimeInterval(3600),
        fallbackLoggablePrayer: "asr"
    )

    static func load() -> WidgetData {
        let defaults = UserDefaults(suiteName: "group.com.tahajjudplus")
        guard let data = defaults?.data(forKey: "widget_data"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .placeholder }

        let streak         = json["streak"] as? Int ?? 0
        let updatedAt      = (json["updatedAt"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let tahajjudStart  = (json["tahajjudStart"] as? Double).map { Date(timeIntervalSince1970: $0) }

        var prayerTimesToday: [String: Date] = [:]
        if let rawJSON = json["prayerTimesJSON"] as? String,
           let rawData = rawJSON.data(using: .utf8),
           let times = try? JSONSerialization.jsonObject(with: rawData) as? [String: Double] {
            for (key, seconds) in times where seconds > 0 {
                prayerTimesToday[key] = Date(timeIntervalSince1970: seconds)
            }
        }
        let todayDateStr = json["todayDateStr"] as? String
        let loggedToday  = json["loggedToday"] as? [String] ?? []

        let fallbackNextPrayer     = json["nextPrayer"] as? String ?? "Prayer"
        let fallbackNextPrayerTime = (json["nextPrayerTime"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let fallbackLoggablePrayer = json["loggablePrayer"] as? String

        return WidgetData(
            streak: streak,
            updatedAt: updatedAt,
            tahajjudStart: tahajjudStart,
            prayerTimesToday: prayerTimesToday,
            todayDateStr: todayDateStr,
            loggedToday: loggedToday,
            fallbackNextPrayer: fallbackNextPrayer,
            fallbackNextPrayerTime: fallbackNextPrayerTime,
            fallbackLoggablePrayer: fallbackLoggablePrayer
        )
    }
}

// MARK: - Timeline provider

struct TahajjudProvider: TimelineProvider {
    func placeholder(in context: Context) -> TahajjudEntry {
        TahajjudEntry(date: Date(), widgetData: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TahajjudEntry) -> Void) {
        completion(TahajjudEntry(date: Date(), widgetData: .load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TahajjudEntry>) -> Void) {
        let data = WidgetData.load()
        let now = Date()

        // One entry per moment the displayed content should change: right
        // now, each of today's remaining prayer times (when "next prayer"
        // flips), and Tahajjud start (when the gate opens) — all sharing the
        // same underlying data, each baking in its own as-of computation.
        // WidgetKit switches to whichever entry's date has arrived on its
        // own, with no reload needed — this is what makes the prayer name
        // advance automatically instead of freezing until the widget is
        // tapped (which was only ever forcing the single stale entry to
        // regenerate via the app's own reload call).
        var dates: [Date] = [now]
        for key in ["fajr", "dhuhr", "asr", "maghrib", "isha"] {
            if let t = data.prayerTimesToday[key], t > now { dates.append(t) }
        }
        if let tahajjud = data.tahajjudStart, tahajjud > now {
            dates.append(tahajjud)
        }
        dates = Array(Set(dates)).sorted()

        let entries = dates.map { TahajjudEntry(date: $0, widgetData: data) }

        // Full refresh (fresh widget_data from the app) shortly after the
        // last known transition, so a day with no prayer times pushed yet
        // still checks back in rather than going stale indefinitely.
        let lastKnown = dates.last ?? now
        let refresh = max(now.addingTimeInterval(300), lastKnown.addingTimeInterval(300))
        let timeline = Timeline(entries: entries, policy: .after(refresh))
        completion(timeline)
    }
}

struct TahajjudEntry: TimelineEntry {
    let date: Date
    let widgetData: WidgetData
    let nextPrayer: String
    let nextPrayerTime: Date
    let freshTahajjudStart: Date?
    let loggableNow: String?

    init(date: Date, widgetData: WidgetData) {
        self.date = date
        self.widgetData = widgetData
        self.nextPrayer = widgetData.nextPrayer(asOf: date)
        self.nextPrayerTime = widgetData.nextPrayerTime(asOf: date)
        self.freshTahajjudStart = widgetData.freshTahajjudStart(asOf: date)
        self.loggableNow = widgetData.loggableNow(asOf: date)
    }
}

// MARK: - Views

struct SmallWidgetView: View {
    let entry: TahajjudEntry
    @Environment(\.colorScheme) var colorScheme

    var countdownText: String {
        let diff = entry.nextPrayerTime.timeIntervalSince(Date())
        if diff <= 0 { return "Now" }
        let hours = Int(diff) / 3600
        let mins  = (Int(diff) % 3600) / 60
        if hours > 0 { return "\(hours)h \(mins)m" }
        return "\(mins)m"
    }

    var prayerEmoji: String {
        switch entry.nextPrayer.lowercased() {
        case "fajr":    return "🌅"
        case "dhuhr":   return "☀️"
        case "asr":     return "🌤"
        case "maghrib": return "🌇"
        case "isha":    return "🌃"
        default:        return "🕌"
        }
    }

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [Color(hex: "020617"), Color(hex: "0d1b3e")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Nebula glow
            Circle()
                .fill(Color(hex: "4f46e5").opacity(0.3))
                .frame(width: 120, height: 120)
                .offset(x: 50, y: -40)
                .blur(radius: 30)

            VStack(alignment: .leading, spacing: 4) {
                // Top row: emoji + streak
                HStack {
                    Text(prayerEmoji)
                        .font(.system(size: 20))
                    Spacer()
                    if entry.widgetData.streak >= 3 {
                        HStack(spacing: 2) {
                            Text("🔥")
                                .font(.system(size: 12))
                            Text("\(entry.widgetData.streak)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(hex: "f59e0b"))
                        }
                    }
                }

                Spacer()

                // Tahajjud time (if available)
                if let tahajjud = entry.freshTahajjudStart {
                    HStack(spacing: 3) {
                        Text("🌙")
                            .font(.system(size: 9))
                        Text(tahajjud, style: .time)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(hex: "a78bfa"))
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color(hex: "4f46e5").opacity(0.25))
                    .cornerRadius(6)
                    .padding(.bottom, 2)
                }

                // Prayer name
                Text(entry.nextPrayer)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)

                // Time
                Text(entry.nextPrayerTime, style: .time)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color(hex: "94a3b8"))

                // Countdown
                Text("in \(countdownText)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color(hex: "22d3ee"))
            }
            .padding(14)
        }
    }
}

struct MediumWidgetView: View {
    let entry: TahajjudEntry

    var countdownText: String {
        let diff = entry.nextPrayerTime.timeIntervalSince(Date())
        if diff <= 0 { return "Now" }
        let hours = Int(diff) / 3600
        let mins  = (Int(diff) % 3600) / 60
        if hours > 0 { return "\(hours)h \(mins)m" }
        return "\(mins)m"
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "020617"), Color(hex: "0d1b3e")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(Color(hex: "4f46e5").opacity(0.25))
                .frame(width: 180, height: 180)
                .offset(x: 100, y: -50)
                .blur(radius: 40)

            HStack(spacing: 0) {
                // Left: next prayer info
                VStack(alignment: .leading, spacing: 6) {
                    Text("Next Prayer")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(hex: "64748b"))
                        .textCase(.uppercase)
                        .kerning(0.5)

                    Text(entry.nextPrayer)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)

                    Text(entry.nextPrayerTime, style: .time)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color(hex: "cbd5e1"))

                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                            .foregroundColor(Color(hex: "22d3ee"))
                        Text("in \(countdownText)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color(hex: "22d3ee"))
                    }

                    // Tahajjud row
                    if let tahajjud = entry.freshTahajjudStart {
                        HStack(spacing: 4) {
                            Text("🌙")
                                .font(.system(size: 11))
                            Text(tahajjud, style: .time)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(hex: "a78bfa"))
                            Text("Tahajjud")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color(hex: "7c3aed").opacity(0.8))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(hex: "4f46e5").opacity(0.2))
                        .cornerRadius(8)
                        .padding(.top, 2)
                    }
                }
                .padding(.leading, 16)

                Spacer()

                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 1)
                    .padding(.vertical, 12)

                // Right: log button (when something's loggable) or streak
                VStack(spacing: 4) {
                    if let prayer = entry.loggableNow {
                        Button(intent: LogPrayerIntent(prayer: prayer)) {
                            VStack(spacing: 2) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 22))
                                Text("Log")
                                    .font(.system(size: 12, weight: .bold))
                                // Names the exact prayer this button logs —
                                // without it, "Log" next to "Next Prayer: Asr"
                                // on the left reads as if it logs Asr, when it
                                // actually logs whichever passed prayer is
                                // still unlogged (which could be an earlier
                                // one, e.g. Dhuhr). Matches LargeWidgetView's
                                // "Log <Prayer>" label for the same reason.
                                Text(prayer.capitalized)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(Color(hex: "22d3ee").opacity(0.8))
                            }
                            .foregroundColor(Color(hex: "22d3ee"))
                        }
                        .buttonStyle(.plain)
                    } else if entry.widgetData.streak > 0 {
                        Text("🔥")
                            .font(.system(size: 28))
                        Text("\(entry.widgetData.streak)")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(Color(hex: "f59e0b"))
                        Text("nights")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(Color(hex: "94a3b8"))
                    } else {
                        Text("🌙")
                            .font(.system(size: 28))
                        Text("Start")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(hex: "94a3b8"))
                        Text("tonight")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "64748b"))
                    }
                }
                .frame(width: 80)
                .padding(.trailing, 16)
            }
            .padding(.vertical, 16)
        }
    }
}

// MARK: - Large Widget

struct LargeWidgetView: View {
    let entry: TahajjudEntry

    var isGateOpen: Bool {
        guard let t = entry.freshTahajjudStart else { return false }
        return Date() >= t
    }

    var countdownText: String {
        let diff = entry.nextPrayerTime.timeIntervalSince(Date())
        if diff <= 0 { return "Now" }
        let h = Int(diff) / 3600
        let m = (Int(diff) % 3600) / 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    var prayerEmoji: String {
        switch entry.nextPrayer.lowercased() {
        case "fajr":    return "🌅"
        case "dhuhr":   return "☀️"
        case "asr":     return "🌤"
        case "maghrib": return "🌇"
        case "isha":    return "🌃"
        default:        return "🕌"
        }
    }

    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                colors: [Color(hex: "020617"), Color(hex: "0a0f2e")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )

            // Nebula glows
            Circle()
                .fill(Color(hex: "4f46e5").opacity(0.22))
                .frame(width: 260, height: 260)
                .offset(x: 120, y: -100)
                .blur(radius: 50)
            Circle()
                .fill(Color(hex: "7c3aed").opacity(0.12))
                .frame(width: 180, height: 180)
                .offset(x: -80, y: 120)
                .blur(radius: 40)

            VStack(alignment: .leading, spacing: 0) {

                // ── Header ──────────────────────────────────────────
                HStack {
                    Text("🌙")
                        .font(.system(size: 17))
                    Text("Tahajjud+")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Text(Date(), style: .date)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color(hex: "475569"))
                }
                .padding(.bottom, 16)

                // ── Tahajjud block ───────────────────────────────────
                VStack(alignment: .leading, spacing: 6) {
                    Text(isGateOpen ? "🔓  GATE IS OPEN" : "WAKE FOR TAHAJJUD")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(isGateOpen ? Color(hex: "a78bfa") : Color(hex: "64748b"))
                        .kerning(1.2)

                    if let tahajjud = entry.freshTahajjudStart {
                        Text(tahajjud, style: .time)
                            .font(.system(size: 52, weight: .heavy))
                            .foregroundColor(isGateOpen ? Color(hex: "a78bfa") : .white)
                            .minimumScaleFactor(0.7)

                        if !isGateOpen {
                            HStack(spacing: 4) {
                                Image(systemName: "moon.stars.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(hex: "7c3aed"))
                                Text("in ")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(hex: "94a3b8"))
                                + Text(tahajjud, style: .relative)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(Color(hex: "a78bfa"))
                            }
                        } else {
                            Text("The last third of the night has begun")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(hex: "a78bfa").opacity(0.8))
                        }
                    } else {
                        Text("Open the app to calculate")
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "475569"))
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(hex: isGateOpen ? "3730a3" : "1e1b4b").opacity(0.4))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(hex: "4f46e5").opacity(0.25), lineWidth: 1)
                        )
                )

                // ── Divider ──────────────────────────────────────────
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
                    .padding(.vertical, 14)

                // ── Next prayer ──────────────────────────────────────
                HStack(spacing: 12) {
                    Text(prayerEmoji)
                        .font(.system(size: 28))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("NEXT PRAYER")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(hex: "64748b"))
                            .kerning(1)
                        Text(entry.nextPrayer)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(entry.nextPrayerTime, style: .time)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(hex: "cbd5e1"))
                        Text("in \(countdownText)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(hex: "22d3ee"))
                    }
                }

                // ── Divider ──────────────────────────────────────────
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
                    .padding(.vertical, 14)

                // ── Streak ───────────────────────────────────────────
                HStack(spacing: 12) {
                    Text(entry.widgetData.streak > 0 ? "🔥" : "🌙")
                        .font(.system(size: 28))

                    VStack(alignment: .leading, spacing: 2) {
                        if entry.widgetData.streak > 0 {
                            Text("\(entry.widgetData.streak) night\(entry.widgetData.streak == 1 ? "" : "s")")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(Color(hex: "f59e0b"))
                            Text("Tahajjud streak")
                                .font(.system(size: 11))
                                .foregroundColor(Color(hex: "94a3b8"))
                        } else {
                            Text("Start your streak")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundColor(.white)
                            Text("Pray Tahajjud tonight")
                                .font(.system(size: 11))
                                .foregroundColor(Color(hex: "94a3b8"))
                        }
                    }

                    Spacer()

                    if let prayer = entry.loggableNow {
                        Button(intent: LogPrayerIntent(prayer: prayer)) {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 14))
                                Text("Log \(prayer.capitalized)")
                                    .font(.system(size: 13, weight: .bold))
                            }
                            .foregroundColor(Color(hex: "020617"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color(hex: "22d3ee"))
                            .cornerRadius(10)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(18)
        }
    }
}

// MARK: - Widget definition

struct TahajjudWidget: Widget {
    let kind: String = "TahajjudWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TahajjudProvider()) { entry in
            TahajjudWidgetEntryView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Tahajjud+")
        .description("Next prayer time and Tahajjud streak.")
        .supportedFamilies(supportedFamilies())
        // With a .clear container background iOS applies default content
        // margins, so the gradient ZStacks only painted the inset content
        // area and the widget showed dark unfilled gaps around the card.
        .contentMarginsDisabled()
    }

    private func supportedFamilies() -> [WidgetFamily] {
        var families: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
        if #available(iOS 16.0, *) {
            families.append(contentsOf: [.accessoryRectangular, .accessoryCircular, .accessoryInline])
        }
        return families
    }
}

struct TahajjudWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: TahajjudEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        case .accessoryRectangular:
            if #available(iOS 16.0, *) {
                AccessoryRectangularView(entry: entry)
            } else { SmallWidgetView(entry: entry) }
        case .accessoryCircular:
            if #available(iOS 16.0, *) {
                AccessoryCircularView(entry: entry)
            } else { SmallWidgetView(entry: entry) }
        case .accessoryInline:
            if #available(iOS 16.0, *) {
                AccessoryInlineView(entry: entry)
            } else { SmallWidgetView(entry: entry) }
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Lock Screen accessory widgets (iOS 16+)

@available(iOS 16.0, *)
struct AccessoryRectangularView: View {
    let entry: TahajjudEntry

    var body: some View {
        let nextDate = entry.nextPrayerTime
        let tahajjud = entry.freshTahajjudStart
        let now = Date()
        // Guard: SwiftUI's `Text(timerInterval:...)` crashes if the upper
        // bound is in the past. Use `nextDate.addingTimeInterval(60)` floor.
        let safeUpper = max(nextDate, now.addingTimeInterval(60))
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "moon.stars.fill")
                Text(entry.nextPrayer.uppercased())
                    .font(.caption2.weight(.bold))
                    .tracking(1.0)
            }
            if nextDate > now {
                Text(timerInterval: now...safeUpper, countsDown: true)
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
            } else {
                Text(nextDate, format: .dateTime.hour().minute())
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
            }
            if let t = tahajjud, t > now {
                Text("Tahajjud \(t, format: .dateTime.hour().minute())")
                    .font(.caption2)
                    .opacity(0.8)
            } else if entry.widgetData.streak > 0 {
                Text("Streak \(entry.widgetData.streak)d")
                    .font(.caption2)
                    .opacity(0.8)
            }
        }
        .containerBackground(.clear, for: .widget)
    }
}

@available(iOS 16.0, *)
struct AccessoryCircularView: View {
    let entry: TahajjudEntry

    var body: some View {
        VStack(spacing: 1) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 12))
            Text("\(entry.widgetData.streak)")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text("days")
                .font(.system(size: 8))
                .opacity(0.7)
        }
        .containerBackground(.clear, for: .widget)
    }
}

@available(iOS 16.0, *)
struct AccessoryInlineView: View {
    let entry: TahajjudEntry

    var body: some View {
        let nextDate = entry.nextPrayerTime
        Text("\(entry.nextPrayer): \(nextDate, format: .dateTime.hour().minute())")
    }
}


// MARK: - Dua Widget (user-chosen dua from the app)

struct DuaWidgetData {
    var title: String
    var arabic: String
    var translation: String

    static let placeholder = DuaWidgetData(
        title: "Rabbana Atina",
        arabic: "\u{0631}\u{064E}\u{0628}\u{064E}\u{0651}\u{0646}\u{064E}\u{0627} \u{0622}\u{062A}\u{0650}\u{0646}\u{064E}\u{0627} \u{0641}\u{0650}\u{064A} \u{0627}\u{0644}\u{062F}\u{064F}\u{0651}\u{0646}\u{0652}\u{064A}\u{064E}\u{0627} \u{062D}\u{064E}\u{0633}\u{064E}\u{0646}\u{064E}\u{0629}\u{064B}",
        translation: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire."
    )

    static func load() -> DuaWidgetData? {
        let defaults = UserDefaults(suiteName: "group.com.tahajjudplus")
        guard let data = defaults?.data(forKey: "dua_widget_data"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        let d = DuaWidgetData(
            title: json["title"] as? String ?? "",
            arabic: json["arabic"] as? String ?? "",
            translation: json["translation"] as? String ?? ""
        )
        if d.title.isEmpty && d.arabic.isEmpty && d.translation.isEmpty { return nil }
        return d
    }
}

struct DuaEntry: TimelineEntry {
    let date: Date
    let dua: DuaWidgetData?
}

struct DuaProvider: TimelineProvider {
    func placeholder(in context: Context) -> DuaEntry {
        DuaEntry(date: Date(), dua: .placeholder)
    }
    func getSnapshot(in context: Context, completion: @escaping (DuaEntry) -> Void) {
        completion(DuaEntry(date: Date(), dua: DuaWidgetData.load() ?? .placeholder))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DuaEntry>) -> Void) {
        // Content is static — it only changes when the app writes a new dua,
        // and the bridge calls reloadAllTimelines() at that moment.
        completion(Timeline(entries: [DuaEntry(date: Date(), dua: DuaWidgetData.load())], policy: .never))
    }
}

struct DuaWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: DuaEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "020617"), Color(hex: "0d1b3e")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            Circle()
                .fill(Color(hex: "4f46e5").opacity(0.25))
                .frame(width: 160, height: 160)
                .offset(x: 90, y: -60)
                .blur(radius: 40)

            if let dua = entry.dua {
                VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 8) {
                    HStack(spacing: 5) {
                        Text("\u{1F932}")
                            .font(.system(size: family == .systemSmall ? 12 : 14))
                        Text(dua.title)
                            .font(.system(size: family == .systemSmall ? 11 : 13, weight: .bold))
                            .foregroundColor(Color(hex: "a78bfa"))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }

                    if family != .systemSmall && !dua.arabic.isEmpty {
                        Text(dua.arabic)
                            .font(.system(size: family == .systemLarge ? 24 : 17, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .multilineTextAlignment(.trailing)
                            .lineLimit(family == .systemLarge ? 6 : 2)
                            .minimumScaleFactor(0.7)
                    }

                    if !dua.translation.isEmpty {
                        Text(dua.translation)
                            .font(.system(size: family == .systemSmall ? 11 : 12, weight: .medium))
                            .foregroundColor(Color(hex: "cbd5e1"))
                            .lineLimit(family == .systemLarge ? 8 : (family == .systemSmall ? 6 : 3))
                            .minimumScaleFactor(0.85)
                    }

                    Spacer(minLength: 0)
                }
                .padding(family == .systemSmall ? 12 : 16)
            } else {
                // Nothing chosen yet — tell the user where to pick one.
                VStack(spacing: 5) {
                    Text("\u{1F932}")
                        .font(.system(size: 22))
                    Text("Choose a dua")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                    Text("Tap the pin on any dua in the app")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Color(hex: "94a3b8"))
                        .multilineTextAlignment(.center)
                }
                .padding(12)
            }
        }
    }
}

struct TahajjudDuaWidget: Widget {
    let kind: String = "TahajjudDuaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DuaProvider()) { entry in
            DuaWidgetView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Dua")
        .description("A dua you choose from your collection.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

// MARK: - Colour helper

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    TahajjudWidget()
} timeline: {
    TahajjudEntry(date: .now, widgetData: .placeholder)
}
