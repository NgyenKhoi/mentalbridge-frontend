# MB-177 Care-backed PHQ-9 integration

## Delivered flow

The public `/assessment/anonymous` page and authenticated
`/assessment/phq9` page use the same contract-driven assessment component.
Both retrieve the current published PHQ-9 questionnaire from Care and submit
only its `questionnaireDefinitionId` plus exact `questionId`/`value` answers.
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

## Verification

- contract snapshot generation and drift check for Care and Identity;
- runtime parsers reject malformed questionnaires/results;
- BFF tests reject client-owned score/band fields and protect anonymous
  credentials;
- component tests cover Care-owned results and the unavailable-content state;
- Playwright covers completion and result reopening for anonymous and
  authenticated USER flows, including cookie/client-storage checks.
