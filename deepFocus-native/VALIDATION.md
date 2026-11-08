# November 8 · first physical iPhone installation

Deep Focus Companion v0.4.0 was development-signed, installed and launched on the operator’s cable-connected iPhone 13 Pro Max running iOS 27.2. Apple’s device tools confirmed installation, successful launch and a running app process. Signature verification passed with the system trust store. The phone was paired with Developer Mode enabled; Xcode account reauthentication resolved the earlier provisioning failure.

This verifies installation and startup only. Calendar authorization/provider synchronization, manual activity persistence through phone relaunch, location permission/background visit delivery and battery behavior still require live checks. No calendar or location permissions were granted by the agent. This remains a development installation, not TestFlight/App Store distribution.

# November 7 · Apple Calendar setup simplification

Operator follow-up: Apple Calendar is the supported client for this milestone; Notion-specific setup and live validation are deferred. Updated app copy, setup guide and roadmap. EventKit collection, multi-account selection and publication behavior are unchanged. Mac Release and iPhone Simulator builds passed after the copy changes; frozen charter checksum and whitespace checks passed. No new personal calendar access or live provider-sync test was performed.

# November 7 · multi-calendar and concurrent-activity validation (v0.4.0)

| Check | Result |
|---|---|
| Swift core suite | 84 tests passed, zero failures |
| Actual EventKit adapter boundary probe | Explicit permission, empty selection/no query, revocation clearing, delayed authorization/disconnect, Actuals selection exclusion, publishing scope, changed/moved entries and overlapping publication rejection passed using a synthetic backend |
| Actual TimelineStore probe | Eight checks passed: write/reopen/owner-only permissions, multi-activity exchange, exact v1/v2 backup→v3 migration, import diagnostics, conflicting backup, corrupt/future archive preservation |
| Native macOS Release | Universal arm64/x86_64 build passed; strict deep signature verification passed; sandbox/calendar entitlement inspected |
| iPhone companion | iOS Simulator build passed; installed and launched in iPhone 16 / iOS 18.4 simulator without requesting calendar or location access |
| Separate camera target | Release build passed after shared core/schema changes; no new camera runtime check |
| Mac bundle size | 3,612 KiB allocated (`du -sk`), approximately 3.53 MiB |
| Charter / generation | Frozen checksum unchanged; generator rerun and whitespace checks passed |
| Independent review | Standards and spec passes completed; fractional timestamp reimport conflicts, observation-fragmented publication, and overlapping corrected-publication defects fixed with regressions |

The main app now has the sandbox Calendar entitlement and full-access purpose string. It requests authorization only from Connect; no calendars are selected by default. Native provider events are intentions, not confirmed time. Publication is explicit, whole-second, limited to activity labels/times in an existing writable Actuals calendar, with immutable ownership checks and device-local identifier receipts. Cross-device publication reconciliation and replacement/deletion remain unsupported; publish from one device.

**Not live-verified:** real Calendar authorization/revocation, Google multi-account visibility and provider synchronization, shared/read-only account behavior, recurrence edits arriving through EventKit, publication appearing in Apple Calendar on both devices, physical iPhone operation. No personal events were read or written during this increment. Simulator launch is not evidence of live calendar-provider integration. No new CPU/memory measurement was performed. Browser code did not change; earlier live/browser test evidence below is historical.

## Live calendar acceptance checklist

- Add two Google accounts in system Calendar settings; grant Calendar access from Connect and select calendars from both.
- Verify account labels/aliases, two same-named events, overlapping events, timed/all-day/recurring entries, and switching days.
- Edit/delete/move an occurrence in another client, refresh, and confirm the visible snapshot and gap intentions update.
- Deselect all, disconnect, revoke access and relaunch; verify no stale local connected intentions remain while imported evidence/confirmations survive.
- Confirm Walking + Communication on a past interval and verify elapsed time remains single-counted.
- Create a separate Actuals calendar; review and explicitly publish. Verify identical retry skips, changed/overlapping owned events reject, plans remain untouched, and output appears in Apple Calendar on both devices using the same account.
- Finish physical iPhone permissions/background location and manual evidence exchange checks separately.

## Previous checkpoints

# November 7 parallel implementation validation

This checkpoint concerns native v0.3.0 source and extension v0.2.0. Prior November 6 live results below remain historical evidence; they do not establish live verification of these new changes.

