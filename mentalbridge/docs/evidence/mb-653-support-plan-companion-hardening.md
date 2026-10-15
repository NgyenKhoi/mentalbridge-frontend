# MB-653 SupportPlan Companion hardening evidence

## Policy compliance

| MB-653 / MB-647 rule                                                    | Previous gap                                                                                                                             | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                  | Regression evidence                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Reduced motion has an equivalent static experience                      | Repeated idle/orbit motion could continue outside the reduced-motion media query                                                         | Idle motion is static by default; bounded state motion stops when reduced motion, mute, or interruption control is active. Text and actions remain available.                                                                                                                                                                                                                                                         | Shell unit coverage, `support-plan-companion-hardening.spec.ts`, and reduced-motion screenshot                                              |
| Mute and hide persist only for the appropriate lifecycle                | Mute was already session-scoped, but collapsed state did not survive route navigation or a remount                                       | Mute and hide use safe `sessionStorage` with an in-memory fallback. They survive remount, SupportPlan tab changes, route navigation, and reload in the current browser tab. A new tab/browser session starts from defaults. No legacy `localStorage` value is migrated.                                                                                                                                               | Session navigation/remount/independent-session and storage-denial unit/browser tests                                                        |
| Automatic prompts obey frequency and dismissal rules                    | The release gate did not explicitly lock the current zero-automatic-prompt behavior                                                      | MB-653 adds no automatic prompt, provider call, or passive live announcement. Repeated navigation remains at zero automatic requests, which is stricter than the maximum-one/ten-minute policy. A collapsed shell remains collapsed for the tab session.                                                                                                                                                              | Repeated-navigation unit and Playwright assertions                                                                                          |
| Companion does not interrupt sensitive work                             | An open guided panel or pending contextual card response could remain interactive while a form became dirty or an external dialog opened | Dirty SupportPlan forms and external dialogs place every Companion surface in a quiet static state, close the open panel, invalidate late card or guided responses, suppress contextual live regions, and disable request controls without moving focus. The journey-wide request lock remains until the admitted HTTP request settles, then retry becomes available. Drafts and authoritative actions remain intact. | Native and legacy deferred-response dialog tests, dirty-card invalidation, surface live-region tests, and external-confirm browser coverage |
| Keyboard, screen reader, contrast, touch, focus, and zoom remain usable | The interruption lifecycle and 200% equivalent layout were not release-gated                                                             | Existing focus containment/restoration and non-live visible text are preserved. Controls remain at least 44px, Vietnamese font tokens resolve, and the 640 CSS-pixel viewport (1280px at 200% zoom) has no horizontal overflow.                                                                                                                                                                                       | Existing MB-648/651 accessibility coverage plus MB-653 44px, font, zoom, modal, and overlap checks                                          |
| Performance has explicit budgets                                        | MB-648 timing evidence did not cover source weight, heap growth, CPU duration, and frame pacing together                                 | Companion client source is limited to 100KB raw / 20KB gzip and imports no external animation runtime. Desktop/mobile budgets now cover load, transition, CPU task duration, frame pacing, dropped intervals, and heap growth.                                                                                                                                                                                        | `verify-support-plan-companion-budget.mjs`, static budget JSON, and performance JSON                                                        |
| Slow/offline/provider failure cannot block SupportPlan                  | Failure fallback existed but was not included in this release gate                                                                       | A failed Companion request renders the existing bounded fallback while the original SupportPlan action remains usable. Companion controls never invoke plan mutations.                                                                                                                                                                                                                                                | Dependency-503 and mutation-counter Playwright assertions                                                                                   |
| Mobile shell stays in flow without covering actions                     | Existing responsive behavior lacked MB-653 overlap evidence                                                                              | The compact tray remains in document flow at 375px and does not cover the first authoritative activity action.                                                                                                                                                                                                                                                                                                        | Mobile bounding-box assertion and screenshots                                                                                               |

## Preference lifecycle and interruption semantics

Mute and hide are browser-tab-session preferences. Safe access wraps the
`sessionStorage` getter, reads, and writes. When storage is unavailable, a
module-memory fallback keeps the controls usable for the current application
runtime. Independent browser tabs or sessions do not inherit either value.
The explicit reduced-motion preference keeps its existing persistence and
system `prefers-reduced-motion` precedence.

The shell and both contextual response surfaces become interrupted only from
an explicit owning-form dirty signal or a visible external dialog. The shared
observer excludes the Companion's own mobile guided sheet from external-dialog
detection. Interruption closes guidance without restoring focus into the form
or dialog, invalidates an in-flight response through the existing request
sequence, hides card bubbles and shell trays, suppresses their live regions,
and disables request controls. The journey-wide lock is released only when the
admitted HTTP request settles, so a late response cannot reappear and retry is
then available. It never hides Care errors, validation, safety information, or
plan actions.

