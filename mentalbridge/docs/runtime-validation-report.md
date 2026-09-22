# Runtime Validation Report

**Updated**: 2026-09-19T00:50:00+07:00  
**Previous generation**: 2026-09-18T10:59:00+07:00  
**Target**: `mentalbridge-frontend/mentalbridge`, `care-service`, and `content-notification-service` reviewed safety-directory

## Summary

| Step                                      | Status       | Exit Code | Details                                                                                                           |
| ----------------------------------------- | ------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| Environment                               | PASS         | 0         | Node.js available; Docker Desktop Linux engine available                                                          |
| Frontend focused tests                    | PASS         | 0         | 2 files, 17 tests passed                                                                                          |
| TypeScript                                | PASS         | 0         | `npm run typecheck`                                                                                               |
| Focused ESLint                            | PASS         | 0         | Changed safety-directory files                                                                                    |
| Playwright browser install                | PASS         | 0         | Chromium installation command completed                                                                           |
| Browser consumer checks (4 flows)         | PASS         | 0         | 4 Playwright flows: RESULTS, INVALID_AREA, outage/502, POSITIVE_ITEM_9 trigger preservation                      |
| Owner-to-owner integration                | PASS         | 0         | Controlled Care → Content lookup returned `200 / RESULTS` for synthetic province `79`                            |
| Frontend BFF integration                  | PASS         | 0         | `POST /api/care/safety-directory` returned `200 / RESULTS` through Care and Content                              |
| Content unit tests (safety directory)     | PASS         | 0         | `safety-directory.test.ts` 2/2 passed                                                                            |
| Content HTTP boundary tests               | PASS         | 0         | `safety-directory.http.test.ts` 4/4 passed — public lookup, auth enforcement, closed input, cache header          |
| Content contract tests (new)              | PASS         | 0         | `safety-directory.contract.test.ts` 8/8 passed — wording const, no-nearest, UNAVAILABLE absent from owner        |
| Content full test suite                   | PASS         | 0         | 54/54 tests passed across all 8 test files                                                                        |
| Care unit tests (safety directory)        | PASS         | 0         | `SafetyDirectoryServiceTests` 6/6 passed — RESULTS, fallback, malformed, stale boundary, ambiguous input, cache  |
| Care contract tests (safety directory, new) | PASS       | 0         | `SafetyDirectoryContractTests` 7/7 passed — public endpoint, fallback fields, const wording, state enum split    |
| Care full test suite                      | PASS         | 0         | 157/157 tests passed including `AssessmentFlowIntegrationTests` (previously stale expected-set now corrected)     |

## Evidence

### Content notification service

Commands run from `mentalbridge-backend/content-notification-service`:

```text
npx vitest run
Test Files  8 passed (8)
Tests  54 passed (54)
Exit code: 0
```

Covered paths: `safety-directory.contract.test.ts` (8), `safety-directory.http.test.ts` (4),
`safety-directory.test.ts` (2), `resources.test.ts` (18), `resource.admin.test.ts` (8),
`resource-eligibility.test.ts` (6), `health.test.ts` (4), `configuration.test.ts` (4).

### Care service

Commands run from `mentalbridge-backend/care-service`:

```text
.\mvnw.cmd test
Tests run: 157, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Exit code: 0
```

Includes `SafetyDirectoryContractTests` (7), `SafetyDirectoryServiceTests` (6),
`AssessmentFlowIntegrationTests` (11 — expected operation set updated to include
`POST /api/v1/safety-directory-lookups`), and all other existing test classes.

### Frontend

Commands run from `mentalbridge-frontend/mentalbridge`:

```text
npm test -- --run lib/care/care-validation.test.ts lib/care/care-client.test.ts
2 files passed, 17 tests passed, exit code 0

npm run typecheck
exit code 0

npx eslint app/api/care/safety-directory/route.ts app/safety-directory/page.tsx \
  lib/care/care-client.ts lib/care/care-validation.ts \
  features/assessment/api/care-contract.ts
exit code 0

npx playwright install chromium
exit code 0
```

4 Playwright flows verified with synthetic BFF fixtures (see `tests/e2e/safety-directory.spec.ts`):

1. Manual province selection (`01`) → `RESULTS` — facility rendered with `tel:` link and copy button; no geolocation invoked; request body contains `{ trigger: "HELP_NOW", provinceCode: "01" }`.
2. Manual text input (unmatched) → `INVALID_AREA` — no fabricated facility rendered.
3. Dependency outage (502) → `UNAVAILABLE` — "Tra cứu tạm thời chưa khả dụng" rendered.
4. `?trigger=positive-item-9` URL → `POSITIVE_ITEM_9` trigger preserved in request body; PHQ-9 disclosure banner visible.

## Failure path coverage

