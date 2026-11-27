# MB-772 SupportPlan through the global Mầm

Scope: web only. With `MAM_WEB_ENABLED` on, `/support-plan` (Today, Plan, Progress, Adjust) uses the one global Mầm dock instead of the legacy SupportPlan Companion; with the flag off the legacy Companion stays and no dock renders. No backend, contract, policy or mobile change. Authority: `docs/ADR_MAM_RIVE_V1_CONTRACT.md` (route table and SupportPlan row, "Explanation sources in V1", flag-off behaviour), `support-plan-companion-policy-v1.md` (backend repository).
Run on 2026-10-28 against a production build of base `fc0ae48f` (MB-775 merged) plus this change, fixture backends, flag toggled by environment only.

## What changed for the user (flag on)

| Surface                            | Behaviour                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy Companion                   | Not rendered: no aside, no contextual "Giải thích" entry, no guided panel. Never both companions on one page                                                                                                                                                              |
| Today focus card, Plan action rows | A Mầm button in the card corner opens the global bubble at that card, already pending, for the existing Care `EXPLAIN_ACTION` request (unchanged request). Repeated presses share one request; generated answers carry one AI note; a failure shows the approved fallback |
| Dock "Hỏi Mầm về trang này"        | "Nên bắt đầu từ đâu?" answers from the real Today focus (`selectTodayFocus`), with "Đến việc này" to the focus card; "Mầm giải thích" gives reviewed per-tab copy. No model call                                                                                          |
| Adjust, replacement review         | "Mầm xem lại tuần của bạn" opens the deterministic review explanation inline in the card; no bubble, no model call, no plan mutation                                                                                                                                      |
| Confirmed save                     | After Care confirms an occurrence as done, the dock plays `light_success` once (not when hidden, muted, motion off, reduced motion or suppressed). No award celebration on this route                                                                                     |
| Dirty form                         | Card buttons are inert and an open bubble closes while the workspace reports unsaved input                                                                                                                                                                                |

## Measured: `/support-plan` flag off versus on

Same method and machine as MB-775 (`mb-775-mam-web-gate.md` "Measurement setup"); medians of 3 runs, raw run in [`mb-772-support-plan-mam-measurements.json`](mb-772-support-plan-mam-measurements.json) (its `meta.story` field is the script's fixed label). The MB-775 file [`mb-775-mam-gate-measurements.json`](mb-775-mam-gate-measurements.json) is kept unchanged as the historical gate record; the other routes in the new run moved under 1% in bytes. Their idle CPU observations differ between these dev-machine runs and remain below budget; the measurements do not establish the cause of those differences.

| Metric                                   | Off `/support-plan` | On `/support-plan` | MB-775 budget |
| ---------------------------------------- | ------------------- | ------------------ | ------------- |
| Client JS transferred                    | 305,756 B           | 361,316 B          | +61,000 B     |
| All bytes transferred                    | 876,857 B           | 1,326,573 B        | —             |
| `/mam/*` requests                        | 0                   | 3 (419,562 B)      | 460,000 B     |
| Idle main-thread CPU (share of one core) | 1.72%               | 5.26%              | 14%           |
| JS heap after GC                         | 4.27 MB             | 7.40 MB            | 9 MB          |
| Idle rAF rate / longest gap              | 60 fps / 16.8 ms    | 60 fps / 16.8 ms   | ≥ 55 fps      |
| Dock elements                            | 0                   | 1                  | 1             |

Extra JS with the flag on is 55,560 B, the same lazy Rive chunk as other routes. All values are inside the MB-775 budgets. Dev-machine headless numbers, not device claims.

## Acceptance results

| Check                                                                                                      | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Flag on: one dock, no legacy aside, card bubble, shared request, dock starters, Help Now reachable         | PASS `tests/e2e/mam-support-plan.spec.ts`                                                  |
| Flag on: inline review explains without mutation or model call; collapse returns focus                     | PASS `tests/e2e/support-plan-workspace.spec.ts` "MB-772 explains the adaptive review…"     |
| Flag on: actions and Help Now clickable at 1440/1280/768/375; navigation cycle has one dock on SupportPlan | PASS `tests/e2e/mam-gate.spec.ts`, `tests/e2e/mam-dock.spec.ts`                            |
| Flag off: no dock, no Rive request on SupportPlan; legacy Companion and original CTA work                  | PASS `tests/e2e/mam-flag-off.spec.ts`, legacy MB-650/651/652/653 specs with the flag off   |
| Unit: topology parity, request sharing, stale discard, suppression, save one-shot only on success          | PASS (see Verification)                                                                    |
| Navigation raw JSON (`mb-775-mam-gate-navigation.json`) with SupportPlan in the cycle                      | NOT_RUN as a capture; the gate spec's listener and heap assertions passed on the new cycle |
| Firefox/WebKit, real devices, real screen reader, mobile app                                               | NOT_RUN (mobile parity is MB-776)                                                          |

## Known limits

- The three legacy Companion specs and the MB-652 guided-panel test run with `MAM_WEB_ENABLED=false` through `npm run test:e2e:flag-off`, serialized after the flag-on suite in `ci:staging` using the same build.
- `npm run mam:gate:measure` still writes `mb-775-mam-gate-measurements.json`; this run was saved under the MB-772 name and the MB-775 file restored.
- Suppression reports unsaved input and active-plan/no-plan safety-first states; dirty schedule validation and the existing dialog/visibility checks also suppress the host. Confirmed-save feedback is discarded after workspace unmount and cleared on route changes.
