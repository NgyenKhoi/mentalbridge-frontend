# MB-693 web Community safety QA

## Continuation after MB-688

Frontend baseline: `8183da7` (merged MB-688 #215). Backend QA branch:
`5ab0d84b` / backend draft #219, based on runtime `d53fc722`. Owner: Thao Nguyen.
The [backend permission matrix](https://github.com/NgyenKhoi/mentalbridge-backend/blob/5ab0d84b8760a181853813eac36b6b270772f590/docs/story-mb-693-community-safety-qa.md)
defines current permission, history, notification and moderation boundaries.
Real Android execution remains in MB-666, as agreed with the owner.

Ordered slices:

1. Fix the observed notification integration gap: chat kinds currently fail
   web response validation, and backend canonical chat links lack web routes.
   Accept only exact owner-defined type/target/href combinations, map to the
   existing Community inbox/thread and reauthorize there. Add focused parser,
   route and request-tab regression tests. No new visual direction or API.
2. Author a repeatable isolated web/service safety run with two synthetic USER
   sessions, current Identity and Community, real notifications and a real-owner
   Realtime probe. Use disposable infrastructure and ephemeral signing keys;
   no developer env files or shared dev/staging databases. Cover invitation
   consent, membership revocation/rejoin, revisions, retry, block, exact-message
   reporting and notification navigation. Record actual limits separately from
   fixture tests and native device execution.
3. Run focused checks, the affected frontend quality gate and browser journeys;
   capture synthetic screenshots and redacted result metadata. Update backend
   #219 evidence and open the frontend MB-693 review PR with the exact SHA pair.

4. Fix the reproduced ownership-transfer presentation bug: the command returns
   group metadata, so fetch the current conversation projection and replace the
   selected conversation only when its ID still matches. Render the backend's
   viewer role immediately; do not infer permissions from a successful command.

The additive Identity snapshot is isolated in frontend prerequisite
[#221](https://github.com/NgyenKhoi/mentalbridge-frontend/pull/221), per CODEOWNERS.
It overlaps #214's generated Identity files; the integrator must choose merge
order and regenerate from the intended merged provider, never hand-resolve them.

The feature shell and existing MB-688 controls remain the UI baseline. Narrow
navigation/state repairs are integration fixes, not a redesign. New evidence
must not claim web realtime delivery merely from a Node socket probe.

## Acceptance ledger

| Boundary                                    | Current status                   | Executed proof                                                                                                                        |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Chat notification parsing / canonical links | LOCAL_SERVICE_PASS               | Parser/route/consent regressions plus real generic request, invitation and message notice navigation                                  |
| Pending invitation                          | LOCAL_SERVICE_PASS               | Invitee history and members return 404 before acceptance; consent page has no composer                                                |
| Group current membership / rejoin           | LOCAL_SERVICE_PASS               | Removed B cannot read/send/acknowledge/report; old cursor fails after rejoin and old-epoch messages remain absent                     |
| Stale management revision                   | LOCAL_SERVICE_PASS               | A2 changes role; stale A removal gets conflict and does not remove B; fresh revision succeeds                                         |
| Ownership transfer                          | LOCAL_SERVICE_PASS               | Reproduced stale OWNER controls; fixed current viewer projection; old owner loses archive/transfer controls without a page reload     |
| Direct block / retry                        | LOCAL_SERVICE_PASS               | Abort response after real 201, same client ID retry produces one message; B's block denies all three contexts and stale target/report |
| Notification E2E                            | LOCAL_SERVICE_PASS               | Real Content notice opens an authorized target; revoked canonical target shows generic unavailable with no group name/content         |
| Real Community → Realtime                   | LOCAL_SERVICE_PASS (Node probes) | Two B sockets receive eligible message, invalidate on removal and receive no later message after A's positive delivery barrier        |
| Web automatic realtime / reconnect UI       | KNOWN_LIMIT                      | No Community socket consumer in the current web workspace; manual history reload is explicit                                          |
| Native Android                              | TEST_AUTHORED_NOT_RUN            | MB-666 approved APK/edge batch                                                                                                        |

No E2EE or professional emergency-response claim. No generic moderator transcript
access is introduced. Only isolated synthetic fixtures may be reset.

## Reproduce the isolated browser/service run

Prerequisites: Java 21, Node 24, Docker Linux engine and Playwright Chromium.
Build from the reviewed backend checkout, without loading developer env files:

```powershell
# Backend identity-service and community-service, each:
./mvnw.cmd -DskipTests package
# Backend content-notification-service and realtime-service, each:
npm ci
npm run build
# Frontend mentalbridge/:
npm ci
npx playwright install chromium
npm run build
$env:MB693_BACKEND_DIR = '<absolute reviewed backend checkout>'
# Optional when Java 21 is not on PATH:
$env:MB693_JAVA = '<absolute java executable>'
node scripts/run-community-safety-e2e.mjs
```

The runner creates three PostgreSQL 17 databases, Kafka 7.8/KRaft, Redis 7.4 and
MongoDB 7 containers. It boots real Identity (existing synthetic e2e seed),
Community, Content, Realtime and the production Next standalone server on random
loopback ports. No shared stack/database, `.env`, paid provider, real account or
clinical data is used. Unrelated providers are closed loopback endpoints. Child
environments are allowlisted and keys/passwords are ephemeral. Only runner-owned
processes/containers are stopped in cleanup.

Relative BFF setup calls use `fetch` in the authenticated browser so Chromium
sends the production Secure HttpOnly cookie on localhost. Playwright's separate
request context does not share that loopback Secure-cookie behavior. Cookie
policy is unchanged. Native socket probes use real Identity login and the native
USER credential exchange; credentials remain in test process memory.

`playwright.community-safety.config.ts` is opt-in; it does not add live service
execution to the normal `dev` gate. It runs three serial journeys with two USER
accounts, three browser contexts (A/A2/B), two recipient socket probes and a
sender barrier probe. Tracing/video are off. The runner writes redacted local
logs and exact SHA metadata to ignored `test-results/mb693-runtime/`, and browser
failure artifacts to ignored `test-results/mb693-browser/`. It scans exercised
service stdout/stderr for the synthetic secret/password, JWT and chat canary.
This is bounded evidence for these paths, not an audit of every deployment log.

## Executed evidence — 2026-10-22

Runtime source pair: frontend `ae0c86ad6bf6ffa793ae3b9cbfb87bb8a06e0b10`,
backend `5ab0d84b8760a181853813eac36b6b270772f590`. The latter changes only QA
tests/docs from merged runtime `d53fc722`. The harness/screenshots are the QA
delivery slice committed after the runtime pair; no runtime source changed after
the final build. Windows, Java 21, Node 24.19, Docker Linux and Chromium.

| Command                                                                         | Result                                                                                                               | Boundary                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run quality` with explicit reviewed provider paths                         | Exit 0; format, lint, typecheck, contracts, Realtime contract/budget, **1,887 tests / 285 suites**, production build | Complete frontend dev gate after ownership fix                                             |
| `vitest run features/community-chat/components/CommunityChatWorkspace.test.tsx` | Exit 0; **22 tests**                                                                                                 | Selected role refresh plus existing chat behavior                                          |
| `node scripts/run-community-safety-e2e.mjs`                                     | Exit 0; **3 passed / 0 skipped**, 26.4s browser phase; all five services ready; cleanup completed                    | Real Identity/BFF/Community/Kafka/Content/Realtime as described above                      |
| Exercised service-output scan                                                   | Pass                                                                                                                 | No synthetic password/service key, JWT or raw chat canary in captured runtime service logs |

The [safe execution excerpt](evidence/mb-693-local-execution.txt) contains only
allowlisted readiness/test-summary lines and SHA metadata. Full redacted runtime
logs stay local in the ignored directory; no cookies, credentials or trace archive
are published.

Reviewed synthetic full-frame captures:

- [Authorized current-epoch group history](evidence/mb-693-group-authorized.png).
- [Revoked target, generic unavailable state](evidence/mb-693-group-revoked.png).
- [Rejoined history and exact-message report, 390px web](evidence/mb-693-group-rejoined-mobile.png).

Earlier attempts identified and corrected harness setup issues (required synthetic
Brevo settings, disposable Redis health, Secure-cookie test transport and actual
button labels). A real run then failed the ownership-control regression (**2
passed, 1 failed**); the focused fix and final full run above passed. An earlier
production build failed the existing Turbopack Google-font cache query; clearing
only this worktree's `.next/cache` and rerunning the standard build resolved it.
No font/configuration or cookie policy was changed. Existing Vitest/jsdom warnings
and KafkaJS's timer warning remain visible; no assertion or quality gate was
disabled. The final full quality command passed without a build workaround.

## Limits and follow-up

- The web chat workspace currently uses REST and does not subscribe to Community
  sockets. Browser history is explicitly reloaded in the test; immediate live
  message/role/revocation UI and browser reconnect are **not proved**. The real
  Realtime assertions are Node client probes against current owner authorization.
- The tested topology has one Realtime process. Cross-replica presence/reconnect
  is covered separately by the backend 22-test integration run with a Community
  fixture; do not combine those results into a claim of live browser multi-replica
  coverage.
- Native Android/public edge remains MB-666. The 390px screenshot is Chromium
  responsive web, not an Android device run. No actual PUSH provider is exercised.
- Spam budgets, seat/owner races, report encryption/isolation, quiet-hours delay
  and queued-notice revocation use the named backend suites in #219; these browser
  cases do not duplicate their full matrices.
- Preserve MB-693 In Progress while the deferred client/release evidence remains
  open. No `ui-ready` or native end-to-end claim is made by this PR.