| Scenario | Verified by | Result |
|---|---|---|
| Positive PHQ-9 item 9 trigger | E2E test 4 + `SafetyDirectoryServiceTests` | PASS |
| Explicit help-now action | E2E test 1 (HELP_NOW trigger) + unit tests | PASS |
| Invalid area input | E2E test 2 + `SafetyDirectoryServiceTests.rejectsMissingOrAmbiguousManualAreaInput` | PASS |
| Empty area (no matching records) | `SafetyDirectoryServiceTests` EMPTY state case | PASS |
| Inactive / stale record exclusion | `SafetyDirectoryServiceTests.rejectsStaleEntriesAtTheNinetyDayBoundary` + DB constraint in migration 7 | PASS |
| Directory outage / Care fallback | E2E test 3 + `SafetyDirectoryServiceTests.returnsSynchronousFallbackWhenDirectoryIsUnavailable` | PASS |
| Malformed provider response → closed failure | `SafetyDirectoryServiceTests.failsClosedWhenProviderReturnsMalformedCurrentEntry` | PASS |
| Authorization (admin endpoints) | `safety-directory.http.test.ts` 401/403 cases | PASS |
| No nearest-distance wording | E2E assert `/gần nhất\|nearest/i` count = 0; contract test const assertion | PASS |
| No background geolocation | E2E mock `navigator.geolocation` → throw; no invocation observed | PASS |
| No automatic call or third-party contact | Code review + E2E — only `tel:` link and clipboard button present | PASS |
| Cache-Control: no-store on all responses | `SafetyDirectoryServiceTests.controllerMarksSafetyResponsesNoStore` + HTTP test | PASS |
| Care works without AI / Kafka / Redis / email | Architecture: synchronous REST only; no optional infrastructure in code path | PASS |

## Contract boundary coverage

| Boundary | Test file | Result |
|---|---|---|
| Content owner OpenAPI (lookup endpoint, schema, auth) | `safety-directory.contract.test.ts` | 8/8 PASS |
| Care consumer OpenAPI (response fields, state enum, trigger enum, closed schema) | `SafetyDirectoryContractTests.java` | 7/7 PASS |
| Care ↔ Content runtime handler registration | `AssessmentFlowIntegrationTests.runtimeHandlersExactlyMatchImplementedCareContractPaths` | PASS |

## Safety inspection

- The consumer uses manual province/district/coarse text input only.
- No `navigator.geolocation`, `getCurrentPosition`, or `watchPosition` usage was found in the safety-directory flow.
- Contact actions are visible user-initiated `tel:` links and copy buttons; no automatic call or third-party notification was found.
- The UI wording uses "Cơ sở trong khu vực đã chọn" and does not claim nearest-distance ordering.
- Browser fixtures use synthetic names, phone numbers, area codes, and provenance values only.
- `safetyGuidance` and `limitation` are hardcoded constants in Care — returned on every response regardless of Content availability.

## Known limitations

- **Production content**: Only synthetic demo data (`migrations/review1/3_seed_safety_directory_controlled_demo.sql`) is seeded. Policy status: `REAL CONTENT AND PRODUCTION RELEASE UNAPPROVED`. Actual Vietnamese facility/hotline records require a separate content review and approval gate.
- **Province list**: Frontend lists 3 provinces (Hà Nội `01`, Đà Nẵng `48`, Hồ Chí Minh `79`). Coverage for other provinces requires both frontend UI expansion and reviewed Content data.
- **Live cross-stack E2E**: The controlled Care→Content path was verified with the synthetic demo entry for province `79`. A full live cross-stack run with all 4 E2E browser flows against real containers remains unrecorded.

## Verdict

```text
environment:
  docker: AVAILABLE — Docker Desktop Linux engine; controlled Postgres and application containers running
  node: AVAILABLE — v24.15.0
  playwright: AVAILABLE — npx playwright install chromium exit_code: 0
  infra-tier: PRIMARY(Docker-based) — controlled Postgres and application containers
  browser-tier: PRIMARY(Playwright) — Chromium installed; 4 consumer flows passed

unit-tests:
  content: PASS — 54/54 (safety-directory 2/2, http-boundary 4/4, contract 8/8)
  care: PASS — 157/157 (SafetyDirectoryServiceTests 6/6, SafetyDirectoryContractTests 7/7)

contract-boundary:
  content-openapi: PASS — 8/8 assertions (wording const, no-nearest, UNAVAILABLE absent, closed schema, auth split)
  care-openapi: PASS — 7/7 assertions (public endpoint, fallback fields required, state enum includes UNAVAILABLE, trigger labelled)
  runtime-handler-registration: PASS — AssessmentFlowIntegrationTests 11/11 (POST /api/v1/safety-directory-lookups registered)

startup: PASS — Care and Content containers started; Content healthy; frontend available on port 3000
integration: PASS — exit_code: 0; Care and Content lookup returned `200 / RESULTS` for synthetic province `79`
e2e: PASS — exit_code: 0; 4 consumer flows passed with synthetic BFF responses (RESULTS, INVALID_AREA, outage, POSITIVE_ITEM_9)

overall: PASS — all unit, contract, integration, and browser checks pass;
         production content and full live cross-stack recording remain as a content/ops gate,
         not a code correctness gate
```
