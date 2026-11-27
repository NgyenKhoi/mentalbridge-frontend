# MB-642 — Journal writing action UX

## Scope and authority

USER journey: existing SupportPlan Today panel → existing Journal create editor →
owner save → exact originating activity → explicit completion check.
Do not redesign the whole Journal page or SupportPlan workspace (MB-644).
No second editor, automatic analysis, sharing grant, adherence or recovery claim.

Care owns the action intent/schedule and accepted minimized entry reference.
Journal owns private content and the immutable server creation fact. A successful
Journal save is NOT yet an accepted Care completion. Revisions of old entries and
changing the user-selected Journal date do not create a new writing completion.
Care accepts only the exact eligible owner entry, schedule-local creation day,
activation boundary and one-fact/one-occurrence constraint. Missing/deleted source
does not erase an already accepted historical completion.

Prototype data must be synthetic, without credentials or real user writing.
Prototype success is a modeled response, not evidence of backend/runtime success.

## Baseline and edit boundary

Baseline capture was produced from the standalone MB-641 UI using
isolated synthetic providers; contracts/BFF changes have not changed that UI.
Required frames: SupportPlan Today, Journal page and its canonical create dialog
at 1440×900, 1280×800, 375×812; 768px/640×400 responsive regressions.
Record build ID, assets, capture report and owning source parity before editing.

Locked: AuthenticatedShell brand/sidebar/navigation (including Community and
Achievements), top search/notification/account bar, mobile menu, route context;
SupportPlan heading and four tabs Today/Plan/Progress/Adjust; Journal hero/history
and editor layout/controls. No replacement chrome or extra page header.

Editable: one JOURNAL activity row in NativeSupportPlanJourney's Today panel;
bounded origin/privacy/return feedback in the existing Journal screen/editor;
post-save status and explicit check result in the exact originating activity.
Conditional existing dialogs remain in their current ownership/placement.

Owners:

- features/support-plan/components/NativeSupportPlanJourney.tsx
- features/support-plan/components/SupportPlanEntry.tsx
- app/(dashboard)/journal/page.tsx (canonical inline editor)
- mobile/src/support-plan/SupportPlanActionWorkspace.tsx
- mobile/src/journal/{JournalRoute,JournalScreen,JournalEditor}.tsx

## Screen and transition map for Stitch Instant Prototype

Generate individually named full-frame screens, not a storyboard screenshot.

| Screen                           | Primary action     | Transition and preserved state                                    |
| -------------------------------- | ------------------ | ----------------------------------------------------------------- |
| 01 Today — writing scheduled     | Viết nhật ký       | Open canonical new editor with validated activity context         |
| 02 Journal — write               | Lưu nhật ký        | Mood/text/date/tags remain owned by Journal; no auto-AI           |
| 03 Journal — save error          | Thử lưu lại        | Preserve all inputs; same logical attempt; do not return as saved |
| 04 Journal — saved               | Quay lại hoạt động | Carry only returned entry ID + typed origin; no private text      |
| 05 Today — returned, not checked | Kiểm tra ghi nhận  | Explicit command only; no completion on navigation/render         |
| 06 Today — accepted              | Xem nhật ký        | Show accepted outcome; no treatment claim; retain exact reference |
| 07 Today — check unavailable     | Thử kiểm tra lại   | Preserve candidate and activity; no false success/absence         |
| 08 Journal — leave with draft    | Tiếp tục viết      | Stay preserves fields; discard requires explicit confirmation     |

Native Instant Prototype connections: 01→02; 02→04 (success), 02→03 (failure),
03→02/04 (retry); 04→05; 05→06 or 07; 07→05/06 (retry); 02→08; 08→02 (stay),
08→01 (explicit discard); 06→Journal view and back. Use honest simulated outcomes.

Additional local interaction states: loading/invalid context, pending save/check,
cross-day or future activity explanation, inactive/stale source, deleted/missing
source before acceptance, deletion after acceptance, history revision unchanged,
ordinary Journal without origin. Never guess that the latest entry satisfies an
activity. Resolve context against fresh owned plan/occurrence authority.

## Presentation and interaction rules

- Current teal/sage semantic tokens; Fraunces headings and Be Vietnam Pro body
  with loaded Vietnamese glyphs. Existing icons only, no icon-font dependency.
- One primary action per decision; short Vietnamese, readable 60–75ch content.
- Origin strip: activity title/day plus “Nội dung nhật ký vẫn riêng tư. Kế hoạch
  chỉ ghi nhận việc bạn đã lưu bài.” No duplicate warning blocks.
