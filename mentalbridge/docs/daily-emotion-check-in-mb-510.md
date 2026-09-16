# MB-510 daily emotion check-in delivery evidence

## Product and contract decisions

- The dashboard supports one self-reported emotion check-in per account and
  local calendar day.
- Allowed emotions are `GREAT`, `GOOD`, `OKAY`, `LOW`, and `VERY_LOW`.
  Intensity is the strength of the selected feeling from 1 to 5; it is not a
  health score. The optional private note is limited to 500 characters.
- The browser submits its IANA timezone and local date. The Journal/AI owner is
  authoritative for date validation, ownership, idempotency, optimistic
  concurrency, deletion, and retention.
- All user-facing history is labelled as self-reported. It does not claim to
  diagnose, classify safety, measure recovery, or reward streaks.
- Browser access uses the existing same-origin BFF and HttpOnly session. The
  generated types are derived from the Journal/AI OpenAPI source.
- The raw optional note is only rendered back to its owner. Consumer
  minimization and consent are enforced by the Journal/AI service; the
  frontend does not expose a consumer forwarding route.

## Observable states

The dashboard renders persisted loading, empty, saving, saved, update-conflict,
dependency-error, history, and deletion states. A failed save retains the
draft and reuses the same idempotency key for a safe retry. A `409` or `412`
reloads the authoritative record before allowing another edit.

## Verification evidence

These results were recorded on 2026-09-16 against the synced backend contract.

| Evidence                                    | Command                                                                         | Result                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Contract and generated types                | `npm run contracts:check`                                                       | Passed; all snapshots and generated types valid                         |
| Unit, BFF, transport, and component         | `npm run test:unit`                                                             | Passed: 289 tests, 0 failed                                             |
| Formatting, lint, and type safety           | `npm run format:check && npm run lint && npm run typecheck`                     | Passed, zero warnings                                                   |
| Production build                            | `npm run build`                                                                 | Passed; 52 static/dynamic routes generated                              |
| Managed browser E2E with synthetic fixtures | `node scripts/run-e2e.mjs emotion-check-in.spec.ts --workers=1 --reporter=line` | Passed: 2 tests, 0 failed                                               |
| Live deployed cross-stack E2E               | Not executed locally                                                            | Requires a deployed environment and test identity; no result is claimed |

The browser fixture uses only synthetic text. Provider integration tests in the
Journal/AI repository cover real HTTP persistence against an ephemeral MongoDB
instance, including wrong-owner access, duplicate/concurrent saves, timezone
boundaries, consent withdrawal, deletion, and dependency failure.
