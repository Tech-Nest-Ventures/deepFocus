# Quiet desktop session experiment amendment

Requested by Timeo Williams on November 6, 2026 as an addition to the product specifications. This amendment supplements research direction 4 in [the frozen product direction v1](2026-11-06-v1.md). It does not replace that charter or change the priority of verifying the desktop duration and timeline foundation.

## Approved experiment

Build one small, optional **quiet desktop session** prototype, then evaluate it during **five working days of personal use**. Camera observations remain separate from foreground-app durations, human attention, and confirmed activities. Camera use is opt-in and is not a dependency of the core desktop app.

- Expose explicit **present**, **away**, **uncertain**, and **stopped** states. Exclude uncertain frames from scoring; away and stopped states must not produce deviation prompts.
- Fix the stop-button bug before the personal trial. Stop must release the camera, cancel pending prompts and analysis, and prevent delayed callbacks from restarting collection.
- Remove the misleading forward-head claim. Use only descriptions supported by the observed signal; do not substitute an unvalidated health, ergonomic-accuracy, or concentration claim.
- Use brief, confidence-checked calibration. Reuse a calibration only after checking that camera geometry still matches; invalidate it when geometry changes or cannot be established confidently.
- Evaluate prompts for **sustained** deviations, with snooze and a maximum of **two prompts per hour**. A short movement is not sufficient to trigger a prompt.

## Five working day evaluation

Record setup time, camera discomfort, helpful versus mistimed prompts, and voluntary continued use. Preserve the actual prompt denominator and record unrated prompts; do not count missing feedback as useful.

The suggested continuation criteria are **zero away prompts**, **at least 80% useful prompts**, and **a desire to keep using the prototype after day five**. These are product acceptance criteria, not demonstrated health outcomes. An uneventful trial with no prompts does not demonstrate prompt usefulness.

## Upright integration gate

A desktop companion may eventually add work-session context to Upright. Direct integration is conditional on proving an authorized data-access path first: supported access or explicit user export, usable fields and timestamps, and a real sample that can be read with permission. An assumed API, a generic Bluetooth connection, or a marketing claim does not pass this gate. Keep the standalone experiment useful without an Upright connection.

The implementation and trial procedure live in [the experiment specification](../experiments/quiet-desktop-session.md). Delivery status belongs in `docs/ROADMAP.md`; no trial results or integration success are asserted by this amendment.