- Journal save error remains beside form; successful save creates a separate
  return decision rather than navigating away without user control.
- Return focuses the exact activity heading; check pending disables only that
  command; error preserves context and a retry; authoritative success updates row.
- Draft guard applies to return, close, browser/back and other navigation. A query
  change must not remount/reset a dirty editor. Saving one action cannot reset
  drafts in another action or schedule editor.
- Targets ≥44px, visible focus, keyboard radios/editor/dialogs; Escape/stay/discard
  restores focus; live status for save/check. No motion-dependent feedback.
- Motion: current fast/base opacity and small translate; interruptible, no loop,
  confetti or bounce. Reduced motion shows final state immediately.
- Long copy, mobile drawer and 200% equivalent must not overflow or hide controls.

## Evidence gates and tooling honesty

User explicitly requires Stitch's native **Generate → Instant Prototype** from
selected screens, then play/review the connected UX. The current MCP exposes
screens/edit/design systems but no native prototype/connection command. Local
Chrome debugging ports 9222/9223 are unavailable; no authenticated browser control
has been established. Do not access cookie/profile files or invent private APIs.

Prepare the screen set, then ask the user to generate the native prototype if
that capability remains inaccessible. Save its real link/ID only when received.
A separate shell-integrated local stateful prototype verifies inputs, save
retry/draft guard, candidate/accepted state, focus, reduced motion and errors; it
does not substitute for the requested native Stitch prototype without approval.

## Baseline verification — 2026-10-14

Current real-route capture: `baseline/README.md`, `baseline/report.json` and
`baseline/{support-plan,journal,journal-create}-{desktop,laptop,mobile,tablet}.viewport.png`.
12 frames captured with source-owned chrome, four existing native plan tabs,
canonical Journal modal and current loaded brand fonts. Main inspected desktop
plan, desktop/mobile Journal editor against AuthenticatedShell and current source.
Build ID `ho8DH5hX7WZabEAeCkmbt`, source `ff163e060a11c1ae6d77ab3bb23a55cc6f8cb362`.
Only synthetic Identity/Care/browser fixtures on 3311/3312/3112; processes stopped.
Zero horizontal overflow, page errors, external browser calls or asset failures.
Not proof of authentication/shared dev/provider/new BFF functionality.

Visible pre-existing 375px issues: textarea autofocus scrolls the modal body past
mood/date; floating safety widget overlaps the footer's right edge. Prototype must
keep header/context/mood reachable and primary footer action/focus unobscured.
This does not authorize redesigning global chrome; use existing modal ownership.

Current gate status: baseline CAPTURED/INSPECTED; initial ten Stitch screens
GENERATED/RETRIEVED/RENDERED but REJECTED; desktop correction TIMEOUT300s,
other three correction/recovery requests have no captured results and may still
finish remotely. Do not resend them without checking Stitch first.
Known source01/05 IDs checked after timeout: HTML/screenshot URLs unchanged.
Native Instant Prototype CREATED_BY_USER (node678423c41ebc47d49538c0d6b85ebe38,
verified node exists via MCP). Fresh unauthenticated Chrome shows404 “This page
doesn't exist or isn't shared with you.” Export flattens only the initial Today
frame, not connected runtime. Native play NOT_VERIFIED, not a prototype failure.
Corrected desktop fiveframes retrieved and rendered1440/1280: gate still FAIL
(D01overflow1280, changedlockedchrome, fabricatedautosave/copy/editorstate).
See corrected-desktop-review.md and native-prototype-qa/README.md. Supplemental
workspace-only artifact `local-prototype/index.html` completed QA: five viewport journeys
(1440/1280/375/768/640x400) and seven grouped state/focus/keyboard assertions PASS.
It clones captured source shell/editor and changes only bounded Journal content.
No external requests/page errors/storage; not nativeStitch/server persistence proof.
On 2026-10-14 the user explicitly approved the scope-preserving fallback:
native Stitch flow reference, unchanged shell/editor, implementation after local
UX QA. That local QA passed before production implementation. Native play
remains NOT_VERIFIED; the fallback does not turn rejected screens into approved
chrome or prove private native playback. Production/browser evidence is separate.

Publication contains curated reports and selected frames only. The complete
local prototype, render scripts and captured CSS/font dependencies remain in the
workspace; the source paths and historical commands above are not runnable from
this evidence-only Git checkout. Use the production Playwright journey for
reproducible implementation verification.
