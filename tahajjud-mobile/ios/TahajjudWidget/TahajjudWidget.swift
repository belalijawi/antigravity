import WidgetKit
import SwiftUI

// MARK: - Shared data model

struct WidgetData: Codable {
    var nextPrayer: String
    var nextPrayerTime: Date
    var streak: Int
    var updatedAt: Date
    var tahajjudStart: Date?

    static let placeholder = WidgetData(
        nextPrayer: "Isha",
        nextPrayerTime: Date().addingTimeInterval(3600),
        streak: 7,
        updatedAt: Date(),
        tahajjudStart: Date().addingTimeInterval(18000) // ~5 hours from now
    )

    static func load() -> WidgetData {
        let defaults = UserDefaults(suiteName: "group.com.tahajjudplus")
        guard let data = defaults?.data(forKey: "widget_data"),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .placeholder }

        let nextPrayer     = json["nextPrayer"] as? String ?? "Prayer"
        let nextPrayerTime = (json["nextPrayerTime"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let streak         = json["streak"] as? Int ?? 0
        let updatedAt      = (json["updatedAt"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        let tahajjudStart  = (json["tahajjudStart"] as? Double).map { Date(timeIntervalSince1970: $0) }

        return WidgetData(
            nextPrayer: nextPrayer,
            nextPrayerTime: nextPrayerTime,
            streak: streak,
            updatedAt: updatedAt,
            tahajjudStart: tahajjudStart
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
        let entry = TahajjudEntry(date: Date(), widgetData: data)
        // Refresh 5 min after the next prayer OR at Tahajjud time — whichever is sooner
        var refresh = data.nextPrayerTime.addingTimeInterval(300)
        if let tahajjud = data.tahajjudStart, tahajjud > Date() {
            refresh = min(refresh, tahajjud)
        }
        refresh = max(Date().addingTimeInterval(300), refresh)
        let timeline = Timeline(entries: [entry], policy: .after(refresh))
        completion(timeline)
    }
}

struct TahajjudEntry: TimelineEntry {
    let date: Date
    let widgetData: WidgetData
}

// MARK: - Views

struct SmallWidgetView: View {
    let entry: TahajjudEntry
    @Environment(\.colorScheme) var colorScheme

    var countdownText: String {
        let diff = entry.widgetData.nextPrayerTime.timeIntervalSince(Date())
        if diff <= 0 { return "Now" }
        let hours = Int(diff) / 3600
        let mins  = (Int(diff) % 3600) / 60
        if hours > 0 { return "\(hours)h \(mins)m" }
        return "\(mins)m"
    }

    var prayerEmoji: String {
        switch entry.widgetData.nextPrayer.lowercased() {
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
                if let tahajjud = entry.widgetData.tahajjudStart {
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
                Text(entry.widgetData.nextPrayer)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)

                // Time
                Text(entry.widgetData.nextPrayerTime, style: .time)
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
        let diff = entry.widgetData.nextPrayerTime.timeIntervalSince(Date())
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

                    Text(entry.widgetData.nextPrayer)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)

                    Text(entry.widgetData.nextPrayerTime, style: .time)
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
                    if let tahajjud = entry.widgetData.tahajjudStart {
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

                // Right: streak
                VStack(spacing: 4) {
                    if entry.widgetData.streak > 0 {
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
        }
    }
}

// MARK: - Large Widget

struct LargeWidgetView: View {
    let entry: TahajjudEntry

    var isGateOpen: Bool {
        guard let t = entry.widgetData.tahajjudStart else { return false }
        return Date() >= t
    }

    var countdownText: String {
        let diff = entry.widgetData.nextPrayerTime.timeIntervalSince(Date())
        if diff <= 0 { return "Now" }
        let h = Int(diff) / 3600
        let m = (Int(diff) % 3600) / 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    var prayerEmoji: String {
        switch entry.widgetData.nextPrayer.lowercased() {
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

                    if let tahajjud = entry.widgetData.tahajjudStart {
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
                        Text(entry.widgetData.nextPrayer)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(entry.widgetData.nextPrayerTime, style: .time)
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
        let nextDate = entry.widgetData.nextPrayerTime
        let tahajjud = entry.widgetData.tahajjudStart
        let now = Date()
        // Guard: SwiftUI's `Text(timerInterval:...)` crashes if the upper
        // bound is in the past. Use `nextDate.addingTimeInterval(60)` floor.
        let safeUpper = max(nextDate, now.addingTimeInterval(60))
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "moon.stars.fill")
                Text(entry.widgetData.nextPrayer.uppercased())
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
        let nextDate = entry.widgetData.nextPrayerTime
        Text("\(entry.widgetData.nextPrayer): \(nextDate, format: .dateTime.hour().minute())")
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
