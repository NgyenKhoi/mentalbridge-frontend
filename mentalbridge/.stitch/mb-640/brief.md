# MB-640 adjustable SupportPlan cadence — Stitch brief

- Jira: `MB-640`
- Stitch project: `MB-637 — Support Plan v3 UX Prototype`
- Project ID: `1256373820415012052`
- Design system: `Therapeutic Sanctuary`
- Design system asset: `assets/0ed4c54e96e648a38eb0f3499178c283`
- Route/actor: authenticated USER at `/support-plan`
- Primary job: review a safe proposed schedule before activation, then lower or
  move future workload without changing why an action belongs in the plan.

## Full-frame baseline

The MB-637 desktop artifact is stale because it uses the retired horizontal
application navigation. MB-638 is also not a shell baseline; its brief records
that only the Adjust panel was editable. MB-640 therefore captures the current
production route with controlled fixtures before generation.

- Desktop: `support-plan-baseline-desktop.png`, 1440 × 900, full page.
- Mobile: `support-plan-baseline-mobile.png`, 375 × 812, full page.
- Verification source: `components/AuthenticatedShell.tsx`,
  `features/support-plan/components/SupportPlanJourney.tsx`, and the controlled
  `MB-373` journey in `tests/e2e/support-plan.spec.ts`.

Locked chrome:

- `AuthenticatedShell`, including desktop sidebar and mobile header/navigation;
- SupportPlan workspace header and route context;
- the existing `Hôm nay`, `Kế hoạch`, `Tiến triển`, `Điều chỉnh` tabs and their
  responsive behavior;
- current content width, padding, scroll ownership, and global safety entry.

Editable content slots:

- DRAFT: schedule review block inside the `Kế hoạch` panel, immediately before
  the existing activation decision;
- ACTIVE: schedule/workload editor inside the `Điều chỉnh` panel, before plan
  lifecycle/replacement controls;
- mobile: the equivalent content inside the existing plan card; no new app bar,
  page header, tabs, bottom navigation, or floating navigation.

## Product authority

- Backend SupportPlan actions and schedules are authoritative. UI never changes
  admission, eligibility, safety routing, or action source ownership.
- A schedule can be absent. Review-only and non-schedulable actions remain
  unscheduled and must not be forced into recurrence.
- Supported cadence is once, daily, or weekly. Weekly cadence has one or more
  ISO weekdays. Every stored schedule has an IANA timezone, an exact resolved
  local time, a 5–180 minute duration in five-minute steps, an effective start,
  an optional end, and an optional preferred daypart.
- Proposed DRAFT defaults derive from the user's bounded preferences, are
  persisted, and must be reviewed before activation.
- ACTIVE edits affect future open occurrences only. Lowering workload, moving a
  day/time, or removing recurrence is neutral and never presented as failure.
- Saving uses a versioned, idempotent command. A stale response preserves local
  values and offers an explicit reload; it never silently overwrites newer data.
- Legacy v2 schedules remain readable. If a plan/action cannot be edited, show
  a calm read-only explanation rather than disabled unexplained controls.
- Ordinary copy hides IDs, revisions, schema/policy names, and transport terms.

## State and interaction map

1. Loading: stable schedule-summary skeleton without moving the tabs.
2. DRAFT proposal: concise per-action cards with cadence, days/daypart or exact
   time, duration, timezone, and a plain-language workload summary.
3. Dirty DRAFT: preserve edits and block activation until saved or discarded.
4. Save pending: disable only the affected schedule command; keep the summary
   and form values visible.
5. Save success: update from the authoritative response and announce in place.
6. ACTIVE edit: allow fewer days, a different day/time/timezone, shorter
   duration, or `Không lặp lại`; explain that only future activities move.
7. Stale `409/412`: retain local values, explain that the plan changed elsewhere,
   and offer `Tải lịch mới nhất` before retrying.
8. Generic failure: retain the last confirmed schedule and unsaved form values;
   offer local retry without claiming the plan changed.
9. Empty actions: calm empty state; no activation promise unsupported by data.
10. Review-only/unschedulable: readable rationale, no recurrence controls.
11. Paused plan: schedules are readable; changing workload is unavailable until
    the existing resume flow completes.
12. Timezone/DST: summary names timezone and explains that local clock time is
    kept through daylight-saving changes where applicable.

Keyboard/touch requirements: semantic radio/checkbox/select/input controls,
logical DOM order, visible focus, 44px targets, no color-only selection, and
status announcements through a polite live region. Desktop must work at
1280/1440 and 200% zoom; mobile must not overflow from 320–430px.

## Motion contract

