# MB-623 consultation journey closure

The authoritative [state and settlement map](https://github.com/NgyenKhoi/mentalbridge-backend/blob/0715900991260b6fad754c474d052b04094d119e/docs/policies/consultation-journey-state-map-v1.md)
is `consultation-journey-v1`. This story verifies the existing consultation
journey; it adds no UI redesign, appointment aggregate, business transition,
public API, migration or CI requirement.

## Reproduce the controlled browser journey

Use the paired backend MB-623 branch, Docker for disposable PostgreSQL, Java 21,
Node and the frontend's locked dependencies. Do not use shared dev data or copy
local secrets. From this `mentalbridge/` directory:

```powershell
npm.cmd ci
npm.cmd run quality
npm.cmd run test:e2e:install
```

From the paired backend root:

```powershell
$env:SPRINGDOTENV_ENABLED = 'false'
mvn.cmd -q -f consultation-service/pom.xml test '-Dtest=ConsultationJourneyIntegrationTests#productionBrowserBffAndRealConsultationPreserveTheWholeJourney' '-Dmb623.frontend=E:/mentalbridge-repo/mb623-frontend/mentalbridge' '-Dmb623.backend=E:/mentalbridge-repo/mb623-backend' '-Duser.timezone=UTC'
```

Replace both absolute checkout paths. Linux uses `mvn`/`npm`; an installed
Chrome may be selected with `PLAYWRIGHT_BROWSER_CHANNEL=chrome`.
The backend test starts real Consultation HTTP and PostgreSQL, provides an
ephemeral synthetic Identity/current-account fixture and invokes
`scripts/run-consultation-journey.mjs` through bounded stdin. The runner rejects
non-loopback roots, URL credentials/query strings and malformed input before
starting a server or browser. It uses production Next.js/BFF on loopback port
3197, not the developer's app on port 3000. The fixture advances its own clock
across existing boundaries without changing production booking rules.

## Coverage and evidence boundaries

| Executed boundary                             | Assertions                                                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery → booking → Specialist confirmation | Approved profile, exact 60-minute slot, browser commands, one held credit, idempotent replay, persisted confirmation                                                   |
| Trusted evidence → end → settlement           | Timer-only end remains uncompleted with credit held; production settlement creates exactly one completion/consumption/earning                                          |
| Completed continuation                        | Specialist publishes bounded summary; USER edits a private next step and one rating through UI; reload preserves both and Specialist cannot read private state/consent |
| Exceptions                                    | Replayed cancellation releases once, witnessed Specialist no-show has no earning, dispute adjustment preserves immutable completion and consumption                    |
| Authorization / dependencies                  | Outsider denied; contract-valid Care unavailability remains unavailable; video explicitly capability-disabled                                                          |
| Existing UI rendering                         | Synthetic desktop/mobile screenshots, font readiness, no horizontal overflow or uncaught page error                                                                    |

The local runner writes only sanitized checks, source revisions/dirty flags,
timestamps and synthetic screenshots to ignored
`test-results/mb623-consultation/`. It never retains cookies, JWTs, fixture keys,
request/response bodies or browser traces. A failed run is not success evidence.

This is **service integration with a production browser**, not full deployed
E2E: Identity login is synthetic, trusted chat evidence is injected through the
real internal HTTP contract rather than a live WebSocket, and Care is a
controlled outage. Real Care Brief/proposal owner tests are executed separately.
It proves neither enabled LiveKit, Android, actual payment/payout nor all owners
running together. No protected staging/mobile setup is required or changed.

The normal dev CI remains unchanged: frontend quality and mobile TypeScript.
The cross-stack browser test is explicitly opt-in; ordinary CI skipping it does
not count as execution. See the paired
[backend runbook](https://github.com/NgyenKhoi/mentalbridge-backend/blob/0715900991260b6fad754c474d052b04094d119e/docs/runbooks/mb-623-consultation-journey.md)
and PR verification for executed commands, results and limitations.

## Local verification checkpoint — 2026-10-15

- Production-browser journey: executed successfully, six journey checks and
  synthetic screenshots at 1440/375px. The final rerun manifest records both
  exact committed revisions and clean-state flags; PR verification names them.
- Runner guard regression: 4 tests passed. Frontend format/lint/TypeScript and
  public/Realtime contract checks passed; 237 files / 1,339 unit tests passed.
- `npm run quality` reached build and failed on Windows Turbopack's
  `@vercel/turbopack-next/internal/font/google/font` import-map resolution.
  The unchanged default `npm run build` passed in Linux Docker. The official
  Windows `next build --webpack` alternative plus
  `node scripts/prepare-standalone.mjs` also passed and supplies this local
  browser run. No dependency/configuration/gate was weakened to hide the first
  failed attempt. Linux CI remains the required exact-head quality gate.
- Paired Consultation module: 232 discovered / 229 passed / 3 opt-in skipped,
  zero failures/errors. Real Care Brief: 9 passed; exact Specialist proposal
  review/acceptance: 1 passed. These owner tests are not a claim that Care ran
  together with Consultation in the browser fixture.
