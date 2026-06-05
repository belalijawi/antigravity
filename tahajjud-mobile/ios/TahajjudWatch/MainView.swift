// Main watch view — next prayer countdown, Tahajjud streak, and a single
// "I prayed Tahajjud" button. Optimized for a single glance on the watch face.

import SwiftUI

struct MainView: View {
    @State private var snapshot: SharedData.PrayerSnapshot?
    @State private var loggedToday: Bool = false
    @State private var showConfirmation: Bool = false

    /// Refresh from App Group every time the view appears.
    private func refresh() {
        snapshot = SharedData.loadSnapshot()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {

                // Moon icon header
                Image(systemName: "moon.stars.fill")
                    .font(.title2)
                    .foregroundColor(.cyan)
                    .padding(.top, 4)

                if let s = snapshot {
                    // ── Next prayer ──
                    VStack(spacing: 2) {
                        Text(s.nextPrayer.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.gray)
                            .tracking(1.2)

                        if s.nextPrayerTime > Date() {
                            Text(timerInterval: Date()...s.nextPrayerTime, countsDown: true)
                                .font(.title2.weight(.bold))
                                .monospacedDigit()
                                .foregroundColor(.white)
                        } else {
                            Text(s.nextPrayerTime, format: .dateTime.hour().minute())
                                .font(.title2.weight(.bold))
                                .monospacedDigit()
                                .foregroundColor(.white)
                        }
                    }
                    .padding(.bottom, 4)

                    // ── Tahajjud window indicator ──
                    if let t = s.tahajjudStart, t > Date() {
                        VStack(spacing: 2) {
                            Text("TAHAJJUD")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.cyan)
                                .tracking(1.1)
                            Text(t, format: .dateTime.hour().minute())
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.cyan.opacity(0.85))
                        }
                        .padding(8)
                        .background(Color.cyan.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    // ── Streak ──
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .font(.caption2)
                            .foregroundColor(.orange)
                        Text("\(s.streak) day streak")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white.opacity(0.85))
                    }

                } else {
                    // Snapshot missing — iPhone hasn't synced yet
                    Text("Open Tahajjud+ on iPhone\nto sync")
                        .multilineTextAlignment(.center)
                        .font(.caption2)
                        .foregroundColor(.gray)
                        .padding(.vertical, 12)
                }

                // ── Log Tahajjud button ──
                Button(action: {
                    SharedData.queuePrayerLog("tahajjud")
                    loggedToday = true
                    showConfirmation = true
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: loggedToday ? "checkmark.circle.fill" : "moon.fill")
                        Text(loggedToday ? "Logged" : "Log Tahajjud")
                            .font(.caption.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(loggedToday ? Color.green.opacity(0.3) : Color.cyan)
                    .foregroundColor(loggedToday ? .green : .black)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(loggedToday)
                .padding(.top, 6)

                // ── Quick log other prayers ──
                if !loggedToday {
                    VStack(spacing: 6) {
                        Text("OR LOG TODAY'S")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray.opacity(0.7))
                            .tracking(1.0)
                            .padding(.top, 4)
                        HStack(spacing: 4) {
                            ForEach(["Fajr", "Dhuhr", "Asr"], id: \.self) { p in
                                QuickLogButton(name: p)
                            }
                        }
                        HStack(spacing: 4) {
                            ForEach(["Maghrib", "Isha"], id: \.self) { p in
                                QuickLogButton(name: p)
                            }
                        }
                    }
                }

                Text("Synced \(timeAgoString(snapshot?.updatedAt ?? Date()))")
                    .font(.system(size: 9))
                    .foregroundColor(.gray.opacity(0.5))
                    .padding(.top, 6)
            }
            .padding(.horizontal, 8)
        }
        .onAppear { refresh() }
        .alert("Tahajjud logged", isPresented: $showConfirmation) {
            Button("Alhamdulillah", role: .cancel) {}
        } message: {
            Text("Open Tahajjud+ on your iPhone to see it on the tracker.")
        }
    }

    private func timeAgoString(_ d: Date) -> String {
        let diff = Int(Date().timeIntervalSince(d))
        if diff < 60 { return "just now" }
        if diff < 3600 { return "\(diff/60)m ago" }
        if diff < 86400 { return "\(diff/3600)h ago" }
        return "\(diff/86400)d ago"
    }
}

struct QuickLogButton: View {
    let name: String
    @State private var logged = false
    var body: some View {
        Button(action: {
            SharedData.queuePrayerLog(name.lowercased())
            logged = true
        }) {
            Text(logged ? "✓" : String(name.prefix(3)))
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(logged ? .green : .white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(logged ? Color.green.opacity(0.2) : Color.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .disabled(logged)
    }
}
