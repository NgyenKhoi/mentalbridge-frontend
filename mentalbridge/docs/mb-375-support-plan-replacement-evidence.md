# MB-375 SupportPlan replacement UI evidence

## Actor journey

- The SupportPlan page loads the authoritative current plan and any persisted replacement draft independently; the current plan stays visible and usable throughout review.
- A replacement draft is created only after a current `reassessment-summary-v2` can be loaded.
- The browser sends only persisted plan IDs/versions and the exact summary ID to the BFF. Care supplies the three-state outcome, rationale, exact current/proposed resource comparison, and all reassessment evidence.
- The review presents screening, Journal context, plan engagement, and explicit self-report as four separate cards with their periods and provenance. It states that reassessment informs the decision but does not itself mutate a plan or create an overall verdict.
- Replacement requires a separate explicit confirmation. The BFF forwards `If-Match` and `Idempotency-Key`; stale, unavailable, entitlement, and concurrency failures keep the existing current plan in place.
- After success the UI reloads the authoritative state/history, where the previous plan remains immutable as `SUPERSEDED`.

## Implementation

- BFF routes: current reassessment summary, replacement review, and replacement confirmation.
- Runtime validation: `parseSupportPlanReplacementReview` rejects malformed Care responses.
- Generated types and the committed Care OpenAPI snapshot are synchronized with the backend contract.
- `ReassessmentJourney` links the completed snapshot to the SupportPlan review; no client-side re-scoring or outcome inference is present.

## Verification

- Full frontend quality gate passes: formatting, lint, route generation/typecheck, generated contract checks, 94 test files / 439 tests, and the production build.
- SupportPlan actor coverage includes keeping the current plan active until explicit confirmation and reconciling terminal concurrency conflicts from authoritative current/history state.
- Full Care service suite passes 212 tests, including 21 `SupportPlanIntegrationTests` against PostgreSQL/Testcontainers.