| Check | Result |
|---|---|
| Swift core suite | 66 tests passed, zero failures |
| Shared extension + popup tests | 15 tests passed, zero failures |
| macOS Release | Universal arm64/x86_64 build passed; strict deep code-sign verification passed |
| QuietDesktopExperiment Release | Separate sandboxed app build passed; strict deep code-sign verification passed |
| iOS companion | Generic iOS Simulator destination build passed; no device/runtime UI exercised |
| Actual TimelineStore probe | Write/reopen, permissions, v1 byte-preserving backup→v2 migration, exchange, invalid calendar diagnostics/atomic preservation, corrupt/future archive protection passed |
| Agent event writer | Explicit event write, exact retry, conflict preservation, owner-only permissions passed |
| Frozen charter | Checksum verified unchanged |
| Independent review | Standards and spec passes completed; runtime overflow, lost prompt-presence feedback, and calendar diagnostics corrected |
| Mac app bundle | 2,532 KiB allocated by `du -sk` (~2.47 MiB), universal Release |
| Separate camera app bundle | 2,116 KiB allocated (~2.07 MiB), Release |

The signed core app entitlements remain sandbox + local network server + user-selected file access; no camera entitlement. Only the separate experiment has camera access capability. Builds use ad-hoc local signing, not App Store distribution signing.

New behavior is automated-test/build verified: explicit Dia/Arc identity and setup migration; composed suspension reasons; calendar update/cancellation/recurrence/DST handling; phone visit completion and stopped-generation rejection; agent event identity, atomic conflict rejection and unavailable invalid runtimes; camera state/calibration/prompt policies. A regression test reproduced the extreme-duration overflow before its fix. Camera UI action handlers were typechecked and reviewed; real prompt interaction remains pending.

**Not performed in this increment:** Dia/Arc install/pairing or split-view checks; Safari enablement; physical lock/sleep/wake and input-idle checks; new sustained CPU/memory/archive-growth benchmark; physical iPhone permissions/background delivery; camera authorization, actual resource release, absence/occlusion accuracy, prompt delivery; five-working-day trial. No new browser/camera permissions were granted. The user explicitly deferred Dia/Arc live installation and pairing on November 7; no additional browser access was granted. Existing Chrome/Edge extensions need Reload → choose browser → Pair after upgrading.

## Earlier evidence

# Validation — 2026-11-06

## Version 0.2 development status

The approved four-part product direction is frozen at `docs/product-direction/2026-11-06-v1.md`. Its SHA-256 check passes, its file and checksum are read-only, and automated tests enforce that the approved content has not changed. Implementation status is separate in `docs/ROADMAP.md`.

| Check | Result |
|---|---|
| Expanded macOS Release build | Passed, universal arm64 + x86_64, sandboxed |
| iOS companion generic simulator-destination build | Passed, iOS 17+ target; simulator/device execution not performed |
| Swift core tests | 27 passed, including durations, pause/sleep/clock gaps, partial corrections, DST, provenance, file exchange, reminder policy, and charter checksum |
| Browser logic tests | 7 passed against shared extension code with mocked browser APIs |
| Actual persistence class probe | Write/reopen, owner-only file permissions, evidence export/merge, and corrupt-file preservation passed using disposable synthetic files |
| macOS bundle size | Approximately 1.8 MiB including Safari extension; below 20 MB target |
| iOS simulator bundle size | Approximately 1.6 MiB debug simulator bundle; not a device download-size estimate |
| Actual app signature | Verified; App Sandbox, loopback server, and user-selected file read/write entitlements present |
| Capture defaults | Desktop local history and gap notifications start disabled; iOS does not request location at launch |
| Existing Electron changes | `package.json` and `src/main.ts` remain in their existing modified state; not edited by this work |

The unlocked continuation below verifies the setup window, Chrome/Edge URLs, and a short real duration/pause sample. Notification authorization/delivery, file-picker behavior, correctness of the sandboxed input-idle signal, and physical iOS background visit delivery remain unverified. The earlier locked-state baseline applies to version 0.1. Prior CPU/memory samples must not be reused as measurements of the new features.

Additional acceptance checks on unlocked devices:

1. Enable local history, switch between apps and public websites for known intervals, and compare the timeline and totals to a stopwatch. Verify domain-only storage and that history remains off until enabled.
2. Pause, suspend, sleep, and resume. Confirm there is no fabricated work across the gap; interruptions shorter than the save cadence may lose the unsaved tail after a forced termination.
3. Tag part of an interval, change its tag, and reopen the app. Confirm original observations remain, the most recent correction takes precedence, and the civil day is partitioned without duplicate time.
4. Return after a 15+ minute gap/no-input interval. Verify the review card, leave unknown, quiet periods, explicit notification permission, and rate limits. Notifications must contain no activity details.
5. On an iPhone, test denied/revoked/When In Use/Always/reduced-accuracy location states, delayed/partial visits, locked-phone background delivery, relaunch, and battery use. Verify stored coordinates are coarse and stopping visits stops further capture.
6. Export confirmations/place evidence on the phone and import on the Mac. Verify idempotence, provenance, quiet-period extension, and context-only display. Agent/place/calendar context must not create human work time.

## Unlocked continuation — 2026-11-06

The user confirmed the Mac was unlocked and approved installing/pairing the local Chrome and Edge extensions and enabling local timeline capture for testing.

| Check | Result |
|---|---|
| Frozen charter | Checksum verified; original unchanged |
| Swift / browser logic regression checks | 27 Swift and 7 browser tests passed |
| Running version 0.2 bridge | Authenticated status passed; missing credentials, malformed events, webpage origins, unknown routes, and stale events rejected |
| Actual foreground browser selection | Authenticated status returned `monitoring: true` and `chrome` while Chrome was foreground, then `edge` after switching to Edge |
| Chrome extension | Installed and paired through actual popup UI; native window displayed the current public `example.org` URL, including a controlled query/fragment navigation |
| Edge extension | Installed and paired through actual popup UI; native window displayed the current public `example.com` URL and later navigation |
| Accessible native setup | Added a launch window with browser setup visible and an Open window button in the menu-bar view; Release rebuild passed. Copied pairing code through its UI without printing the credential |
| Current app / cross-browser selection | Native UI showed Chrome, Edge, and the desktop ChatGPT app; desktop selection cleared the URL. Navigating background Edge did not replace foreground Chrome; activating Edge through Finder then selected Edge's fresh report |
| Chrome tabs / internal pages | New tab cleared URL; closing it restored the public tab. A file/error page also cleared URL |
| Private browsing | Chrome Incognito and Edge InPrivate both cleared URL, including with controlled public websites open inside private windows; returning to normal windows restored public URLs |
| Multiple Edge windows | New normal window selected `example.org`; closing it restored original `example.com` window |
| Local timeline | Enabled through UI after explicit approval; real app/domain intervals persisted in the sandbox. Controlled URL query/fragment markers and `https://` absent from archive |
| Short duration comparison | 67.654 seconds recorded across a 67.654-second observed wall-clock window, with no overlapping intervals. This tests foreground coverage, not attention or productivity |
| Pause / resume | UI cleared immediately on Pause; 29.958 seconds after an independent paused checkpoint contained zero recorded seconds. Resume initially showed URL unavailable, then accepted a fresh browser report |
| Restart / window lifecycle | Normal Quit preserved 29 interval IDs; relaunch retained capture opt-in and displayed prior history plus an honest restart gap. Closing the window left the authenticated bridge monitoring; reopening the app from Finder restored its window |
| Release app / ZIP size | Rebuilt app: 1,860 KiB allocated (about 1.82 MiB), including embedded extension. Refreshed `build/DeepFocusNative.zip`: 544 KiB allocated |
| Short resource sample | Five `ps` samples at five-second spacing: 0.0% CPU each; RSS 18,416–19,184 KiB (about 18.0–18.7 MiB). Timeline on, both Chromium extensions paired, setup window open; browser activity was not held fixed. Not a sustained idle/active benchmark |

These are short live integration checks, not a five-day reliability trial or proof of attention. Developer mode is enabled in Chrome and Edge, both extensions are paired, and the operator-approved local timeline is enabled. Private-window access remains disabled. Safari initially showed “No Extensions”; its development-install permission is a separate gate.

Safari developer features were inspected and were off. Enabling unsigned development extensions and granting website access requires separate user confirmation; neither was changed at this checkpoint. An Edge disable/re-enable exercise was attempted while the native foreground was ChatGPT, so it does not establish foreground disabled-extension expiry. Edge was restored to enabled. Full browser restarts, profile switching, worker suspension, and physical lock/sleep remain pending.

The quiet desktop session addition is saved in `docs/product-direction/2026-11-06-quiet-desktop-session-amendment.md` and `docs/experiments/quiet-desktop-session.md`. It is a specification, not a built camera collector, repaired PosturePilot implementation, completed five-day trial, or demonstrated Upright integration.

