# Deep Focus Native

A small macOS 14+ menu-bar app for the foreground application and public HTTP(S) URL in Safari, Chrome, or Edge, with an optional local timeline and an iOS 17+ companion prototype. SwiftUI and Apple frameworks, with no third-party runtime dependencies. The Electron app is independent and unchanged.

The canonical product direction is the [approved frozen charter](docs/product-direction/2026-11-06-v1.md), protected by a read-only file, checksum, and automated check. Direction changes require a new approved amendment. [Delivery roadmap](docs/ROADMAP.md) tracks the four directions separately and can change as work proceeds.

This is a local development build, **not yet validated for App Store submission**. The sandboxed app and authenticated local server run successfully. Chrome and Edge pairing, real public URLs, private-window exclusion, and short duration/pause checks have passed. Safari, physical lock/sleep checks, and the remaining reliability matrix are release gates; see [VALIDATION.md](VALIDATION.md).

The packaged macOS app is available at `build/DeepFocusNative.zip`. Unzip and open **Deep Focus Native.app**, then follow browser setup below. It contains both Apple Silicon and Intel code; runtime checks used Apple Silicon. Desktop history has passed a short live persistence/duration check; mobile physical-device integration remains pending.

## Build and run

Requires Xcode 16.3 or later. The project uses ad-hoc local signing by default and needs no Apple Developer account to build the Mac app.

```sh
cd deepFocus-native
bash scripts/build.sh
open "build/Build/Products/Release/Deep Focus Native.app"
```

Or open `DeepFocusNative.xcodeproj`, select **DeepFocusNative → My Mac**, and Run. Launch opens a small **Deep Focus** window with browser setup visible; the app also has a **scope/target icon in the macOS menu bar**, with no Dock icon. Close the window to keep monitoring from the menu bar; **Open window** in the popover brings it back. Quit other native copies before launching another; they use the same local port. The original Electron app uses a different port.

Click the menu-bar icon to see the application name and URL. **Pause** clears the observation and stops URL collection; **Resume** waits for a fresh observation. Unsupported browsers still appear by application name. Browser internal pages, private windows, missing permissions, and disconnected extensions show URL unavailable. Disconnected URLs expire within six seconds (plus the one-second timer tolerance).

## Timeline and gap review

Open **Today’s timeline** and enable **Save local timeline** to record app/domain durations. History starts off. Saved domains exclude URL paths, queries, fragments, and embedded credentials. Lack of recent input is shown separately; it may represent reading or thought. Foreground time is not presented as a productivity or attention score.

Tag a displayed interval to confirm its activity. Later corrections take precedence over earlier ones while retaining the original observations and confirmation history. Completed gaps of at least 15 minutes can be reviewed, deferred with a quiet period, or explicitly left unknown. Optional **Enable gap reminders** requests macOS notification permission only when pressed. Reminders are capped at twice per day, two hours apart; quiet periods and paused/suspended monitoring suppress them. OS delivery has not yet been tested.

The local timeline saves approximately every 30 seconds, on explicit edits, and on normal suspension/exit. A forced termination can lose the unsaved tail; it does not backfill the interruption as work. There is no automatic retention deletion. Disabling capture retains existing records. A corrupt/incompatible archive is preserved instead of overwritten.

**Import evidence** and **Export tags / evidence** move user confirmations, coarse place observations, and quiet periods in a versioned JSON file. These are explicit file operations, not automatic sync. Raw desktop activity stays on that device. Imported context is visible separately and never establishes an activity or human work time by itself. Automatic Google Calendar integration remains planned.

## iOS companion prototype

In the same Xcode project select **DeepFocusCompanion**, choose your own development team and an iPhone, and Run. The app requires iOS 17+. Signing-account settings have not been changed. Its simulator-destination build is verified; no physical-device or simulator UI session has been used.

You can save an activity for a chosen interval, set quiet periods, and explicitly export/import evidence through Files. Optional **Enable place visits** requests When In Use access; a subsequent **Allow background visits** action requests Always access. Until Always is granted the collector does not start. **Stop place visits** stops collection but retains existing records. Location is rounded to approximately 0.01° areas; the original coordinate is not stored. Visits can be delayed or incomplete and are not a continuous route or proof of purpose. Keep location off if manual tags are sufficient.

To transfer evidence, export a JSON file from the phone to a destination you choose, then import it in the Mac timeline. A quiet period in the file extends the Mac's quiet period if longer. The phone prototype has no automatic cloud/agent sharing or notification scheduler.

Headless compilation:

```sh
python3 scripts/generate_project.py
xcodebuild -project DeepFocusNative.xcodeproj -scheme DeepFocusCompanion \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build-ios CODE_SIGNING_ALLOWED=NO build
```

