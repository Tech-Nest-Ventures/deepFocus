# Quiet Desktop Experiment

Optional, separate macOS 14+ sandboxed application. Build/run the `QuietDesktopExperiment` scheme. Camera access is requested only after **Start**. Deep Focus Native has no added camera entitlement and runs independently.

## Use

1. Open the experiment and explicitly press Start. Permission denial leaves it stopped.
2. Sit comfortably with face and both shoulders visible. Keep the camera setup unchanged and remain steady for at least five seconds. No preview or image is saved.
3. Check **Present / Away / Uncertain / Stopped** and calibration guidance. Retry after timeout. Stop always invalidates the session; the UI shows “Releasing camera…” until the capture queue has released its input.
4. A position-check panel can appear after 30 continuous eligible seconds away from baseline. Rate the prompt and report actual presence independently. Reporting an away prompt immediately stops capture and persists a block on Start for this configuration; repair and explicitly version the configuration before continuing. Snooze and Stop in the prompt also save the selected actual presence (leaving usefulness unrated); selecting Away blocks the configuration regardless of which action is used. Snooze suppresses for 15 minutes; Quiet suppresses all prompts. Stop, uncertainty and invalid calibration dismiss the panel.
5. Save a session review and export the local JSON trial log. Prompt reservations initially remain unrated; separate display/cancellation/feedback rows reference their IDs. Count `promptDisplayed` rows as delivered; reservations without a recorded outcome are unknown, never useful. All delivered prompts belong in the usefulness denominator. Unknown actual presence cannot establish zero away prompts.

Window close, sleep/display sleep, session inactivity, screen lock, capture interruption, permission loss and Quit stop monitoring. Reopening, wake and permission restoration never restart it. Start begins a fresh calibration. No baseline persists across restart or uncertainty; no old baseline is silently reused.

## Fixed engineering configuration (quiet-v1)

- AVCaptureVideoDataOutput, VGA requested, serial inference throttled to 3 frames/second with late frames discarded. No microphone, recording or network capability.
- Vision human body pose, upper-body rectangles and face rectangles. One body, at most one detected person/face, nose and both shoulders confidence >= 0.7; all three joints inside 3% frame margins; shoulder width >=15% frame width.
- Usable lighting heuristic: sampled BGRA mean 35...225 and intensity variance >=100. Low quality, detection errors, missing landmarks, multiple people, and frames stale over two seconds are uncertain.
- Away requires successful usable detections with no face/person above 0.2 confidence and no body pose for at least three continuous seconds. This is a heuristic, not proof of real absence. Patterned occlusion or missed detection remain physical test risks.
- Signal: nose displacement from shoulder midpoint, divided by shoulder width. Calibration requires >=15 samples over >=5 seconds, each component's median absolute deviation <=0.03 shoulder widths, with 30-second timeout.
- Geometry: camera identity, actual pixel dimensions, orientation and mirroring must match; shoulder scale change >20% or midpoint shift >10% frame dimensions invalidates. Capture is unmirrored when supported and Vision orientation is fixed `.up`; rotated/mounted camera configurations are unverified. Two-dimensional geometry cannot reliably distinguish camera movement from body movement. Restart and uncertainty always discard calibration.
- Deviation >0.20 shoulder widths for 30 continuous eligible seconds; return to baseline, uncertainty, away, invalid calibration, quiet and snooze reset the interval. No catch-up delivery.
- At most two delivered prompts in a rolling 60 minutes. The rate-limit log is saved atomically before showing a panel, then freshness is checked again. A stale reservation is explicitly cancelled and conservatively consumes a rate slot. A corrupt/unwritable log disables capture rather than resetting this history. No health, concentration or forward-head claim is made.

## Persistence and manual gates

The sandbox Application Support `QuietDesktopExperiment/trial.json` contains setup times, retries, state/calibration transitions, session duration, neutral prompt delivery times and feedback, discomfort 0–4, voluntary-use reviews, rate-limit timestamps and an away-prompt configuration block. It contains no images, landmarks, camera identifiers, app/browser activity or health scores. Export is explicit via Save dialog. No trial is automatically scheduled or evaluated.

Policy tests use synthetic observations; compilation does not verify camera permissions, hardware release, detector quality, floating panels, lock/sleep notifications or usability. Before day one, physically check Stop from authorization/present/away/uncertain/calibration/snooze, delayed start and inference races, camera indicator release, poor light/occlusion/multiple people, geometry changes, absence suppression, snooze/quiet, restart cap, and window close/lock/sleep/wake. Camera access has not been exercised by the implementation agents. Do not start a trial with a Stop failure or known away prompt.

Five actual working days remain a human trial: zero away prompts, >=80% useful of **all** delivered prompts, and a desire to continue after day five. No delivered prompts means usefulness is untested; unknown presence prevents proving zero away prompts. These are personal product acceptance criteria, not health outcomes. The older PosturePilot app and its claims were not changed by this separate prototype.
