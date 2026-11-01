# MB-771 Mầm with the emotion check-in and Journal

Scope: web only. Behind `MAM_WEB_ENABLED`, the dashboard emotion check-in card gets one explicit Mầm entry, and the dock leaves while a dialog or a safety zone is open. Journal keeps its static list dock with no summon and no save reaction. The legacy SupportPlan Companion aside and its guided panel are removed for both flag values (owner decision, 2026-10-29). No backend, contract, policy or mobile change. Authority: `docs/ADR_MAM_RIVE_V1_CONTRACT.md` ("No-interrupt zones", "Surface matrix"), `daily-emotion-check-in-policy-v2.md` (backend repository).
Run on 2026-10-29 against a production build of base `1f951925` plus this change, fixture backends, flag toggled by environment only.

## What changed for the user (flag on)

| Surface                           | Behaviour                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard emotion check-in        | With a saved check-in for today and no edit in progress, a Mầm button in the card corner opens the global bubble at the card with one reviewed sentence. The text is the same for every emotion. No model call and no request |
| Emotion check-in while editing    | The button fades out and is removed from focus order while an option is picked or the note is typed; Mầm is suppressed (no summon, no one-shot)                                                                               |
| Emotion check-in save             | No Mầm reaction. The card's own tick is the acknowledgement                                                                                                                                                                   |
| `/journal` list                   | Static dock, unchanged. No summon target and no save reaction                                                                                                                                                                 |
| Any dialog, crisis widget         | The dock leaves (exit transition, instant under reduced motion) and returns when the dialog closes. Covers Journal create, view, edit and delete, the low-mood banner and the reflection panel                                |
| SupportPlan safety state          | The dock leaves (feature hide zone) instead of staying static                                                                                                                                                                 |
| `/support-plan`, both flag values | No legacy aside or guided panel; the main column takes the full width. With the flag off the per-card "Giải thích" entry stays                                                                                                |

## Privacy

Nothing from a check-in or a Journal entry reaches Mầm. The card computes one eligibility boolean; the `home.emotion` target has no context keys. A unit test seeds distinct sentinels for the saved and draft check-in and checks `MamCardButton` props, the target registry, dispatched events, `Storage.setItem`, fetch and the bubble text (`features/emotion-check-in/DailyEmotionCheckIn.mam.test.tsx`). The browser gate (`tests/e2e/mam-gate.spec.ts`, "sends no journal text and nothing off-origin") seeds a saved entry and an unsaved draft sentinel, reloads, and asserts that neither appears in any request other than the Journal save, nor in Mầm storage, and that no analysis request is made.

## Measured: flag off versus on

Same method as MB-775 (`mb-775-mam-web-gate.md` "Measurement setup"); medians of 3 runs, raw run in [`mb-771-mam-emotion-journal-measurements.json`](mb-771-mam-emotion-journal-measurements.json) (its `meta.story` field is the script's fixed label). The MB-775 file is kept unchanged. `/dashboard` is not in the script's `ROUTES` and was not measured (NOT_RUN).

| Route / flag        | Client JS | All bytes   | `/mam/*` bytes | Idle CPU | JS heap | Idle fps / max gap | Dock |
| ------------------- | --------- | ----------- | -------------- | -------- | ------- | ------------------ | ---- |
| `/journal` off      | 274,272 B | 820,383 B   | 0              | 3.67%    | 4.03 MB | 60 / 16.8 ms       | 0    |
| `/journal` on       | 329,832 B | 1,302,649 B | 419,562 B      | 4.49%    | 7.13 MB | 60 / 16.8 ms       | 1    |
| `/support-plan` off | 300,994 B | 832,944 B   | 0              | 3.55%    | 4.15 MB | 60 / 16.8 ms       | 0    |
| `/support-plan` on  | 356,554 B | 1,351,395 B | 419,562 B      | 9.50%    | 7.40 MB | 60 / 16.8 ms       | 1    |

All values are inside the MB-775 budgets (+61,000 B client JS, 460,000 B `/mam/*`, 14% idle CPU, 9 MB heap, ≥ 55 fps).

## Verification

| Check                                                                                                                                        | Result                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run format:check`, `typecheck`, `lint`, `contract:check`, `companion:budget`                                                            | PASS                        |
| Vitest `features/emotion-check-in`, `features/mam`, `features/support-plan`, `features/home`, journal                                        | PASS                        |
| Browser, flag on: `mam-gate`, `mam-dock`, `mam-celebrations`, `mam-summon`, `mam-support-plan`, `support-plan-workspace`, `emotion-check-in` | PASS                        |
| Browser, flag off: `npm run test:e2e:flag-off`                                                                                               | PASS (22 passed, 1 skipped) |

Not run: Firefox/WebKit, real devices, real screen reader, `/dashboard` measurement.
