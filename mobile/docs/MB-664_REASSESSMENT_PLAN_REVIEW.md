# MB-664 mobile reassessment and governed plan review

## Delivered owner journey

The authenticated USER can reopen an eligible reassessment, complete the
purpose-specific PHQ-9/GAD-7 episode, submit one bounded self-report, and review
the persisted four-dimension Care snapshot. From SupportPlan, the USER can open
`Tiến độ và điều chỉnh`, inspect Care's current-period facts and explicitly keep
the current plan or confirm one admitted change.

Mobile never combines the four evidence dimensions into a score, creates an
alternative locally, or mutates a SupportPlan before Care confirms the chosen
option.

## UX and state matrix

| State                                                               | Mobile presentation                                                         | Recovery or next action                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Reassessment `INCOMPLETE`                                           | Names the missing PHQ-9/GAD-7 instrument                                    | Opens a `REASSESSMENT` screening episode and returns to reassessment after completion |
| Self-report absent                                                  | Shows explicit experience choices and optional 500-character context fields | Creates an exact-period report with a stable idempotency key                          |
| Self-report already saved                                           | Reopens the exact-period values                                             | Sends `If-Match` only when the USER changes them                                      |
| Journal AI succeeds                                                 | Composes the snapshot from the terminal job identity                        | Shows four source-backed dimensions                                                   |
| Journal AI/consent is unavailable                                   | Care records the source as unavailable; mobile does not invent a result     | The snapshot remains usable with the unavailable reason visible                       |
| Journal job still running/interrupted                               | Saved self-report remains authoritative                                     | USER retries without losing the submitted report                                      |
| Review `EARLY`                                                      | Shows factual elapsed days and current counts                               | Keeping the plan is a no-change confirmation                                          |
| Review `REVIEW_DUE`                                                 | Explains the governed 14-day invitation, not a fixed outcome promise        | `KEEP_CURRENT` may continue the next governed cycle                                   |
| Review `PAUSED`                                                     | States that no change occurs until the USER chooses                         | Change options remain Care-bounded                                                    |
| Reassessment `NOT_STARTED` / `INCOMPLETE` / `STALE` / `UNAVAILABLE` | Shows the exact closed state                                                | Opens reassessment; no replacement option is fabricated                               |
| Admission unavailable or entitlement blocks an option               | Care's unavailable option remains unavailable                               | Current plan and history remain unchanged                                             |
| Stale plan/review (`409`/`412`)                                     | Confirmation stops and reports stale authority                              | Reloads the plan/review before another choice                                         |
| Replacement requires comparison                                     | First confirmation prepares a DRAFT only                                    | A later explicit confirmation supplies the exact draft id/version                     |

## Owner contracts

| Action                            | Contract                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resolve comparison periods        | `GET /api/v1/reassessment-summaries/context`                                                                                                     |
| Reopen/create/replace self-report | current self-report GET, owner POST with idempotency, versioned PUT with `If-Match`                                                              |
| Resolve Journal evidence          | existing `/api/v1/longitudinal-analysis-jobs` request and job status                                                                             |
| Persist four-dimension snapshot   | `POST /api/v1/reassessment-summaries` with exact screening, period, Journal job and optional report identities                                   |
| Read plan review                  | `GET /api/v2/support-plans/{id}/adaptive-review` with current plan validator                                                                     |
| Keep/change                       | `POST /api/v2/support-plans/{id}/adaptive-review/confirm` with review fingerprint, option identity, strong plan validator and stable command key |

Strict Zod parsing and response identity checks fail closed for contract drift,
different periods, stale self-report revisions, a different plan revision, or a
different confirmed option.

## Verification and evidence status

Focused Jest coverage verifies reassessment owner transport, exact-period and
revision checks, the component journey, purpose-specific screening return, and
adaptive review request/confirmation headers. The existing Assessment and
SupportPlan component suites cover integration with their parent screens.

`.maestro/mb-664-reassessment-plan-review.yaml` is authored for the protected
synthetic staging fixture. It loads the real plan review, chooses the fixture's
approved option, confirms it, captures the final screen, and reloads authority.
Credentials and expected fixture text remain Environment secrets/inputs.

Per the Jira addendum, source and Maestro belong on `dev`, while the complete
native real-contract execution and its staging screenshot/video are pending the
MB-666 staging milestone. A local Android boot or screenshot is useful PR
evidence but must not be labelled as that staging E2E proof.
