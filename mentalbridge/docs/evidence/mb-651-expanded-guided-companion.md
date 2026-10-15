# MB-651 expanded guided Companion evidence

## Contract behavior

The existing Companion shell now exposes an explicit **Mở hướng dẫn có giới
hạn** control. It opens a bounded panel without remounting the SupportPlan
journey or changing plan state. The panel contains approved starter buttons and
has no free-text prompt, send control, microphone, autonomous request, or plan
mutation callback.

The action-explanation starter reuses the MB-650 Care boundary and sends only
the exact plan ID, action ID, and approved `TODAY|PLAN` surface. “Tôi nên bắt
đầu từ đâu?” names only the action already present in the loaded plan and says
that display order is not a clinical judgment. Navigation copy only points to
Today or Adjust. Review explanation appears only when the current Adjust
surface has an authoritative review object.

Every response identifies its source as AI phrasing, current-plan information,
or navigation guidance. Companion never invokes save, activate, complete,
pause, replace, or schedule mutation handlers. Follow-up navigation closes the
panel and focuses the destination tab so the authoritative feature remains the
place where the user reviews and confirms any change.

## Privacy, consent, and retention

The panel does not collect free text and adds no API or persistence contract.
It receives only the minimized MB-650 action identity. No raw PHQ/GAD answer,
Journal text, Emotion detail, Consultation data, or arbitrary client context is
included.

Conversation turns are React-memory state scoped to the mounted SupportPlan
page. They are cleared by a remount, refresh, or route exit and are never stored
in localStorage, sessionStorage, cookies, or a conversation backend. Existing
Care/Journal consent enforcement still decides whether the explicit action
request receives generated copy or a policy-approved template. A template or
provider failure stays labeled as fallback and cannot change the plan.

Session mute removes live-region semantics from the requested response while
leaving its text visible. Opening, closing, loading, tab changes, and other
passive visual state changes do not create unsolicited announcements.

## UX and accessibility evidence

The Stitch source and local prototype are in `.stitch/MB-651/`. The desktop
panel remains in flow beside the SupportPlan content. At tablet/mobile widths it
becomes a scrollable bottom/full-height sheet with a clear close control. It
does not trap focus; close restores the opener, while a navigation follow-up
focuses the destination tab. Production uses Be Vietnam Pro and Fraunces tokens,
44px controls, visible focus rings, wrapping Vietnamese copy, reduced-motion
inheritance, and no horizontal overflow.

## Regression coverage

- Component tests prove no request on open/focus, exact action-bound request,
  source labeling, mute suppression, unavailable review gating, deterministic
  follow-ups, no plan mutation, temporary retention, and no textbox.
- Shell and Journey tests prove close-focus restoration and preservation of an
  unsaved schedule while the panel opens and closes.
- Playwright covers contextual open → action explanation → navigation follow-up
  → focused Adjust tab, then the mobile full-height sheet, 44px controls, no
  textbox, no horizontal overflow, and no runtime errors.
- Existing MB-648/650 shell, session mute, storage denial, reduced motion,
  static renderer fallback, contextual response, and SupportPlan suites remain
  in the quality gate.

## Verification

Verified on 2026-10-15 against the final local MB-651 worktree state:

- `npm run quality`: passed formatting, lint, TypeScript, contract checks,
  237 Vitest files / 1,343 tests, and the production Next.js build.
- `node scripts/run-e2e.mjs tests/e2e/support-plan-guided-companion.spec.ts tests/e2e/support-plan-contextual-companion.spec.ts tests/e2e/support-plan.spec.ts --workers=1 --reporter=line`:
  6 Playwright tests passed.
- `.stitch/MB-651/prototype-qa.mjs`: passed panel visibility, Be Vietnam Pro
  loading/source, Vietnamese replacement-glyph, fixed-starter, 44px-target,
  and horizontal-overflow checks.
- The production mobile Playwright capture was inspected for Vietnamese font
  rendering, component clipping, button/icon rendering, and sheet overflow;
  no visual defect was found.
