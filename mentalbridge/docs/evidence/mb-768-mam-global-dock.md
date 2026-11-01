# MB-768 Mầm global dock evidence

Contract: [ADR_MAM_RIVE_V1_CONTRACT.md](../ADR_MAM_RIVE_V1_CONTRACT.md).
Verified on 2026-10-27 against a production standalone build (Chromium).

## What ships

| Piece                                      | Role                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/mam/MamDock.tsx`                 | The one dock per tab, mounted in `app/providers.tsx`, outside every route subtree                                                                  |
| `features/mam/MamDockSlot.tsx`             | Rendered by the `(dashboard)` and `resources` layouts after `requireCurrentAccount(['USER'])`, only when `MAM_WEB_ENABLED=true`                    |
| `features/mam/mam-routes.ts`               | Surface allowlist: `/dashboard`, `/achievements`, `/support-guides(/id)`, `/journal`, `/resources(/id)`. `/support-plan` stays hidden until MB-772 |
| `features/mam/mam-preferences.ts`          | Hide and motion per device, mute per session (keys in the ADR "User controls")                                                                     |
| `features/mam/use-mam-suppressed.ts`       | An open `dialog[open]` or `[aria-modal="true"]` (journal editor, crisis panel) or a hidden tab closes the menu and stills Mầm                      |
| `lib/preferences/companion-preferences.ts` | Preference store moved out of `SupportPlanCompanionShell.tsx`; SupportPlan keys and behaviour unchanged                                            |

Flag off (default): no slot, so the dock renders nothing and the Rive runtime is never requested.

## Results

| Check                                                                 | Result                                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| One character across `(dashboard)` → `resources` layouts              | PASS: the same `<canvas>` element survives the switch (`mam-dock.spec.ts`)                   |
| `/support-plan`, public `/login`                                      | PASS: no dock                                                                                |
| Admin, specialist, community, assessment, AI Companion, messages      | Hidden by the allowlist and by the slot only existing in USER layouts (`mam-routes.test.ts`) |
| No action or crisis button covered at scroll end, 1440/1280/768/375   | PASS                                                                                         |
| Keyboard focus on an element under the dock                           | PASS: the dock fades out until focus moves on                                                |
| Menu by keyboard, Esc returns focus, hide survives reload, motion off | PASS                                                                                         |
| Crisis panel open                                                     | PASS: menu closes, Mầm still                                                                 |
| Hydration errors on navigation                                        | PASS: none                                                                                   |
| Unit (`features/mam`, SupportPlan companion)                          | PASS                                                                                         |

Known limit: while the page scrolls, the dock floats over content like the
crisis button does; the shell adds bottom space so the last row always
scrolls clear.
