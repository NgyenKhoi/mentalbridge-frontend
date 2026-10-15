# MB-642 Stitch / prototype review

## Initial reference batch — NOT ACCEPTED

Five journey states per viewport were generated, retrieved as raw HTML/PNG, then
actually rendered at 1440×900 and 375×812. IDs are in stitch-manifest.json.
The main agent inspected screenshots against the current real-route baseline.

`node .stitch/mb-642/render-stitch.mjs` completed ten browser renders:

- Loaded Fraunces and Be Vietnam Pro: three faces each in every frame.
- No horizontal overflow or page errors.
- No private owner contract language in visible product copy.
- These are RENDER checks only, not interaction, native prototype or UX acceptance.

The render script and captured runtime dependencies remain workspace-local;
this published directory contains the reviewed references and selected evidence.

Rejected findings:

1. White Today work surface was removed and tab geometry changed; current source
   composition is not retained despite the prompt.
2. Mobile Journal editor/error overlays still have SupportPlan behind them, not
   the canonical Journal route. Source topbar/context was replaced by tiny search.
3. “Lượt lưu bài gần nhất” is wrong: reconciliation is for the exact selected
   owner entry ID. Never select latest entry as evidence.
4. Save error output invents “draft safely stored on device”; current draft is
   session memory, not persistent offline storage. It also redesigns form fields.
5. 14/10/2026 incorrectly says Tuesday; fixture is Wednesday. Some error frames
   revert to 13/10. Rhythm says no scheduled activities while rows have two.
6. Floating widget still overlaps mobile Save. Proper modal focus/stacking must
   keep controls unobscured; do not delete global support capability.
7. Invented breathing row/nervous-system claim is not part of the actual fixture;
   restore existing Emotion row and unchanged support context.

The heuristic mojibake flag on D03/M03 needs contextual inspection: uppercase
Vietnamese “ĐÃ” contains a valid Ã, so a regex hit alone is NOT an encoding bug.
No user content is to be auto-decoded based on that heuristic.

## Correction and recovery batch

One explicit correction submitted for the ten selected screens, preserving state
names and correcting all findings above. Three additional journey states per
viewport requested: accepted, check unavailable, leave-with-draft confirmation.
Correction desktop call timed out after300s on2026-10-14:
`tool call failed for stitch/edit_screens; timed out awaiting tools/call after300s`.
At the timeout no corrected result was retrieved. Other simultaneously submitted requests did
not yield captured results before the orchestration ended; they may still finish
on Stitch. Do NOT resend any of the four jobs merely because output is absent.
The desktop results were subsequently retrieved and reviewed in
corrected-desktop-review.md. Their visual gate still failed; do not resend jobs
or present those results as approved chrome.

## Native Instant Prototype — created by user; play not verified

User supplied the native link with node678423c41ebc47d49538c0d6b85ebe38.
get_screen/get_project confirm **MentalBridge Support Plan & Journal Flow**.
Retrieved HTML at native-instant-prototype.html appears to export only the first
Today frame; it does not prove connected native behavior, or disprove the user's
prototype creation. Fresh unauthenticated browser access returned a private/404
page; native play could not be verified. See native-prototype-qa/README.md.

Current tools expose screen generation/editing, not native prototype creation or
connections. No Chrome debugging session is available. User was asked to run
Generate → Instant Prototype on the final MB-642 screen set and provide the play
link when available. An earlier catalogue fetch temporarily omitted new frames;
a later fetch showed the frames and supplied native prototype node. That
catalogue history does not verify connections or native playback.

Required click-through review: write → save error (fields unchanged) → retry →
saved → exact return (not completed) → explicit check pending → accepted; check
failure retry; leave-with-draft stay/Escape/discard; source deletion/history;
keyboard/focus, mobile and reduced motion. Preserve other unsaved action drafts.

The user explicitly approved the scope-preserving fallback on 2026-10-14:
native Stitch flow reference, unchanged source shell/editor, and implementation
after supplemental local UX QA. That QA passed five viewports and seven grouped
transition cases. The native prototype remains PLAY_NOT_VERIFIED. Production
web/browser evidence is separate from both static references and local fixtures.
