# Deep Focus delivery roadmap

This is editable delivery status. Product direction is governed by the [frozen, approved charter](product-direction/2026-11-06-v1.md); changing this roadmap does not amend it.

Approved addition: [quiet desktop session experiment amendment](product-direction/2026-11-06-quiet-desktop-session-amendment.md). The frozen v1 remains unchanged.

## November 7 · multi-account calendars and concurrent activities

Built v0.4.0: shared Mac/iPhone agenda reads explicitly selected calendars across multiple system-configured accounts; account aliases and calendar labels preserve context. Operator update: use Apple Calendar as the supported calendar client; defer Notion-specific integration and validation. Multiple accounts still feed one agenda through EventKit. Connect is the only permission-request path. Refresh, deselection, disconnect and revocation handle local connected intentions separately from manual imports and other-device evidence.

Both apps now support concurrent activity labels, with v1/v2→v3 migration backups and elapsed time counted once. An explicit preview can publish confirmed labels/times into an existing writable `Deep Focus — Actuals` calendar. Publication is immutable and uses local identifier receipts; use one publishing device pending cross-device reconciliation. It never publishes unknown time, desktop domains or place coordinates. Full setup: [multiple calendars](multi-calendar.md).

Remaining gates: live multi-Google-account access, permissions/revocation, recurring edits, provider latency, and seeing explicitly published output in Apple Calendar on both devices. Private activity/place records still move through file exchange; automatic device sync remains a separate milestone. The earlier simulator demo ran the companion successfully, but physical iPhone delivery and location behavior remain unverified.

## 1 Desktop foundation

**Built:** the sandboxed macOS menu-bar app, authenticated browser bridge, duration recorder, optional local timeline, daily view, explicit activity tags/corrections, local archive, and JSON evidence exchange. Continuous observations merge; pauses, suspended sampling, and clock jumps do not become invented work. The archive stores app names, domains, recent-input status, and provenance, not full URLs. Corrections preserve observations. Files with an incompatible/corrupt archive are preserved rather than overwritten.

**Validated without unlocking:** native compilation, deterministic time arithmetic, partial corrections, DST boundaries, privacy of archived fields, file round-trips, and existing bridge validation. Browser integration remains unproven until each real browser is paired and tested. Current resource measurements from the earlier live-only build do not establish the new build's runtime usage.

**Next:** resolve Safari development installation/pairing and complete the remaining Chrome/Edge profile, restart, disconnect, and latency matrix; verify actual idle/lock/sleep behavior and menu-bar layout. Validate input-idle availability within the sandbox; lack of input is only an observation and must not be presented as lack of thought. Broaden the short CPU/memory sample into sustained idle/active measurements and measure archive growth with real use.

**Unlocked continuation:** Chrome and Edge are installed and paired. A small launch/setup window resolves the pairing-code discoverability problem while preserving menu-bar operation. Real public URLs, cross-browser selection, desktop URL clearing, private-window exclusion, Chrome tab clearing, multiple Edge windows, local domain-only persistence, and Pause/Resume passed short live checks. A 67.654-second observed window contained 67.654 recorded seconds; a separate ~30-second paused check contained zero. Safari, full reliability/lock/sleep/idle checks, and extended use remain open. See `VALIDATION.md` for the precise matrix.

## 2 Proactive reconstruction

**Built:** detection of completed unobserved intervals and intervals without recent input (15-minute minimum), explicit confirm/correct/leave-unknown actions, quiet periods, and opt-in macOS local notifications. Notifications contain no activity details. Reminders are capped at two per local calendar day, at least two hours apart; no reminder while paused/suspended, quiet, or history is disabled. Review candidates are available in the timeline even if OS notification permission is absent.

**November 7 increment:** explicit local calendar snapshot import now preserves source/calendar/event/occurrence identity, provider updates, cancellation tombstones, timezone and all-day semantics. Timed overlapping intentions appear during gap review, without creating confirmations or durations. Malformed and ambiguous timestamps fail with row-level diagnostics. Remote API connection and actual notification delivery remain unverified.

## 3 Minimal mobile companion

**Built:** separate `DeepFocusCompanion` iOS 17+ target sharing the ledger and evidence model, manual activity tags, quiet periods, optional Core Location visit collection, coarse area storage, offline local persistence, and user-mediated JSON export/import. The permission flow starts only from a button. The collector requests When In Use first and Always on a subsequent explicit action. No camera, EEG, or continuous GPS tracking is enabled.

