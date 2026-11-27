# MB-641 — Emotion action → canonical check-in → exact return

## Scope and authority

USER reviews an explicitly admitted Emotion action, uses the existing daily
check-in, returns to that same plan activity and explicitly checks completion.
Care owns action admission, schedules and accepted activity history. Journal
owns the check-in and factual progress. Emotion content is never copied to Care,
and a saved emotion alone must not imply that a plan activity was completed.

New native proposal: `POST /api/v2/support-plans` accepts only an owned
`sourceSupportEvaluationId` with `Idempotency-Key`. Saved personalization
`preferredActivityModes: EMOTION_CHECK_IN` is the user's intent. The action's
purpose is `NOTICE_SELF_REPORTED_EMOTIONS`; existing Care admission and required
professional support remain authoritative. Activation is a separate explicit
command with strong If-Match and the existing command ledger. Existing v2 plans
are not converted or backfilled; any replacement needs the governed review.

Reconciliation: `POST /api/v2/support-plan-occurrences/{id}/emotion-check-in/reconcile`
has no request body, caller evidence or idempotency key. Response identifies the
same occurrence/action/local date, sourceState RECORDED/MISSING/DELETED and
persisted occurrenceState SCHEDULED/COMPLETED separately. A fresh verification
does not erase accepted history. A creation fact before activation, a different
frozen zone/day, a future activity or another action is not usable evidence.
503 means uncertainty, never absence or completion.

## Current route audit

- Web canonical Emotion experience is `DailyEmotionCheckIn` inside `/dashboard`;
  there is no standalone `/emotion-check-in` route. Keep the existing form and
  dashboard hierarchy; add only a contextual return strip beside the form.
- Web `SupportPlanJourney` currently has four tabs when a plan exists: Hôm nay,
  Kế hoạch, Tiến triển, Điều chỉnh. Empty plans have a conditional subset. The
  story must not hard-code a global four-tab invariant or invent a fifth tab.
- Web schedule still reads v1 resource occurrences; the new native read model
  and bounded reconciliation need explicit transport/render integration.
- RN canonical route is `/(user)/emotion`, mounted by `EmotionCheckInRoute` in
  the existing `Screen` safe-area/ScrollView reading column. `/(user)/support-plan`
  is the origin. No tab bar, new native app bar or dashboard sidebar is authorized.
- Daily check-in writes only today's local day. Historical or future activity
  entry must not pretend to backdate or create a future record; explain the
  limitation and leave history unchanged. Frozen timezone matching is checked
  by the owner, not inferred from a browser's display timezone.

## Baseline and boundaries

Current owning components: `components/AuthenticatedShell.tsx`,
`app/(dashboard)/dashboard-shell.css`, `SupportPlanJourney.tsx`,
`DailyEmotionCheckIn.tsx`; RN `Screen.tsx`, `SupportPlanScreen.tsx` and
`EmotionCheckInScreen.tsx`.

Existing production full frames under `.stitch/mb-640-polish/production-*.png`
match the current source-owned shell including the Community header/menu link.
The older baseline HTML lacks that link and is not accepted as the current shell.
New baseline captures are recorded below after execution. Older three-tab
`.stitch/mb-640/` frames are rejected.

Locked web chrome: logo, sidebar/menu geometry and items, global topbar/search,
Community entry, account/notification controls, route heading/context, existing
route tabs and their responsive overflow, safety widget, page scroll ownership.
Editable content: one native Emotion activity region in existing plan panels;
contextual origin/return strip adjacent to the existing dashboard check-in;
factual Emotion coverage in existing progress panel. No standalone duplicate
check-in form. Conditional chrome stays feature-owned.

Locked RN chrome: existing safe-area, natural screen ScrollView, max-width560
reading column and source-owned title/action context. This prototype's mobile
web viewport is not evidence of native execution; Android remains NOT_RUN MB-666.

## State/interaction map

1. Review optional Emotion action and its admitted purpose/frequency → explicit
   activation. Unsaved schedule or personalization must not be silently accepted.
2. Select an exact open Emotion activity → canonical check-in with origin IDs in
   an allowlisted URL (no free-form `returnTo`, token or content).
3. Check-in load/save errors keep inputs. Saving only confirms the check-in.
   Context strip says the plan has not yet been checked and offers one return CTA.
4. Return restores the originating day/activity, focuses its heading, and offers
   **Kiểm tra ghi nhận**. No completion mutation on route mount or local save.
5. Explicit check is pending only for that activity. RECORDED + COMPLETED shows
   accepted completion. MISSING or DELETED + SCHEDULED explains absence without a
   success badge. DELETED + COMPLETED preserves accepted history with a separate
   source-availability note. Unavailable keeps history and offers **Thử lại**.
6. Repeat check and page reload retain the persisted version/completion time;
   no double event or second completion. Wrong/removed origin and changed plan
   explain recovery to the current plan, never update a nearby activity.
7. Progress is owner factual checked-in days/rolling coverage, no global score,
   diagnosis, improvement claim or adaptation. Raw Emotion stays on its owner UI.

