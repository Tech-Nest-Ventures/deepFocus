# Parallel native Deep Focus increments

## Problem Statement
The native monitor works in short Chrome/Edge checks, but other browsers, lifecycle reliability, and optional evidence collectors need independently verifiable increments.

## Solution
Deliver complete slices across browsers, desktop reliability, calendar intentions, mobile visits, agent events, and a separate optional camera experiment. Keep human observations, intentions, confirmations, and machine execution distinct.

## User Stories
1. I can pair Dia or Arc and see only the foreground public tab.
2. I can pause, lock, or sleep without invented durations or stale URLs.
3. I can import calendar intentions and use them to review gaps without automatically confirming work.
4. I can stop optional phone visits and exchange coarse context without inventing unknown visit duration.
5. I can import agent lifecycle events and see machine runtime separately from human time.
6. I can explicitly start and stop a local camera experiment and evaluate prompts across five actual working days.

## Implementation Decisions
Use the existing MonitorCore behavior boundaries and Apple frameworks. Chromium installation identity is explicit, Safari identity fixed. Shared archives/exchanges advance to v2 with optional typed provenance, v1 read compatibility, a preserved original before migration, and refusal to overwrite unsupported/corrupt records. Calendar snapshots and agent event files are explicit local imports; no API writes or background connector. Camera has a separate target/container and no automatic startup, following the approved experiment's four states, calibration gates, Stop semantics, snooze and prompt cap.

## Testing Decisions
Use Pocock TDD for consequential behavior: one failing observable-behavior test then implementation. Retain existing tests and test migrations, duplicate/stale events, duration accounting, permission/callback races and prompt suppression. Compilation and simulation are not physical validation. Record unit/build/live/manual-gate status separately. Review standards and spec compliance independently before closeout.

## Out of Scope
App Store submission, automatic cloud sync, platform-specific agent hooks, EEG, Upright access, changes to PosturePilot, and a claim that the five-day personal trial has occurred.

## Further Notes
Frozen charter and camera amendment remain authoritative. ROADMAP and VALIDATION are the delivery-status records. Three workers plus one integrator; OS/device/browser checks serialize. Preserve existing Electron modifications.
