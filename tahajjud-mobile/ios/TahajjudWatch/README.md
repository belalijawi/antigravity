# Tahajjud+ Apple Watch App — Xcode Setup

The Swift source files in this directory implement a watchOS companion app for
Tahajjud+. They cannot be added to the project via files alone — you need to
create a new Xcode target.

This takes about 10 minutes and is a one-time setup. The Swift code is already
written; Xcode just needs to know about it.

## Steps

### 1. Open the project in Xcode

```
cd /Users/ilay/Desktop/tajud/tahajjud-mobile/ios
open Tahajjud.xcworkspace
```

(Use `.xcworkspace`, not `.xcodeproj` — CocoaPods requires the workspace.)

### 2. Add a watchOS target

1. In Xcode menu: **File → New → Target…**
2. Pick **watchOS** in the platform tabs at the top.
3. Choose **App** (the modern single-target template, not the deprecated
   "App + Watch App" pair).
4. Click **Next**.
5. Fill in:
   - **Product Name:** `TahajjudWatch`
   - **Team:** your Apple Developer team (same as the iPhone app)
   - **Organization Identifier:** `com.tahajjudplus`
   - **Bundle Identifier:** auto-fills to `com.tahajjudplus.TahajjudWatch` — change it to `com.tahajjudplus.app.watchkitapp`
   - **Interface:** **SwiftUI**
   - **Language:** **Swift**
6. **Embed in:** select the existing iOS app target (`Tahajjud`) from the dropdown.
7. Click **Finish**.
8. Xcode asks "Activate scheme?" → click **Activate**.

### 3. Replace the template files with ours

Xcode just created a default `ContentView.swift` and `TahajjudWatchApp.swift`
inside the new `TahajjudWatch` folder it added to the project navigator.

Delete those two files (Move to Trash), then:

1. Right-click the `TahajjudWatch` group in Xcode's left sidebar.
2. Choose **Add Files to "Tahajjud"…**
3. Navigate to `ios/TahajjudWatch/` in this repo.
4. Select these four files:
   - `TahajjudWatchApp.swift`
   - `MainView.swift`
   - `SharedData.swift`
   - `Info.plist`
5. In the dialog, make sure **"Copy items if needed"** is **unchecked** (we
   want Xcode to reference the existing files, not duplicate them).
6. Under **Targets**, tick only **TahajjudWatch** (NOT the main iOS target).
7. Click **Add**.

### 4. Wire up the entitlement

The watch app needs the App Group entitlement so it can read/write the same
shared UserDefaults as the iPhone app.

1. Click the **TahajjudWatch** target in the project navigator.
2. Go to the **Signing & Capabilities** tab.
3. Click **+ Capability** at the top.
4. Add **App Groups**.
5. Click the **+** under the App Groups list.
6. Add: `group.com.tahajjudplus` (the same group the iPhone app uses).
7. Make sure it's checked.

This also generates a `TahajjudWatch.entitlements` file automatically. Replace
its contents with the `TahajjudWatch.entitlements` already in this folder if
you want explicit control — otherwise Xcode-generated is fine.

### 5. Set the iOS deployment target

1. With the **TahajjudWatch** target selected, go to **General**.
2. Set **Minimum Deployments → watchOS** to `9.0` or higher.

### 6. Build & run on the watch simulator

1. In the scheme selector (top of Xcode window), pick the **TahajjudWatch**
   scheme and a **paired watch simulator** (e.g. "Apple Watch Series 10 (46mm)
   paired with iPhone 16").
2. Press **⌘R** to build and run.

The watch app should launch in the watch simulator showing:
- Moon icon
- "Open Tahajjud+ on iPhone to sync" (since the shared data isn't populated
  yet in the watch sim — populate it by running the iPhone app first and
  letting prayer times load)
- "Log Tahajjud" button

### 7. Verify the round-trip

1. Run the iPhone app on the paired iPhone simulator.
2. Let prayer times load.
3. Switch to the watch simulator — pull down or relaunch the watch app.
4. You should now see the actual next prayer countdown + streak from the
   iPhone.
5. Tap "Log Tahajjud" on the watch.
6. Foreground the iPhone app. On launch, the iPhone's `drainPendingPrayerLogs`
   function (in `App.tsx`) drains the queue and the log appears in the
   Tahajjud tracker.

### 8. (Optional) Add a complication

Watch faces can show a small Tahajjud+ widget. Add a `WidgetKit` extension to
the watch target if you want this — separate setup, not required for v1.

## Troubleshooting

**"Cannot find 'SharedData' in scope"** → The files weren't added to the
TahajjudWatch target's "Compile Sources" build phase. Select the file in the
project navigator → File Inspector (right panel) → tick "TahajjudWatch" under
"Target Membership".

**"App Group entitlement missing"** → Verify both the iPhone and watch
entitlement files have `group.com.tahajjudplus` listed and the same App
Group exists in your Apple Developer portal (Certificates, Identifiers &
Profiles → Identifiers → App Groups).

**Watch can't read shared data** → The iPhone has to write to the shared
UserDefaults first. Run the iPhone app, let prayer times calculate (this calls
`WidgetDataBridge.writeWidgetData` which populates the shared key). Then check
the watch.
