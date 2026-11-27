# MB-653 Companion release-hardening UX brief

## User job and authority

- Keep using Today, Plan, Progress and Adjust while the optional Companion is
  muted, collapsed, unavailable or intentionally quiet.
- Care-owned plan content, validation, safety and mutation controls remain the
  only authoritative actions.
- Existing Companion requests remain explicit. MB-653 adds no automatic
  provider request, recommendation, wellbeing inference or preference API.

## Interaction decisions

- Mute and collapse are scoped to the current browser-tab session. They survive
  SupportPlan tab navigation, remount and reload in that tab. A new independent
  tab/session starts from the default visible and unmuted state.
- Collapsing leaves a 44px named control so the user can restore the shell.
- While an unsaved SupportPlan form or external modal is active, the Companion
  stays static, closes an open guidance panel without moving focus, disables its
  guidance opener and makes no request or announcement.
- Route entry may show one visual greeting. Repeated surface navigation stays
  neutral. The current product has no automatic contextual prompt, so its
  release cap is zero; only explicit clicks can call the Companion dependency.
- Idle, muted, hidden, interrupted and reduced-motion states have no continuous
  character animation. Text remains the complete non-motion equivalent.

## Responsive and typography gate

- Reuse project `1256373820415012052` and the Therapeutic Sanctuary design
  system. Desktop screen: `e872da32752e44a58286e443f1eb3f68`. Mobile screen:
  `01398a785ec541f79d100fd89718a6ec`.
- Production body/control copy uses Be Vietnam Pro and headings use the existing
  Fraunces token. Vietnamese Latin Extended glyphs, focus rings, 44px Companion
  controls, wrapping and horizontal overflow are release failures.
- The full-frame references show an unsaved schedule edit with its Save/Cancel
  controls unobstructed and the Companion collapsed in normal document flow.

Stitch copy and data are layout evidence only. Production continues to render
the authoritative SupportPlan contracts and approved deterministic fallback.