Keyboard: real links/buttons, visible focus, disclosure native behavior, logical
tab order, at least44px primary targets and live status. Motion: token fast/base
opacity/transform only after true state changes; reduced motion keeps copy/icon
feedback without movement. No animation gate delays saves or navigation.

## Stitch / prototype gates

Established project: `1256373820415012052` — MB-637 Support Plan v3 UX Prototype.
Design system: Therapeutic Sanctuary. Existing maintained full-frame polish
screen `db240ef8222d486281059242719705e7` is still retrievable even though omitted
from list_screens. Its generated chrome remains reference-only; inspect against
the current real-route captures before acceptance.

Fresh baseline: `baseline/{support-plan,dashboard}-{desktop,laptop,mobile}.png/html`,
captured from current standalone source at1440×900,1280×800,375×812 using isolated
Identity/Care fixtures on3211/3212 and Next on3111. `baseline/report.json` records
six frames, no page errors or horizontal overflow. Helpers stopped afterwards.
This is synthetic fixture runtime, not authenticated shared-dev evidence.

`support-plan-prototype.html` and `dashboard-prototype.html` retain this exact
captured shellDOM/CSS/fonts and modify only the named content regions.
`node .stitch/mb-641/prototype-qa.mjs`: **10/10 grouped assertions passed** after
correcting the QA click to target the visible semantic radio label instead of
its visually hidden input. No production controls were changed. Evidence in
`qa/report.json` and captures. Five viewport geometry/font/44px/overflow checks,
canonical form+origin+focus, explicit check, true pending, retry/time/version,
missing/deleted/accepted history, outages, wrongzone/preactivation, savedraft,
deletionEscape/focus, explicitactivation and keyboardtabs verified. No external
or business API calls/page errors.640×400 is zoom-equivalent, not manual zoom.

Stitch source screens were edited, retrieved and actualbrowserrendered:

- Initial `06634be4e9a54944a1e3c223c35ea587` desktop and
  `0b27f66251984968a0201b149fdb5d0a` mobile: rejected for changed brand/safety
  chrome, invented progress/rhythm context and unrelated lifecycle content.
- First correction `b8f9156b6f3e49b193357c750b76604f` desktop and
  `76b171a8c1c24538b62647592eb2b488` mobile: **still rejected**. Brand lost teal
  tile, safety became a generic heart, and right existing management panel was
  replaced by invented screening rhythm. DesktopHTML throws null.addEventListener;
  actualmobilefontcheck returns zero loaded BeVietnamPro/Fraunces faces. PNG and
  HTML are preserved as returned. `reference-qa/report.json` is evidence of these
  failures, not a pass based on screenshot or tool prose.
- Final one-shot correction `30da7195f4834d9b9f62bd43df12ac4b` desktop and
  `8307652dfe2447038b369960b8e3834e` mobile was retrieved and browser-rendered.
  Brand tile, four-path handholdingheartSVG, and lower management copy/controls
  are restored; both actual font loads return3 loaded faces per family, with no
  page errors or horizontal overflow. Raw returnedHTML is preserved unchanged.
  Final prompt is recorded in `final-stitch-prompt.md`.
- **Full-frame gate still failed after the final repair.** The original white
  Today workspace boundary has disappeared into the sage canvas; desktop tabs
  have changed width/placement (selected tab approximately281px versus119px in
  the actual captured source); right context columns and source sidebar group
  spacing/icon system remain altered. Mobile tabs/title/day arrangement and
  padding also differ from the source frame. Generated unrelated resource copy
  and advisory text must not become product content. These changes are outside
  the declared editable Emotion region. Do not treat restored three controls
  or a successful font check as permission to redesign the surrounding page.
  No more automatic Stitch edits are started in this slice.

Native source references: `native-baseline.tsx` bundles the **actual existing**
`EmotionCheckInScreen`, `SupportPlanScreen` and `Screen` via ReactNativeWeb, with
only session/router/crypto/readAPI fixture substitutes.375×812 captures in
`reference-qa/native-baseline-{emotion,support-plan}.png`; no page errors or
horizontal overflow. InstalledRNsource uses systemfont, so zero webfontfaces is
expected here. This is a source-layout reference, **not native execution**.
The generated `native-baseline.js` bundle is a local artifact, not production or
commit material. Android/iOS runtime remains **NOT_RUN — MB-666**.

Gate status: local interactive prototype passed; finalStitchfullframe acceptance
**failed**. Per the repository Stitch skill, pause new visual-direction
implementation. No production UI implementation is authorized by this document
alone. Source-owned transport/backend work may continue independently.

## Explicit user fallback approval

After the failed final Stitch frame was reported, the user explicitly chose
**“Dùng prototype đã kiểm tra, giữ nguyên shell”**. This permits translating the
verified interaction direction into existing source-owned shells without
adopting the incorrect generated chrome. No further Stitch generation is needed.
Web keeps AuthenticatedShell, current route heading/tabs and canonical dashboard
form. Native keeps the actual `Screen` safe-area/reading column, existing route
titles, system typography/tokens and canonical EmotionCheckInScreen. Native
source-layout references above were inspected before this implementation; only
the contextual action/return/recovery regions are added. The browser prototype
remains interaction evidence, not native execution. Android/iOS NOT_RUN MB-666.