## Chrome and Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode, choose **Load unpacked**, and select this project's `Browser/chromium` directory. The same bundle supports both browsers. This is a development installation, not a marketplace release.
3. In the separate **Deep Focus Native Mac app**, choose **Browser setup → Copy pairing code** (setup is visible when its window first opens). The browser extension's popup only accepts the code; it does not generate it.
4. Open **Deep Focus Browser Monitor** from the browser's extensions menu, paste the code, and choose **Pair**. The code is a local credential; do not share it. The app clears its copied code from the clipboard after two minutes if nothing else has replaced it.
5. Open a public webpage, make that browser the foreground app, and check the menu-bar popover. Keep private-window access disabled. Chrome/Edge's manifest explicitly disallows incognito operation.

Install and pair separately in each browser/profile you use. Only a focused normal browser window can supply an observation. A worker restart or browser suspension can briefly show URL unavailable while reconnecting.

## Safari

The app contains `DeepFocusSafari.appex`. It is a Safari Web Extension using the same monitoring logic as Chrome/Edge.

1. Launch the built app once. Open **Safari → Settings → Extensions**, or use **Safari settings** in the Mac app's setup panel.
2. Enable **Deep Focus Browser Monitor**. For this ad-hoc signed development build, Safari may require **Allow Unsigned Extensions** in its developer settings. That is a development-only setting: enable it yourself only if you intend to test the local source. Otherwise, select your Apple Developer team for **both targets**, use development signing, and rebuild. Do not disable SIP or Gatekeeper.
3. Copy and pair the code using the same flow as Chrome/Edge.
4. In the extension popup, choose **Allow Safari URL access**. Safari requires website access to reveal a tab's URL, even with the `tabs` permission. You can manage or revoke that access in Safari Settings → Extensions → Edit Websites. Without it, desktop-app monitoring still works, but website URLs may be unavailable.
5. Keep **Allow in Private Browsing** disabled. The code additionally checks window/tab privacy before transmitting anything.

The extension does not inject scripts, read page contents, block websites, or close tabs. Safari's website permission is broader than the URL information this implementation uses. [Apple's Safari permissions overview](https://developer.apple.com/videos/play/wwdc2020/10665/)

## Data and architecture

- `Sources/MonitorCore`: deterministic activity-selection state and HTTP request validation; shared by the app and unit tests.
- `App`: foreground tracking, menu-bar UI, sandboxed loopback server, pairing credential.
- `Shared` and `iOS`: local timeline persistence, evidence file exchange, and the phone companion.
- `Browser/shared`: canonical browser code. `Browser/chromium` and `Browser/safari` are generated distributable copies.
- `SafariExtension`: native Safari extension entry point. No URLs are routed through native-message logging.
- `scripts/generate_project.py`: reproducibly generates the checked-in Xcode project, configurations, and browser bundles using Python's standard library. Edit this script when changing generated project settings.

The app listens **only on `127.0.0.1:17322`**, with the App Sandbox `network.server` entitlement. User-selected file access supports explicit evidence import/export. The Safari extension has its own sandbox and `network.client` entitlement. There are no cloud endpoints, accounts, or analytics.

A random pairing credential is persisted in the app's sandbox (`Application Support/DeepFocusNative/pairing-token`, owner-readable/writable only) and in the paired extension's local storage. Optional timeline records are stored in the same sandbox directory in `timeline-v1.json`, with owner-only file permissions. No history is recorded until enabled or a person explicitly saves/imports a record. Full URLs stay in memory and are never logged; paths, query parameters, and fragments are displayed live only. The bridge does not return URLs from its status endpoint.

`GET /v1/status` and `POST /v1/event` require `Authorization: Bearer <pairing-code>`. Status returns the active supported browser, monitoring state, and a random observation epoch. An event contains `browser`, `epoch`, `sequence`, `observedAt` (Unix milliseconds), `focused`, `privateBrowsing`, and nullable `url`. A foreground or pause/suspension change rotates the epoch. Wrong-browser, old-epoch, out-of-order, and delayed messages are rejected. Explicit private/unfocused/unavailable events clear the observation. The native app determines the foreground browser; it does not trust extension focus alone.

The extension checks status before querying its active tab, reports navigation/focus changes, and sends a heartbeat every two seconds. A reconnect alarm recovers suspended workers. Only real, focused public-tab observations enter the native display.

## Tests

```sh
swift test
python3 scripts/verify_direction.py
# If Node is not on PATH in a non-interactive shell:
source "$HOME/.nvm/nvm.sh"
nvm use 22
node --test Tests/browser.test.cjs
# With the native app running; reads its credential without printing it:
python3 scripts/bridge_smoke.py
# Actual persistence class, disposable synthetic files only:
swiftc Sources/MonitorCore/*.swift Shared/TimelineStore.swift scripts/PersistenceProbe.swift \
  -o /tmp/deepfocus-persistence-probe
/tmp/deepfocus-persistence-probe
```

The Swift tests cover foreground selection, stale events, clearing, pause/suspension, URL validation, and malformed/unauthenticated HTTP requests. JavaScript tests exercise actual shared extension code with mocked browser APIs, including asynchronous tab-switch races. They do **not** replace testing inside each browser.

Before public distribution, complete the manual matrix in `VALIDATION.md`, configure Developer ID or App Store signing, and validate the Safari extension and privacy disclosures. No store submission or signing-account changes are performed by the build script.
