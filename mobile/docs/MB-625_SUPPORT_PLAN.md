# MB-625 mobile governed SupportPlan journey

## Delivered journey

The authenticated USER route `/(user)/support-plan` consumes the existing
Care-owned SupportPlan contracts. Mobile does not create plan state, infer
eligibility, calculate adherence/recovery, or treat cached data as lifecycle
authority.

The first screen prioritizes the authoritative current plan or draft, followed
by scheduled occurrences and terminal history. A specialist proposal can enter
through the existing `proposalId` deep-link parameter; the mobile client then
uses Care's review and decision contracts instead of applying a resource
change locally.

## Contract matrix

| User action                              | Care contract                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load current, draft and terminal history | `GET /api/v1/support-plans/current`, `GET /api/v1/support-plans/current-draft`, `GET /api/v1/support-plans/history`                              |
| Choose an admitted draft alternative     | `PUT /api/v1/support-plans/{supportPlanId}/choices` with `If-Match`                                                                              |
| Activate a draft                         | `POST /api/v1/support-plans/{supportPlanId}/activate` with `If-Match` and a stable `Idempotency-Key`                                             |
| Pause, resume, complete or discard       | `PUT /api/v1/support-plans/{supportPlanId}/status` with `If-Match`; UI exposes only transitions supported by the returned status                 |
| Review and apply a replacement draft     | current reassessment summary, replacement review, then `POST /api/v1/support-plans/{supportPlanId}/replace` with exact versions and a stable key |
| Load and record activity engagement      | `GET /api/v1/support-plan-occurrences`, `PUT /api/v1/support-plan-occurrences/{occurrenceId}/engagement` with `If-Match`                         |
| Review and decide a specialist proposal  | proposal-scoped PlanChangeRequest GET/POST and versioned decision PUT                                                                            |

Opening an external reviewed resource uses its returned URL only. It does not
write an occurrence, change a choice, or mutate plan lifecycle. SupportGuide
and SupportPlan remain separate product objects.

## State, cache and safety

- Query keys include the authenticated subject. Session logout clears the
  shared query cache through the frozen mobile session contract.
- Cached data is presentation-only. Mutations are considered successful only
  after a parsed server response; failed commands keep the last confirmed
  state.
- Occurrences remain visible for a paused plan, but every engagement control is
  read-only until Care confirms a successful resume to `ACTIVE`.
- `409` and `412` responses synchronously lock every governed command while
  current, draft, history, occurrence and proposal authority are refreshed. If
  any refresh fails, the lock remains until an explicit reload succeeds.
- Successful activation, lifecycle, replacement and PlanChange commands use the
  same lock until their follow-up authority refresh succeeds. Stable command
  keys are reset only after that reconciliation, never while stale controls are
  still visible.
- Activation, replacement and PlanChange review/decision reuse one command key
  across an ambiguous retry and reset it only after success or signature change.
- Occurrence completion, skip, helpfulness, barrier, reflection and bounded
  summary-reuse approval are labelled as self-reported engagement. The UI does
  not derive an adherence, clinical-outcome or recovery score.
- Loading, source-empty, partial occurrence/history failure, unauthorized,
  dependency failure, mutation failure and success remain distinct and
  recoverable. A partial dependency failure does not erase the current plan.

## Automated evidence

Run from `mobile/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build:bundle
```

Focused Jest coverage verifies strict response parsing, concurrency and
idempotency headers, empty/draft/active/paused/completed presentation, ambiguous
activation retry, paused occurrence read-only behavior, blocking stale and
post-success reconciliation, explicit recovery retry, occurrence engagement,
proposal decision, unauthorized actor and dependency failure.

## Android real-contract evidence

`.maestro/mb-625-support-plan.yaml` uses a protected staging USER fixture with
an authoritative active plan and at least one scheduled occurrence. It marks
the occurrence complete, leaves and reopens the route to prove the persisted
completion, reopens the occurrence, and reloads again to prove the restored
scheduled state.

The staging fixture must be resettable and must not contain production personal
data. Its credentials are supplied only through
`MB_SUPPORT_PLAN_USER_EMAIL`/`MB_SUPPORT_PLAN_USER_PASSWORD` GitHub Environment
secrets. The sanitized artifact contains the commit, run URL, final screenshot
and journey classification, but no credential, reflection or health payload.