**Validated without unlocking:** simulator-destination compilation and shared data-model tests. Subsequent simulator launch and November 8 physical iPhone installation/startup passed; location collection and permission behavior remain unverified. Manual files move confirmations/place evidence between devices without merging raw desktop intervals or adding parallel machine time to human time.

**November 8:** development signing, installation and launch succeeded on the operator’s iPhone 13 Pro Max (iOS 27.2); a running process was verified.

**Next:** verify denied/revoked/reduced-accuracy permissions, delayed/partial visit events, locked-phone background delivery, offline relaunch, battery behavior, and file import. Evaluate whether Shortcuts is sufficient before adding more phone UI. Automatic sync is a separate milestone: device authentication, explicit sharing choices, retries/deduplication, and conflict handling must be designed before exposing a service outside the Mac. The existing loopback bridge is not a phone sync endpoint.

## 4 Research additions

**Built:** provenance-bearing context-evidence and file-exchange types that can represent calendar intentions, phone visits, agent-task intervals, camera observations, and EEG observations. Tests show inserting any of these does not create human time or a confirmed activity. No physiological collector, classifier, or remote inference call has been added.

**November 7 implementation:** local JSON import and a standard-library event writer now accept agent start/finish/review/acceptance events carrying a task ID, device/source ID, timestamp, and result reference. Runtime belongs to a machine-execution axis; a person's planning and approval remain independently observed/confirmed. Compare accepted output, rework, elapsed task time, and human effort before selecting an aggregate metric. Typed v2 evidence preserves event identity through file exchange. Exact repeats are idempotent, conflicting imports are rejected atomically, and incomplete/ambiguous runs show unavailable runtime. Platform-specific Codex/Claude hooks remain deferred.

**Research gate:** compare each optional signal against a baseline using task type, time of day, and a brief self-reported energy/effort rating. Camera work starts with observable presence/head/gaze features processed locally; mental-state labels remain hypotheses. EEG requires a validated acquisition setup and artifact handling. No research hardware purchase or sensor collection is required to deliver the first three directions.

**November 7 implementation — physical validation pending:** the separate optional [Quiet Desktop Experiment](../QuietDesktop/README.md) target implements the [quiet desktop session prototype](experiments/quiet-desktop-session.md). Five working days of personal use have not begun. It has explicit present/away/uncertain/stopped states, uncertainty exclusion, generation-protected Stop, neutral position-change language, confidence/geometry calibration, snooze and a persisted rolling maximum of two prompts per hour. The separate older PosturePilot app was not modified. Physical camera release and detection behavior are still gates. This is separate from the gap-reminder policy and remains optional.

**Trial gate:** record setup time, discomfort, useful versus mistimed prompts, and voluntary reuse. Suggested continuation criteria are zero away prompts, at least 80% useful prompts, and wanting to continue after day five. These are product criteria, not demonstrated health outcomes; zero/unrated prompts cannot establish usefulness. Trial has not started. Direct Upright integration remains deferred until authorized data access is demonstrated with a real sample.


## November 7 parallel implementation checkpoint

- Dia/Arc bundle identities and explicit Chromium installation selection are implemented and behavior-tested. No Dia/Arc live installation or Arc split-view verification has occurred in this increment. Existing Chrome/Edge extensions require Reload → select browser → Pair after updating.
- Typed suspension reasons compose lock/sleep/display/session notifications and ignore duplicate transitions. Physical OS checks remain pending.
- iPhone visit policy rejects stopped/revoked callbacks, preserves coarse areas and unknown times, and safely completes arrival records through local/file exchange. Physical permission/background delivery remains pending.
- Native archive/export schema v2 reads v1, preserves original local bytes before migration, and protects incompatible/corrupt records. Both devices must be updated before v2 exchange.
- Implementation used three subagents with Pocock spec/ticket slicing, behavior-first tests, and separate standards/spec review. See [delivery spec and tickets](../plans/pocock/parallel-native/spec.md).

## Defaults and limits

- Local desktop history and OS reminders start off. Manual Save activity and evidence import/export are explicit actions.
- Quiet periods suppress gap prompts; they do not silently disable optional capture. Stop place visits or pause desktop monitoring separately when desired.
- The recorder counts foreground observations, not proven productive attention. No-input intervals can be confirmed as reading, thought, or another activity.
- Local records have no automatic retention deletion. They remain in the app sandbox; automatic cloud backup/sync is not implemented. Export currently moves confirmations/context, not raw desktop observations.
- The frozen charter has a read-only mode, checksum, automated test, and per-project agent instructions. This protects against accidental drift; no remote backup or tamper-proof storage has been created.
- Remaining integration gates are recorded in `VALIDATION.md`. Do not label a direction complete solely because it compiles.
