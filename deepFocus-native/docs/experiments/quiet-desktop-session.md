# Quiet desktop session prototype and personal trial

Status: specified, not implemented or trialed. Authority: [November 6, 2026 amendment](../product-direction/2026-11-06-quiet-desktop-session-amendment.md). Build one small desktop prototype and run it for five working days before deciding whether camera prompts deserve further investment. Existing Deep Focus tracking continues independently.

## Prototype boundaries

Process frames locally and keep them transient. Do not save or upload camera frames, landmarks, or identifying imagery for this trial. Keep only the explicit trial log, state transitions, calibration validity, and prompt feedback needed to evaluate the product. Start and stop camera use explicitly; never start it on app launch, unlock, return from away, or permission restoration. No camera/EEG collector or Upright connection is implied by the existing generic context-evidence type.

The prior PosturePilot implementation is a reference, not a verified native component. Its packaged entry point uses `PosturePilot/src/app.js`; its README currently advertises forward-head detection and high accuracy. Audit the stop path and all user-visible metric labels when making that prototype change. A spec entry does not mean either defect has been repaired.

## State and stop contract

| State | Meaning | Score and prompt behavior |
|---|---|---|
| Present | A person is confidently observable with sufficient usable landmarks | Eligible only after valid calibration; the observation does not establish attention or intent |
| Away | Evidence supports absence from the camera view | No scoring or prompts; clear pending deviation duration |
| Uncertain | Occlusion, poor lighting, dropped/stale frames, ambiguous presence, or insufficient landmark confidence | Exclude from score numerator and denominator; no prompts; reset pending deviation duration |
| Stopped | User stopped the session, permission was lost, or capture ended | No capture, inference, scoring, or prompts; explicit Start required |

Missing landmarks alone must not be labeled away. Calibration validity is a separate flag, not a fifth presence state. A present person with invalid calibration receives setup guidance, not a deviation prompt. Display unavailable/insufficient evidence instead of a perfect score when there are no eligible frames.

Stop must work from present, away, uncertain, calibration, and snooze states. Cancel timers, queued notifications, inference callbacks, and media tracks. Invalidate the session generation so an in-flight camera start or frame result cannot restore monitoring after Stop. Repeated Stop is safe. Returning to the window or pressing visibility/resume controls must not implicitly restart a stopped session.

## Calibration and prompt behavior

- Keep calibration brief, but accept only stable, high-confidence samples. Explain inadequate lighting or visibility without silently accepting a bad baseline. Record actual setup time, retries, and time to usable calibration.
- Associate the baseline with the camera identity, image dimensions/orientation/mirroring, and measured framing/scale. Reuse requires a fresh confidence-checked geometry comparison. Device, camera angle, distance, or framing changes invalidate reuse; uncertainty also requires recalibration. No raw reference image needs to be retained.
- Define detector-specific confidence and geometry tolerances before the trial, document them with the build, and hold them fixed across the five days. They are engineering settings, not validated clinical thresholds.
- Prompt only after a continuous, eligible sustained deviation from the personal baseline. Reset the accumulation on normal movement, away, uncertain, stopped, invalid calibration, snooze, or quiet periods; never catch up with a prompt on return.
- Initial experiment defaults: 30 seconds of continuous eligible deviation, a 15-minute Snooze action, and at most two delivered prompts in any rolling 60-minute window. These timing defaults are provisional usability settings. Preserve the rate-limit history across restarts so restarting cannot bypass the cap.
- Recheck state and calibration at delivery time, not only when scheduling. Snooze and Stop cancel queued prompts. The camera cap is separate from Deep Focus's existing gap-reminder cap of two per day; both honor quiet periods.
- Use neutral language such as “Your position has differed from your baseline for a while. Adjust if helpful.” Do not label the detected change forward-head posture, tech neck, unhealthy, distracted, or evidence of reduced concentration.

## Before day one

Pass the stop-state matrix, delayed-callback race, camera-release check, and absence/uncertainty suppression tests. Test failed calibration, geometry changes, transient versus sustained movement, snooze, rolling-hour boundary, restart, and prompt cancellation. Use synthetic inputs for deterministic policy tests and explicit human consent for physical camera tests. Confirm camera resources actually release on Stop on the target Mac; a simulated test is not sufficient.

Remove the misleading claim from the prototype UI, README, onboarding, and prompt text. Do not begin the personal trial with known away prompts or a broken Stop control. Do not disable global camera/security protections to obtain a passing result.

## Five working days

Start day one only after the prototype is usable and the pre-trial checks pass. Five working days means five actual use days, not automatically five calendar dates. Use normal work sessions; do not manufacture deviations to create a positive result. Record a brief review at the end of each day, with a final continuation choice after day five. No scheduled reminders are created by this spec.

For each session record build/configuration, date, setup/calibration seconds and retries, camera discomfort (0 = none through 4 = unacceptable, plus optional note), approximate session length, and whether use was voluntarily started/continued. For each delivered prompt record time, displayed state, calibration validity, useful/mistimed/not useful/unrated feedback, actual presence or absence if known, and any snooze/stop action. Do not infer actual presence solely from the detector's own label.

| Working day | Date | Setup seconds / retries | Discomfort 0–4 | Prompts delivered | Useful / mistimed / not useful / unrated | Away prompts / presence unknown | Voluntarily used again? |
|---|---|---|---|---|---|---|---|
| 1 | Not started | — | — | — | — | — | — |
| 2 | Not started | — | — | — | — | — | — |
| 3 | Not started | — | — | — | — | — | — |
| 4 | Not started | — | — | — | — | — | — |
| 5 | Not started | — | — | — | — | — | — |

Usefulness = prompts explicitly marked useful divided by all delivered prompts. Mistimed, not useful, and unrated prompts do not count as useful. Report counts alongside percentages. An away prompt is one delivered while the person was actually away, even if the detector incorrectly said present. Unknown presence must be reported; it cannot establish zero away prompts.

Suggested continuation gate: zero away prompts, usefulness at least 80%, and an explicit desire to keep using it after day five. Report setup burden, discomfort, and voluntary reuse alongside this gate. If no prompts occurred, the usefulness criterion is untested; do not divide by zero or declare success. Any away prompt or stop failure requires repair before continuing the trial. These results assess this person's experience with this build; they establish neither clinical efficacy nor health outcomes.

## Upright data-access proof

Before planning a direct integration, identify the exact Upright product/version and a supported API or user-controlled export. With permission, obtain one real sample and document fields, time-zone/timestamp semantics, event granularity, latency, authentication, and applicable access constraints. Demonstrate that the sample can be mapped to provenance-bearing context without inventing durations or attention. If access cannot be demonstrated, keep the integration deferred and retain manual context entry as the optional alternative.
