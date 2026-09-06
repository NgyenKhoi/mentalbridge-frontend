# MB-177/MB-178/MB-205 Care-backed screening, history, and progress integration

## Delivered flow

The public `/assessment/anonymous` page and authenticated
`/assessment/phq9` page use the same contract-driven assessment component.
Both retrieve the current published PHQ-9 questionnaire and the backend-owned
`privacy-capstone-v1` disclosure from Care. A submission contains the exact
disclosure version/acknowledgement plus its `questionnaireDefinitionId` and
exact `questionId`/`value` answers.
Care remains authoritative for total score, screening level, item-9 safety
status, scoring version, and safety-policy version.

The browser does not contain a score calculator, score-band thresholds, item-9
policy, questionnaire wording, hotline catalogue, or generated clinical
recommendations. Missing reviewed questionnaire or support content is shown as
unavailable rather than invented.

## Trust boundaries

- `CARE_API_BASE_URL`, timeout, and questionnaire locale are server-only.
- Browser requests terminate at the same-origin `/api/care/*` BFF.
- The Identity JWT is read/refreshed only by the BFF before authenticated Care
  calls; it is never returned to React.
- Care's anonymous `sessionToken` and `sessionId` response is consumed only by
  the BFF. The values are placed in `HttpOnly`, `SameSite=Lax`, secure-in-
  production cookies and are never included in a browser JSON response,
  rendered HTML, URL, local storage, or session storage.
- The most recent assessment identifier is an `HttpOnly` navigation hint. Care
  still enforces ownership using the JWT or anonymous bearer credential.
- Authenticated profile, consent, owned history, and exact-result reads use the
  same session-resolving BFF boundary. React never supplies an account ID.
- Idempotency keys are generated per browser attempt and forwarded by the BFF.
  Repeated submission with a conflicting body remains a Care-owned `409`.

## Error and policy behavior

The BFF preserves stable Problem Details codes while replacing upstream detail
with bounded public titles. The UI distinguishes validation, conflict,
anonymous-session expiry, forbidden access, rate limiting, and Care
unavailability. A dependency failure never claims that answers were saved.

Care publishes `phq9-vi-vn-capstone-v1` for controlled local/demo use. The
definition contains the exact versioned questions, response labels, score bands,
item-9 marker, archived source URI, and artifact checksum. A real local run now
loads that definition through the default `vi-VN` request. Production
language/domain approval remains a separately tracked deployment gate.

Care currently returns score/band/safety provenance but no approved support
resource catalogue. The result page therefore shows an explicit unavailable
message and does not infer urgency, promise monitoring, notify a third party,
or display a hotline. It also states explicitly that MentalBridge does not
provide emergency response or continuous human monitoring.

## MB-178 profile, consent, history, and reassessment

- `/profile` reads and replaces the JWT owner's Care profile using the returned
  optimistic version. A stale update fails explicitly and is never presented as
  saved.
- The privacy section renders title, content, and version received from Care.
  It exposes only `PRIVACY_POLICY`; grant and revoke append new decisions.
- Revoking the current policy blocks new authenticated assessment processing
  but does not claim to delete historical data. The separate deletion workflow
  is visibly unavailable.
- `/assessments` renders cursor-paginated, owner-scoped summaries from Care.
  It has no mock history and does not expose raw answers.
- “Xem lại” opens the exact immutable owned assessment. “Làm bài mới” creates a
  new submission and never overwrites the earlier result.
- Anonymous sessions use Care's 30-minute sliding inactivity deadline with a
  two-hour absolute maximum. Their result is never attached to registration.
- Registered history is controlled-Capstone/test/demo behavior only; the UI
  makes no production retention or deletion-SLA claim.

## MB-205 descriptive assessment progress

- An authenticated USER selects one owned history result and requests progress
  through the same-origin BFF. The browser never supplies an account ID or sees
  the Identity access token.
- Care chooses the immediately preceding non-voided result with the same
  instrument and identical scoring version using deterministic submission-time
  and assessment-ID ordering.
- The response contains previous/current identifiers, questionnaire versions,
  timestamps, scores and screening levels plus raw signed delta, arithmetic
  direction, band transition and ISO 8601 elapsed duration.
- The UI says only that the score increased, decreased or did not change. It
  does not claim recovery, clinical improvement/worsening, treatment response,
  causation, diagnosis or resolved safety risk.
- Insufficient compatible evidence, unauthorized/missing ownership, malformed
  requests, timeout, invalid upstream data and Care unavailability are distinct
  accessible states. A progress failure does not hide or mutate an assessment
  result and causes no AI, Kafka, notification, specialist, billing or follow-up
  behavior.
- Anonymous sessions have no progress BFF route or longitudinal UI.

## Verification

- contract snapshot generation and drift check for Care and Identity;
- runtime parsers reject malformed questionnaires/results;
- BFF tests reject client-owned score/band fields and protect anonymous
  credentials;
- component tests cover Care-owned results, profile/consent, history/reopen,
  descriptive progress and every explicit progress failure state;
- Playwright covers completion and result reopening for anonymous and
  authenticated USER flows, including authenticated progress and
  cookie/client-storage checks.

### Managed local MB-205 journey

Prerequisites are Java 21 or newer, Node/npm, Docker Desktop and the sibling
checkout layout `mentalbridge-backend` plus `mentalbridge-frontend/mentalbridge`.
No `.env`, webhook, cloud account, public tunnel, production credential or
external API is required. From the frontend application directory run:

```powershell
npm run contracts:sync
npm run build
npx playwright test tests/e2e/care-assessment.spec.ts --workers=1
```

Playwright starts the deterministic Identity session fixture, Care's
`TestCareServiceApplication`, a disposable PostgreSQL Testcontainer and the
production Next server on loopback-only ports. The Care test application seeds
only synthetic profiles and consent; the browser creates the assessments
through the real published questionnaire/submission APIs. Test-only controls
advance a mutable UTC clock and inject one-shot timeout, 503 and malformed
progress responses. The same journey covers insufficient, incompatible,
voided, forged/cross-owner and authoritative-result visibility behavior.

Successful comparison evidence is stored in
[`evidence/mb-205-progress-desktop.png`](evidence/mb-205-progress-desktop.png)
and [`evidence/mb-205-progress-mobile.png`](evidence/mb-205-progress-mobile.png).
The screenshots contain synthetic score/version/timestamp facts only; bearer
tokens and raw answer payloads are never rendered.
