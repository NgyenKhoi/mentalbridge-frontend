# SupportPlan polish and USER Community entry — design gate

Follow-up to MB-640, with an explicit owner-requested Community navigation addition; no new Jira item created. Demo preparation is tracked separately in workspace context and is not a reason to change booking/evidence rules.

## Verified baseline

Captured current source at frontend `76716b0` using local Next.js at 127.0.0.1:3100 and synthetic Identity/Care fixtures at3201/3202. Shared dev databases were not used. Capture source: workspace `.artifacts/ui-polish/capture-baseline.mjs`.

- `baseline-desktop.png/html`: 1440×900, full page, USER ACTIVE plan, Adjust selected, personalization partial error retained.
- `baseline-laptop.png/html`: 1280×800, same state.
- `baseline-mobile.png/html`: 375×812, same state.
- Current four tabs verified from DOM and SupportPlanJourney source: Hôm nay, Kế hoạch, Tiến triển, Điều chỉnh. Old MB-640 baseline with three tabs is stale.
- Full frames include real AuthenticatedShell sidebar/topbar, route header/tabs, safety entry, page bounds and scroll ownership. Capture output reports no horizontal overflow in all three sizes.

## Scope and authority

USER needs to read the plan, change a manageable future rhythm and save without losing another activity draft. Care remains authority for actions, schedules, lifecycle, versions and idempotency. Existing API contract stays unchanged. No diagnosis, new entitlement checks or inferred safety meaning.

Locked: existing logo/sidebar dimensions/items (except authorized Community addition), topbar layout, workspace header, four tabs, content bounds, safety entry and scroll ownership. Conditional: existing personalization region and replacement controls stay owned by their existing features.

Editable: cadence editor inside existing plan/adjust panels, plan resource descriptions and ordinary lifecycle presentation. Authorized chrome exception: labeled Community link in USER topbar and menu, with accessible mobile counterpart. Community continues to use its separate existing shell.

## Design direction

Preserve calm teal/sage, Fraunces headings and Be Vietnam Pro controls with Vietnamese glyph coverage. Use existing semantic colors/shape/motion tokens. Theme-native select popups, semantic checkbox with 44px label target, wrapping weekday choice chips, reminder checkbox and label in one aligned row. Compact heading/summary above form groups. Neutral/teal lifecycle surface instead of amber warning for ordinary management. Icons express activity, time, reminder and successful save, no icon font dependency. Bullets only for actual structured instructions/meaningful list content, not fabricated advice or arbitrary sentence splitting.

## Interaction state map and acceptance

- Open A/B → edit cadence/weekday/time/duration/reminder → dirty.
- Save A pending → success with authoritative A, local B draft remains.
- Subsequent edit becomes dirty again; Undo restores the correct saved snapshot.
- 412 A → retain inputs → explicit reload A only; B draft remains → retry.
- Generic failure preserves values; retry available. Empty/loading/paused/read-only/non-schedulable states explain the next valid action.
- DRAFT activation stays blocked while any schedule is dirty; lifecycle confirms and can cancel with focus returned.
- Community topbar/menu → Community shell → dashboard, mobile menu closes and keyboard order remains logical.

Prototype is a clearly labeled synthetic local interaction model inside captured shell, never connected to real credentials/business APIs. Stitch outputs are design evidence only. No production UI edits until render and interaction gates pass.

## QA matrix

1440×900 and1280×800 main;768/375 regression;1280@200% zoom. Verify actual loaded fonts/glyphs, control states, popup overflow, keyboard Arrow/Home/End/Escape, checkbox Space, focus return, visible focus/contrast, no console errors and no horizontal overflow. Repeat with reduced motion; assert values/state after save/undo/conflict, not merely clickability or existence of aside/header.

## Evidence status

- Baseline captured and reviewed; old artifacts rejected as current baseline.
- Stitch project1256373820415012052 and closest maintained screens re-listed.
- Stitch desktop content direction accepted from screen `db240ef8222d486281059242719705e7` (`stitch-final-0.html/png`); mobile custom popup direction accepted from `25c08b07023e4c11a5e5b4bfddee8516` (`stitch-mobile-final.html/png`). Earlier outputs are retained for comparison, not accepted baselines. Generated chrome is only approximate; production keeps source-owned chrome.
- `support-plan-interactive-prototype.html` is the local, synthetic interactive prototype built inside the captured actual shell. It is not a linked native Stitch prototype. No credentials or business API calls.
- `node .stitch/mb-640-polish/prototype-qa.mjs`: 21 checks passed, plus loaded-font evidence in `prototype-qa-results.json`. Re-run after restoring editable IANA timezone, accurate lifecycle copy, visible mobile Community label and active-tab scroll. Targets meet 44px with 0.01px rounding tolerance after animations settle.
- Reviewed full-frame desktop/mobile render, actual loaded Be Vietnam Pro/Fraunces with Vietnamese sample, exact shell geometry, keyboard controls, draft A/B continuity, Undo, pending/error/conflict/reload, lifecycle cancellation/focus, Community handoff, reduced motion, no external/business API calls and no JS errors. No horizontal overflow at 1440/1280/768/375/640px. The 640×400 check is a 200%-zoom-equivalent viewport, not evidence of manual browser zoom.
- Design/prototype gate passed for scoped implementation. Production UI/browser QA has also passed at the five viewport sizes below. No five-reviewer UX score is claimed: isolated reviewer capacity was unavailable.
- Production implementation uses existing LightSelect, semantic checkbox inputs with separate visible marks (global input background rules must not erase checked state), explicit list markers, canonical tokens, and no new runtime dependency. The structured-description renderer only parses explicit newline bullet markers and renders plain text safely.
- An independent source review found an Undo focus edge when enabling/disabling schedules. Fixed with post-render focus to restored time or stable schedule toggle; both paths have regression tests. Dropdown height is bounded to the chosen viewport side, with feature-scoped space for the existing safety entry.
- Production browser QA completed against the current standalone production build and real Next route, using isolated synthetic Identity/Care services and intercepted Care responses: **5/5 passed** at 1440×900, 1280×800, 768×1024, 375×812 and 640×400 (zoom-equivalent, not manual browser zoom). Evidence: `production-qa-results.json`, `production-*.png`; runner: workspace `.artifacts/ui-polish/production-qa.mjs`. Checked loaded fonts/glyphs, visible checkbox marks/list bullets, Community target, keyboard popup bounds and safety-entry separation, Space/Undo, A/B draft save and 412 reload continuity, latest Undo, dirty lifecycle, dialog Escape/focus, overflow and JavaScript errors. This does not prove authenticated shared-dev behavior or unobscured controls at every possible scroll position.
- Verification: 46/46 focused UI tests passed, including the shared LightSelect consumer regression in AdminProfileAmendmentReview. Format/lint/types/contracts passed in the full quality run; that run ended with 1100 passing tests and one obsolete button-role expectation, subsequently fixed and verified in the focused run. `npm run build` passed separately. Do not report the full quality command as exit 0 or claim an unperformed full-suite rerun.
- Frontend Docker was rebuilt/recreated and is healthy at localhost:3000. Care and Content service health also passed; Docker health is not evidence for the two-account appointment journey.
