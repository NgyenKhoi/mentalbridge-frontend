# MB-638 SupportPlan personalization — Stitch brief

- Jira: MB-638
- Stitch project: `MB-637 — Support Plan v3 UX Prototype`
- Project ID: `1256373820415012052`
- Design system: `Therapeutic Sanctuary`
- Design system asset: `assets/0ed4c54e96e648a38eb0f3499178c283`
- Route/actor: authenticated USER at `/support-plan`, within the existing
  `Điều chỉnh` journey
- Primary job: share or skip practical, non-clinical preferences so a future
  SupportPlan can use only policy-approved choices and schedule defaults

## Full-frame baseline correction

The first MB-638 desktop/mobile generations are superseded and must not be used
as implementation blueprints because they inferred their own page chrome.

Reuse a previous approved repository artifact when it contains the current
full frame; capture a new route screenshot only when no such artifact exists or
the artifact is stale. The baseline must preserve:

- `AuthenticatedShell` / `.ref-shell` and `.ref-sidebar`;
- `.ref-topbar` and its mobile-menu ownership;
- the SupportPlan workspace header;
- `.mb-support-workspace-tabs`, including `Hôm nay`, `Kế hoạch`, `Tiến triển`
  and `Điều chỉnh`;
- existing content width, padding and scroll ownership.

Only the `Điều chỉnh` tab panel content is editable for MB-638. Surrounding
chrome shown by Stitch is context only: implementation must not copy it, add a
second header/tab bar, or replace the production layout.

The existing MB-637 `support-plan-today-desktop-v2.html` is useful for the
SupportPlan workspace header and four-tab language, but it uses a horizontal
top app bar rather than the current `AuthenticatedShell` sidebar. Therefore it
is not, by itself, a valid desktop shell baseline. Pair it with a current
full-frame artifact or capture before the next Stitch edit.

## Product authority and boundaries

- Every field is optional. Saving an entirely empty form explicitly records
  that the user skipped it.
- Focus choices: lo âu, tâm trạng, giấc ngủ, động lực, hiểu cảm xúc.
- Pace choices: nhẹ nhàng, cân bằng, chủ động.
- Daily time: 5, 10, 15, 20, or 30 minutes.
- Daypart: buổi sáng, buổi chiều, buổi tối, linh hoạt.
- Activity modes (multi-select): đọc, thực hành có hướng dẫn, viết nhật ký,
  ghi nhận cảm xúc, xây dựng thói quen.
- Common barriers (multi-select): ít năng lượng, không đủ thời gian, khó bắt đầu.
- Do not ask for symptoms, diagnosis, treatment goals, free text, or sensitive
  clinical details. Do not promise AI, matching, treatment, or guaranteed
  outcomes.
- Preferences may reorder only policy-approved activities and set defaults.
  They never bypass safety or eligibility rules.
- Saving preferences never silently changes an ACTIVE/PAUSED plan. When review
  is required, say the current plan is unchanged and provide a clear path to
  inspect it before any separate change.
- Hide IDs, revisions, schema/provenance and backend language from normal UI.

## State and interaction map

1. Loading: stable page/form skeleton.
2. First visit: three short progressive sections; all optional; visible
   `Bỏ qua lúc này` action.
3. Partial/complete edit: restore saved selections and allow replacement.
4. Save pending: preserve selections; disable only save/step command; keep its
   action label clear.
5. Save success: concise in-place confirmation.
6. Saved while an active plan exists: warm, non-alarmist notice that the
   current plan remains unchanged, with a secondary `Xem kế hoạch hiện tại`
   path.
7. Version conflict: preserve the local form, explain that choices changed
   elsewhere, and offer `Tải lựa chọn mới nhất` before another save.
8. Load/save error: retain usable content and offer local retry.
9. Keyboard/touch: native radio/checkbox semantics, visible focus, 44px touch
   targets, logical DOM order, no color-only state.

## Motion contract

- First entrance: one restrained 180–240ms opacity + 8px translate transition.
- Step/section change: cross-fade with directional continuity; no bounce,
  parallax, looping or decorative choreography.