## Earlier version 0.1 runtime baseline

| Check | Result |
|---|---|
| Xcode 16.3 Release build | Passed; macOS 14+ universal binary (arm64 + x86_64); runtime checks on Apple Silicon only |
| Embedded Safari extension | Built and embedded with manifest and all shared resources |
| App + extension signature verification | Passed with local ad-hoc signing |
| App Sandbox | Present in actual signed app entitlements |
| Loopback bind | Running app listens on `127.0.0.1:17322`, not all interfaces |
| Swift unit tests | 13 passed |
| Browser logic tests | 7 passed; uses mocked browser APIs, not installed browser integration |
| Running app bridge smoke test | Authenticated status works; absent credentials, webpage origins, malformed events, unknown routes rejected |
| Locked Mac observation | Running app reports monitoring disabled while computer-use tools report the Mac locked; unlock/resume still unverified |
| App bundle size | Approximately 908 KiB allocated on disk, including Safari extension; well below 20 MB target |
| Packaged download | `build/DeepFocusNative.zip`, approximately 236 KiB |
| Idle resource sample | 0.0% CPU and 24,624 KiB RSS (about 24 MiB), one sample after ~14 minutes; no paired browser extension |
| Existing Electron work | Existing modified files were left untouched |

## Still required before calling browser integration proven

The earlier version 0.1 inspection was blocked by a locked Mac, and the user chose to finish with build/setup instructions. The unlocked continuation above supersedes that installation status for Chrome and Edge, but not the remaining end-to-end checks. No valid signing identity was visible in the earlier environment check. Safari's unsigned-extension setting was **not changed**, and these checks are not claimed to have passed:

| Scenario | Safari | Chrome | Edge |
|---|---|---|---|
| Install, pair, and display a public HTTPS URL | Pending | Passed | Passed |
| Navigation and tab switches update within ~2 seconds | Pending | Navigation/tab checks passed; precise latency not measured | Navigation passed; precise latency/tab matrix pending |
| Multiple windows/profiles select only the focused window | Pending | Pending normal-window/profile matrix | Two normal windows passed; profiles pending |
| Background browser cannot replace foreground activity | Pending | Foreground Chrome preserved during background Edge navigation | Selected correctly after activation; reciprocal background check pending |
| Private/internal/new-tab pages clear previous URL | Pending | Passed for tested private/new-tab/file pages | Private passed; internal/new-tab matrix pending |
| Missing/revoked permissions and disabled extension clear URL | Pending | Pending | Pending |
| Browser restart and service-worker suspension reconnect | Pending | Pending | Pending |
| Localhost/CORS permissions in the actual browser | Pending | Passed through real pairing and URL delivery | Passed through real pairing and URL delivery |

Also pending: menu-bar popover behavior independent of the new setup window, icon appearance, physical screen lock/unlock, sleep/wake, and extended usage. App-name switching and Pause/Resume passed in the setup window. State transitions are unit tested; actual OS notification delivery is not. Screen-lock handling supplements public workspace session/display notifications with distributed lock/unlock notifications; their delivery must be verified on supported macOS versions.

## Manual acceptance procedure

1. Build and launch the app; complete the README's pairing steps for the browser being tested.
2. Open `https://example.com` in the foreground browser. The popover should show its browser name and URL. Navigate to `https://example.org`; switch tabs and windows and confirm the current URL.
3. Bring a desktop app to the foreground. Its name/icon must replace the browser and the URL must disappear. Leave another browser open in the background; its events must not replace this observation.
4. Switch to a private window (without granting this extension private access), an internal browser page, and a new tab. No private/internal URL may appear; the previous public URL must clear, at latest on expiry if the browser withholds events.
5. Disable/revoke extension access, then restore it. Expect URL unavailable within the six-second expiry plus timer tolerance, then a fresh URL after reconnection. Repeat after restarting the browser and with multiple profiles.
6. Pause and resume. Pause clears immediately; resume requires a new observation. Lock/unlock and sleep/wake the Mac. No old URL may reappear from a delayed message.
7. Run `python3 scripts/bridge_smoke.py`. Measure CPU and RSS with the menu closed and extensions paired; record sustained samples separately from the baseline above.

Sandboxed server feasibility is demonstrated. Cross-browser feasibility and App Store readiness remain open gates; a successful build is not evidence of either.
