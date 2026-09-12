# MB-273 initial-check release evidence

The canonical release runbook and go/no-go record is
`mentalbridge-backend/docs/sprints/mb-273-initial-check-release-readiness.md`.
This page records the frontend-owned executable evidence.

## Evidence modes

| Command                                  | Classification        | Runtime                                                                                              |
| ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run test:e2e:initial-check:fixture` | `fixture-browser`     | Production Next.js build with controlled Identity, Care, and Content fixtures                        |
| `npm run test:e2e:initial-check:service` | `service-integration` | Production Next.js build, real Care, disposable PostgreSQL, controlled Identity and Content fixtures |
| `npm run test:e2e:initial-check:live`    | `live-cross-stack`    | Approved deployed frontend/BFF and Care environment with two synthetic users                         |

The runner refuses live execution without explicit approval, environment and
commit identifiers, both synthetic credentials, and a safe target URL. Live
tracing is disabled to avoid retaining login payloads.

## Current result

- `fixture-browser`: PASS on 2026-09-11, one Chromium journey.
  The generated JSON currently identifies both commits as `working-tree` and
  must be regenerated at the reviewed commits for final sign-off.
- Full frontend fixture regression: PASS, 23 tests; the MB-273 mode-only test
  was correctly skipped by the generic runner.
- `service-integration`: PASS on 2026-09-11, one Chromium journey backed by the
  real Care service and disposable PostgreSQL Testcontainer.
- `live-cross-stack`: NOT RUN because no approved environment and synthetic
  credentials were supplied.
- Release decision: BLOCKED until the two non-fixture evidence classes and all
  repository/migration gates pass.

The fixture journey covers missing profile, validation, unauthorized state,
profile/consent creation, PHQ-9 and GAD-7, idempotent duplicate submission,
GAD-7 outage/retry, refresh/resume, optional-resource failure, safety-first
routing, foreign evidence rejection, saved-result reopening, HttpOnly journey
state, and storage/URL/console redaction assertions.

Generated fixture screenshots:

- [Desktop safety result](evidence/mb-273-fixture-result-desktop.png)
- [Mobile safety result](evidence/mb-273-fixture-result-mobile.png)
- [Sanitized persisted evidence](evidence/mb-273-fixture-persisted-evidence.json)

Generated service-integration evidence:

- [Sanitized persisted evidence](evidence/mb-273-service-persisted-evidence.json)
- Desktop/mobile screenshots are attached to the service-integration Playwright
  report rather than duplicated in Git; the deterministic visual output matches
  the fixture screenshots above.

These fixture and service-integration artifacts are not live-environment
evidence.
