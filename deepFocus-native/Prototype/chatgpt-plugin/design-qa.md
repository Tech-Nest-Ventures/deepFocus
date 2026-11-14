# Direction 2 sample-card visual QA

**final result: passed** — for the rendered web/MCP component design. Installed ChatGPT and physical iPhone host integration are separate, pending acceptance gates.

## Visual truth and evidence

- Source: `/Users/timwilliams/.codex/generated_images/01a1b159-af17-73f1-b804-ac53a92b747b/exec-f0f23b35-b26f-4dd5-b01b-fd8d4c723fce.png` (selected second displayed image, Day in Places).
- Browser-rendered implementation: `evidence/card-mobile.png`.
- Full-view comparison: `evidence/comparison.png`; source and final browser capture were opened together in this normalized composite, not compared from memory.
- Source pixels: 852 × 1846. Normalized to 390 × 845 for comparison.
- Implementation viewport: 390 × 844 CSS px, screenshot density 1; full scrollable content 390 × 978 px. Additional 320 × 740 viewport verified, content width 320 with no horizontal overflow.
- State: initial fictional November 14 sample, before any correction/calendar confirmation, light theme. The prototype intentionally adds editable controls, explicit fictional-data provenance, elapsed-time explanation, and reset. ChatGPT owns the real composer; a duplicate/fake composer is omitted. Full card height is therefore not expected to match the static phone concept.
- Focused regions: typography, map and calendar-review text are legible in the 804px-wide composite; no separate crops needed.

## Findings and comparison history

1. **P1 fixed:** the icon's SVG data URL initially included unescaped quotes in an HTML attribute. It leaked markup into visible copy. Escaped the library asset URL and reloaded; the final capture shows the correct calendar icon and no stray text.
2. **P2 fixed:** first normalized comparison showed excessive vertical spacing and oversized entry headings relative to the reference. Reduced header/entry spacing, headings from 20px to 18px, removed redundant evidence copy, and tightened the footer. Post-fix comparison shows the timeline and review region closely follow the selected design's rhythm; the main confirmation button remains in the initial 844px viewport.
3. **P2 fixed:** review wording originally asserted the workout ended before the visit even after arbitrary corrections. Replaced it with evidence-aware neutral copy. Review now also shows a changed activity title and the current simulated calendar value on subsequent edits, so confirmation reflects the actual proposal.

## Required fidelity surfaces

- **Fonts/typography:** Apple/system sans, strong 32px daily heading, 18px activity titles, smaller secondary time/place text. Intentional approximate system-font match, no downloaded font dependency. Text remains readable without truncation at 320px.
- **Spacing/layout:** blue timeline points, pale vertical rule, inset map, rounded light-gray review block, full-width blue CTA. Post-fix section proportions match the concept's hierarchy. The prototype uses normal scrolling; no controls are clipped by a fixed overlay.
- **Colors/tokens:** white surface, near-black headings, gray secondary copy, blue `#2861df` actions/markers, pale `#f4f6fa` review. No attention/productivity score colors.
- **Imagery:** generated fictional map matches the selected map's pale streets/green areas/blue pin. Bundled raster artwork, no map service or real coordinates. Calendar icon is bundled Phosphor artwork. No fake device chrome.
- **Copy/content:** explicitly fictional; seed entries say “sample confirmation,” not that the operator confirmed a real event. All simulated calendar actions are labeled. Unknown remains unknown. ChatGPT's own composer replaces the concept's app-owned input.

## Interaction verification

- Added Walking alongside Phone call and selected Outside; saved result displayed both activities, confirmed elapsed time stayed 145 minutes.
- Confirm sample update changed the in-memory original event to 17:20–18:15; success explicitly said the real calendar was untouched.
- Left workout unknown; the visit remained, elapsed time fell to 90 minutes, and calendar-confirm action disappeared. Captured in `evidence/unknown-state.png`.
- Started fresh sample; seed state restored with independent session.
- Checked browser warning/error logs: no component warnings/errors after icon fix.
- Checked touch targets, visible focus styling, native form labels, live status/error roles and narrow-width scrolling.

## Remaining acceptance checks

- The actual installed ChatGPT iframe handshake, UI-triggered tools, model-context updates, and conversational follow-ups must be tested after connection approval.
- Physical iPhone ChatGPT availability/rendering remains unverified. A responsive browser preview does not prove mobile host support.
- P3: optional dark-theme styling and a smaller compressed map bundle can follow after the mobile feasibility check.

Implementation checklist: visual fixes applied; final capture inspected; local core interactions passed; host/device gates explicitly retained.