- Choice feedback: 120–160ms border/fill transition and check/radio mark; do
  not scale text.
- Save: button keeps its width and label context; lightweight progress state.
- Success/review/stale message: short fade/height reveal with live-region copy;
  never auto-dismiss actionable feedback.
- `prefers-reduced-motion`: render final states immediately with no spatial
  movement while preserving focus and announcements.

## Desktop prompt

Design a high-fidelity desktop screen for MentalBridge MB-638 inside the
existing Vietnamese SupportPlan experience, specifically the `Điều chỉnh` tab.
Use the supplied Therapeutic Sanctuary design system and preserve the existing
app shell/sidebar and SupportPlan tab language. The main panel is a calm,
progressive three-part preference flow titled `Điều gì phù hợp với bạn lúc
này?`, with plain-language reassurance that every answer is optional and only
helps arrange already suitable wellbeing activities. Use a compact left rail
or progress header for: 1 `Trọng tâm`, 2 `Nhịp phù hợp`, 3 `Cách bắt đầu`.

Show real Vietnamese option copy for every bounded field in the authority list.
Use accessible radio-card groups for single choices and checkbox chips/cards
for multi-select choices; provide `Không ưu tiên` or unselected behavior without
inventing an extra API value. One primary action per step (`Tiếp tục`, then
`Lưu lựa chọn`), a quiet `Quay lại`, and a visible `Bỏ qua lúc này`. Include a
realistic saved state in which `Giấc ngủ`, `Nhẹ nhàng`, `10 phút`, `Buổi tối`,
`Thực hành có hướng dẫn`, `Viết nhật ký`, `Ít năng lượng`, and `Khó bắt đầu`
are selected. Also show the non-alarmist post-save notice: `Lựa chọn đã được
lưu. Kế hoạch hiện tại của bạn vẫn giữ nguyên cho đến khi bạn xem lại và chủ
động thay đổi.` with secondary action `Xem kế hoạch hiện tại`.

Specify purposeful UX animation in the design/code: restrained page entrance,
directional step cross-fade, immediate selected-state feedback, stable save
progress, success/stale message reveal, and full reduced-motion behavior as
defined above. Include error/stale treatment that preserves form data and a
`Tải lựa chọn mới nhất` recovery action. Ensure 1280/1440 desktop composition,
visible focus states, 200% zoom resilience, 44px controls, no horizontal
overflow, no diagnosis/clinical questions, and no developer terminology.
Typography must be Newsreader headings plus Be Vietnam Pro body/controls with
correct Vietnamese diacritics and safe fallbacks. Generate renderable HTML/CSS/
JS, not a wireframe.

## Mobile prompt

Design the mobile counterpart (375px) of the same MentalBridge MB-638
SupportPlan personalization flow using the exact same Therapeutic Sanctuary
system, Vietnamese content, product authority, fields, selected example and
motion contract. Keep it inside the authenticated SupportPlan journey but use a
single-column progressive flow with a compact progress indicator, comfortable
scrolling, and a safe-area-aware sticky action bar containing only the current
primary action plus a clear back path. `Bỏ qua lúc này` remains visible without
competing with the primary action. Multi-select choices must wrap without
clipping; controls are at least 44px; software keyboard is not needed because
there is no free text.

Show the saved/review-required result as an in-flow panel, not a blocking
modal: `Lựa chọn đã được lưu. Kế hoạch hiện tại của bạn vẫn giữ nguyên cho đến
khi bạn xem lại và chủ động thay đổi.` and `Xem kế hoạch hiện tại`. Include a
stale/version-conflict state that retains local choices and offers `Tải lựa chọn
mới nhất`. Specify the same restrained selection, step, save, success and
reduced-motion behaviors. Use Newsreader plus Be Vietnam Pro with correct
Vietnamese diacritics, safe fallbacks, no clipped components at 320–430px, and
generate renderable HTML/CSS/JS rather than a static wireframe.
