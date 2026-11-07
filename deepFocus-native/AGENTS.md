# Deep Focus project instructions

- Read `docs/product-direction/2026-11-06-v1.md` before planning or changing this project. It is the operator-approved product charter.
- The charter is frozen. Do not edit it or change its checksum. Direction changes require explicit operator approval and a new dated amendment/version; preserve the approved original.
- The operator-requested camera experiment is specified in `docs/product-direction/2026-11-06-quiet-desktop-session-amendment.md` and `docs/experiments/quiet-desktop-session.md`. Preserve the four explicit states, confidence/geometry gates, stop semantics, prompt cap, and five-day acceptance criteria. Do not claim a camera trial, health benefit, or Upright data integration has been demonstrated from these specifications.
- Run `python3 scripts/verify_direction.py` with normal project validation. Keep roadmap/status changes in `docs/ROADMAP.md` and validation results in `VALIDATION.md`.
- Do not claim browser, OS, or device integration is verified from compilation or simulated tests. Earlier checks were blocked by a locked Mac; consult `VALIDATION.md` for current live-test evidence and remaining gates. Physical iOS permission/background behavior also requires a device.
- Respect existing work in the adjacent Electron app. Keep human time, agent runtime, and evidence provenance distinct. Location, application presence, and camera/EEG signals do not establish a person's purpose or cognitive state.
