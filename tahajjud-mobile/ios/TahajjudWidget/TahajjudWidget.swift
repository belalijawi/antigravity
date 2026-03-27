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
        let defaults = UserDefaults(suiteName: "group.com.tahajjudplus.app")
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
        .supportedFamilies([.systemSmall, .systemMedium])
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
        default:
            SmallWidgetView(entry: entry)
        }
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
