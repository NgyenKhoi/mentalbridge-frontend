# MB-650 contextual Companion evidence

## Implemented flow

Eligible SupportPlan actions on Today and Plan expose a separate 44px
**Giải thích** button. Keyboard focus and pointer hover only reveal the
affordance; an API request begins after an explicit click. The request contains
only the exact plan/action identity in the BFF path and `TODAY|PLAN` in the
body. The BFF rejects extra context and binds the response to the same plan,
action and surface before rendering it.

Desktop responses use a non-modal bubble anchored to the requested action.
Below 1100px the response appears in the existing in-flow Companion tray.
Loading is visible without disabling or covering the original action. Dismiss
restores focus to the request trigger. A failed Care request shows a neutral
availability response and permits retry; it does not invent an explanation.

## UX and accessibility checks

| Requirement                           | Implementation                                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original action remains authoritative | Companion has its own button and never calls plan mutation handlers; original links/buttons stay rendered during loading, response and failure.                                              |
| No interruption during edits          | Requests are disabled while schedule, engagement or personalization edits are dirty; an already open response is dismissed when a surface becomes dirty.                                     |
| Mute behavior                         | Requested text remains visible. Session mute removes live-region semantics from contextual responses and does not affect safety, validation or plan feedback.                                |
| Announcements                         | Passive character/tab state has no live region. Only a completed, explicitly requested response is polite-live when unmuted; loading text is visible but not announced as a new AI response. |
| Focus                                 | Native buttons, visible focus ring, no trap, dismiss returns focus to the trigger.                                                                                                           |
| Motion                                | The loading icon is disabled by the existing reduced-motion media rule; textual loading remains.                                                                                             |
| Responsive                            | Desktop anchored bubble; mobile/tablet tray; long text wraps and controls recompose at narrow widths.                                                                                        |
| Transparency                          | Generated copy says it was phrased by AI from approved plan information; templates/errors are labeled as fallback responses.                                                                 |

## Stitch and typography evidence

The controlled files in `.stitch/MB-650/` record the design brief and full
desktop/mobile frames from Stitch project `1256373820415012052`. Prototype QA
checks 1280×800 and 375×812 for Be Vietnam Pro resolution, Vietnamese
replacement glyphs, 44px controls, reduced motion, action visibility and
horizontal overflow. The sample sentence in the Stitch frame is layout-only;
production accepts only the strict Care response.

## Regression coverage

- Strict response contract rejects unknown/sensitive fields and invalid
  generated/template provenance.
- BFF rejects cross-origin, extra context, invalid IDs and unsupported surface;
  only exact identities and approved surface reach Care.
- Component tests prove focus alone makes no request, loading is nonblocking,
  explicit response announcement, session mute suppression, visible fallback,
  dismiss and focus restoration.
- Journey test proves action-card request → bound response while the source
  action remains available.
- Production Playwright proves the explicit desktop card → response → original
  action journey, mobile in-flow tray, 44px trigger and no horizontal overflow.
- Existing shell, SupportPlan Journey/Card/Schedule, storage denial and reduced
  motion suites remain part of the final quality gate.

Final local verification on 2026-10-14:

- `npm run quality`: 232 test files / 1,273 tests, contracts, lint, typecheck and
  production build passed.
- `node scripts/run-e2e.mjs tests/e2e/support-plan.spec.ts tests/e2e/support-plan-contextual-companion.spec.ts --workers=1 --reporter=line`:
  5/5 passed.
- `node .stitch/MB-650/prototype-qa.mjs`: desktop/mobile font, component,
  reduced-motion, touch target, overflow and action-visibility checks passed.