No contextual prompt is emitted automatically in this scope. Every Companion
request remains tied to an explicit user action. Passive tab, loading, route,
mute, hide, reduced-motion, and interruption changes do not create an
`aria-live` region.

## Performance budgets and results

The committed fixture-browser evidence in
`mb-653-companion-performance.json` records the measurement definitions and
raw values. The measured client source is 56,048 bytes raw and 12,387 bytes
gzip, below the 100,000 / 20,000 byte limits, with no external animation
runtime import.

| Profile                                |       Load / budget | Transition / budget | Idle CPU / budget | p95 frame / budget | Dropped intervals / budget |      Heap growth / budget |
| -------------------------------------- | ------------------: | ------------------: | ----------------: | -----------------: | -------------------------: | ------------------------: |
| Mobile, 4x CPU and constrained network | 5682.075 / 10000 ms |    79.825 / 1500 ms |  281.744 / 450 ms |       16.8 / 80 ms |                     0 / 12 | 324,516 / 5,000,000 bytes |
| Mobile, reduced motion                 |     same route load |     same transition |  120.002 / 450 ms |       16.8 / 80 ms |                     0 / 12 |  56,956 / 5,000,000 bytes |
| Desktop                                |   322.739 / 5000 ms |     66.965 / 750 ms |  113.125 / 250 ms |       16.8 / 50 ms |                      0 / 8 |       0 / 3,000,000 bytes |
| Desktop, reduced motion                |     same route load |     same transition |   15.604 / 250 ms |       16.8 / 50 ms |                      0 / 8 |  19,992 / 3,000,000 bytes |

## UX and visual evidence

The written brief, Stitch screens, exported prototypes, and automated prototype
QA are in `.stitch/MB-653/`. Stitch screen
`e872da32752e44a58286e443f1eb3f68` covers desktop and
`01398a785ec541f79d100fd89718a6ec` covers mobile. The implementation retains
the repository-native shell and design tokens rather than copying generated
markup.

Production Playwright captures:

- `mb-653-companion-mobile-muted.png`
- `mb-653-companion-mobile-reduced-motion.png`
- `mb-653-companion-desktop-muted-reduced-motion.png`

The captures were inspected at original resolution. Be Vietnam Pro body text,
Fraunces headings, Vietnamese diacritics, character SVG, icons, buttons,
cards, and responsive layout render without replacement glyphs, clipping, or
overlap. All identities and health-plan content are synthetic fixtures.

## Release checklist

- [x] Reduced-motion and static equivalents verified.
- [x] Session mute/hide lifecycle, remount, reload, navigation, independent
      session, and blocked-storage behavior verified.
- [x] Repeated navigation produces no automatic request or unsolicited live
      announcement.
- [x] Dirty forms and external dialogs suppress and close every Companion
      response surface without losing the draft, stealing dialog focus, or
      releasing the one-request lock early.
- [x] Keyboard/focus behavior, accessible labels, 44px targets, Vietnamese
      fonts, 375px layout, and 200% zoom equivalent verified.
- [x] Dependency failure leaves original SupportPlan actions available.
- [x] Companion controls do not invoke Care plan mutations.
- [x] Static source and production runtime budgets pass.
- [x] Companion can be muted, hidden, interrupted, unavailable, or disabled
      without degrading the core SupportPlan journey.

## Verification

Verified on 2026-10-15 against the final local MB-653 worktree state:

- `npm run quality`: passed formatting, lint, TypeScript, contract checks,
  Companion static budget, 238 Vitest files / 1,355 tests, and the production
  Next.js build.
- `node scripts/run-e2e.mjs tests/e2e/support-plan-companion-hardening.spec.ts tests/e2e/support-plan-guided-companion.spec.ts tests/e2e/support-plan-contextual-companion.spec.ts tests/e2e/support-plan.spec.ts --workers=1 --reporter=line`:
  8 Playwright tests passed.
- `node .stitch/MB-653/prototype-qa.mjs`: passed desktop/mobile font loading,
  Vietnamese replacement-glyph, 44px-target, action-visibility, overlap,
  broken-SVG, unsolicited-alert, and horizontal-overflow checks.
- The three production Playwright captures were inspected at original
  resolution for font, component, icon, clipping, and overlap defects.

## Scope boundary and follow-up

MB-653 changes only the frontend release gate and introduces no REST/OpenAPI,
Care business-rule, backend persistence, AI provider, or personal-data flow.
MB-654 should preserve these interruption, session-preference, accessibility,
and performance contracts when it closes native/mobile parity; native storage
semantics must be reviewed independently rather than inferred from browser
`sessionStorage`.
