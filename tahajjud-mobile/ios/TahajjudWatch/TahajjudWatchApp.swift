// Tahajjud+ Watch App entry point.
//
// The watch app is a thin companion to the iOS app. It reads prayer times +
// streak from the shared App Group (already populated by `WidgetDataBridge`
// every time the iPhone calculates prayer times) and lets the user log
// Tahajjud via a single button.
//
// "Log Tahajjud" writes an entry to the shared `pending-prayer-logs` key —
// the same queue used by Siri/App Intents — and the iPhone drains it next
// time the user opens the iOS app (already wired in App.tsx).
//
// No WatchConnectivity needed: shared App Group is sufficient and far simpler.

import SwiftUI

@main
struct TahajjudWatchApp: App {
    var body: some Scene {
        WindowGroup {
            MainView()
        }
    }
}