- Editor expansion/collapse: restrained 160–220ms opacity/height transition.
- Choice feedback: 120–160ms border/fill transition, no text scaling.
- Save: stable button width with progress label; success/stale panel fades in.
- Reduced motion: final states render immediately, while focus and live-region
  announcements remain intact.

## Stitch prompt — desktop

Edit the closest full-frame desktop screen in project
`1256373820415012052` using design system
`assets/0ed4c54e96e648a38eb0f3499178c283`. Match the verified current MentalBridge
`/support-plan` baseline at 1440 × 900. Preserve the AuthenticatedShell desktop
sidebar, global header/top bar, SupportPlan workspace header, four existing tabs,
content bounds, and scroll ownership exactly. Do not add, remove, duplicate, or
move navigation, page headers, breadcrumbs, tab bars, safety controls, or global
actions.

Modify only the `Kế hoạch` tab panel for a DRAFT plan. Add a calm schedule review
region titled `Nhịp phù hợp với tuần của bạn` immediately before activation. Show
two realistic schedulable action cards. Each has a compact current summary and an
accessible inline editor for cadence (`Một lần`, `Mỗi ngày`, `Theo tuần`,
`Không lặp lại`), weekday multi-select when weekly, timing mode (`Theo buổi` or
`Giờ cụ thể`), preferred daypart or time, estimated duration, and timezone. Use
plain Vietnamese such as `Khoảng 10 phút · Thứ Hai, Thứ Năm · Buổi tối` and
`Múi giờ Asia/Ho_Chi_Minh`. Include a quiet note that changing the schedule never
changes which activities are suitable. Show one review-only action with a clear
non-editable explanation instead of recurrence controls.

Demonstrate a dirty draft where one workload value has changed: keep `Lưu nhịp`
as the single primary action in the editor and show activation blocked with
`Lưu hoặc hoàn tác thay đổi lịch trước khi bắt đầu kế hoạch`. Include compact
save-success and stale-recovery treatments without modal takeover. Use Fraunces
for production-aligned headings and Be Vietnam Pro for body/controls, correct
Vietnamese diacritics, visible focus, 44px controls, 200% zoom resilience, no
horizontal overflow, and the motion/reduced-motion contract above. Generate
renderable HTML/CSS/JS, not a wireframe.

## Stitch prompt — mobile

Create the 375px counterpart from the verified current `/support-plan` mobile
baseline in the same Stitch project and design system. Preserve the existing
mobile AuthenticatedShell header/navigation, workspace title, four tabs, content
padding, safe areas, and scroll ownership. Do not invent a second header, tab bar,
bottom navigation, or floating control.

Inside only the `Kế hoạch` panel, render the same schedule review journey as a
single-column accordion/list. The collapsed row must answer when, how often, and
for how long; the expanded editor must keep weekday chips, timing mode, duration,
timezone, save, undo, stale recovery, and review-only state fully usable from
320–430px. Keep activation blocked while edits are dirty. Controls are at least
44px, weekday chips wrap without clipping, long timezone text wraps safely, and
the action area never covers content or mobile navigation. Use Fraunces plus Be
Vietnam Pro, correct Vietnamese diacritics, and the same restrained and reduced
motion behavior. Generate renderable HTML/CSS/JS.

## Stitch outputs

- Desktop screen ID: `39121cdd8787447cab08b42150cee532`.
- Mobile screen ID: `5a7119b0d01448189819062e3ad92e60`.
- Retrieved desktop evidence:
  `support-plan-schedule-desktop-stitch.html` and
  `support-plan-schedule-desktop-stitch.png`.
- Retrieved mobile evidence:
  `support-plan-schedule-mobile-stitch.html` and
  `support-plan-schedule-mobile-stitch.png`.
- Local interactive prototypes:
  `support-plan-schedule-desktop-prototype.html` and the already-interactive
  `support-plan-schedule-mobile-stitch.html`.
- Runtime screenshots:
  `support-plan-schedule-desktop-runtime.png` and
  `support-plan-schedule-mobile-runtime.png`.
- QA command: `node .stitch/mb-640/prototype-qa.mjs`.
- QA result: `MB640_PROTOTYPE_QA_PASS` for render/runtime errors, declared
  Be Vietnam Pro body and editorial heading font, locked shell marker, 44px
  save target, save-to-activation transition, stale reload action, reduced
  motion, and zero horizontal overflow at 1440px and 375px.

The maintained Stitch design system declares Newsreader headings; production
currently owns Fraunces headings. The implementation therefore translates the
accepted hierarchy and spacing into repository-owned Fraunces tokens rather
than importing Stitch's Newsreader/CDN runtime. The first mobile edit was
rejected because Stitch returned a desktop canvas; screen
`5a7119b0d01448189819062e3ad92e60` is the corrected native MOBILE generation.
