# MB-762 Web AI Voice QA

Jira: [MB-762](https://vunguyenkhoi47.atlassian.net/browse/MB-762).
Owner: Thảo Nguyên Trần. Scope: Web demo verification before mobile integration.

## Brainstorm and implementation boundary

Start from frontend dev `1f95192521e207e4a40f75685da9c62eb2069917`
(MB-761) and backend dev `497b4889297ae5bd31b799c15d9005e928d163c6`
(MB-782). Both prerequisites are now merged. Preserve their product UI,
authorization, quota, consent and provider-enablement rules.

1. Extend the existing lifecycle and BFF tests for admission races/denials,
   terminal-state reconnect, caller isolation and sanitized downstream failures.
   Reuse owner implementations; a simulated frontend response does not prove
   atomic global capacity or real speech quality.
2. Add production-browser tests for the actual BFF's closed request surface
   and simulated admission failures using an explicitly silent synthetic
   MediaStream. Assert capture stops and text/help remain available.
3. Prepare a closed, bounded, content-free operator manifest and reproducible
   [live runbook](mb-762-web-voice-runbook.md). Missing readiness stays blocked.
   Deterministic tests use the existing unit CI lane; browser regression also
   joins the existing staging suite. No new workflow or dependency is required.

No new visual direction is introduced, so no Stitch generation is needed for
this QA task. The local real-stack checkpoint below uses the separate backend
prerequisite PR; this frontend PR does not deploy Cloud infrastructure or enable
provider admission.

## Live status

**REAL_PROVIDER_NOT_RUN; local preflight implemented.** Jira comments 10247–10255
approve a conditional MB-762 budget of $1 total ($0.50 existing LiveKit credit,
$0.50 eligible AWS credit), Xia voice and local-first execution. The earlier
MB-760 benchmark budget remains separate. One volunteered reader is
owner-reported; real microphones, device quality and dialect coverage remain
unmeasured. No final `LIVE_APPROVED` has been given.

Actual account evidence in comment 10254 does not expose numeric LiveKit
remaining or explicit Bedrock Applicable Products. These facts remain unknown;
they are not zero and must not be marked PASS. Official Build hard caps and AWS
Free-account no-charge restrictions are documented separately in backend
[PR #240](https://github.com/NgyenKhoi/mentalbridge-backend/pull/240), with scoped
Sonnet routing, runtime ceilings and remaining live gates. No plan upgrade or
uncredited payment is permitted.

The [initial manifest](mb-762-initial-manifest.json) records public prerequisite
source heads, zero tool provider calls, zero human/device/dialect measurements,
unknown spend and all real scenarios NOT_RUN. This is a preparation record,
not a completed real-cloud demonstration. The reporter never opens a network
connection, starts a browser/call, changes flags or enforces a provider budget.
It only checks the consistency of operator-supplied observations. Successful
manual reports are labelled `OPERATOR_REPORTED_PASS`, never independently
verified PASS. Source heads must match the deployment actually tested.

## Acceptance and evidence map

| Requirement                                         | Deterministic boundary in this PR                                             | Live evidence still required                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| FREE, PLUS, PREMIUM and finite preview              | Existing contract/UI checks plus denial propagation                           | Real owner entitlement, both current Care consents, spoken reply for each paid tier        |
| Two owners admitted, third and same owner denied    | Frontend stops capture on owner capacity/session denial                       | Two simultaneous audible Cloud sessions; real third/same-owner API denial                  |
| Independent text and Consultation credit accounting | Reporter requires all three before/after quota snapshots to close manual gate | Capture owner counters around Voice-only controls; no text/credit decrement                |
| Revocation, entitlement loss, end/idle/deadline     | Lifecycle terminal-state matrix and no reconnect grant afterward              | Observe worker cutoff and provider teardown, including both consent types separately       |
| Provider 429/offline and reconnect/stale token      | BFF errors retained without private detail; no automatic admission retry      | Authorized environment fault injection, no inference after loss of authority               |
| Wrong role/user, internal/transcript surface        | Actual BFF negative browser checks; separate caller credentials in BFF tests  | Real owner JWT/grant isolation; do not preserve token bodies                               |
| Consultation separation                             | Closed BFF rejects room/owner/package selectors                               | Dedicated AI room/dispatch and no appointment/financial mutation                           |
| vi-VN pauses/noise/barge-in                         | No synthetic test claims speech accuracy                                      | Consenting scripted readers, actual device, noise on/off, final-only turn and interruption |
| Captions/text fallback                              | Text/help continuation after simulated failures                               | Captions remain unsupported; confirm no caption channel is advertised                      |
| Privacy/retention                                   | Closed manifest rejects content, tokens, private URLs and unknown fields      | Account/deployment/storage audit and confirmed room/agent cleanup                          |

Backend source coverage is referenced, not newly executed by this frontend PR:
[ledger Mongo integration](https://github.com/NgyenKhoi/mentalbridge-backend/blob/497b4889297ae5bd31b799c15d9005e928d163c6/journal-ai-service/src/companion-voice/voice-ledger.mongo.integration.test.ts)
already contains atomic two-owner/one-owner and two-process final-slot tests;
[session integration](https://github.com/NgyenKhoi/mentalbridge-backend/blob/497b4889297ae5bd31b799c15d9005e928d163c6/journal-ai-service/src/companion-voice/voice-sessions.mongo.integration.test.ts)
covers trusted playback, idle/renewal/reconnect and provider cleanup;
[turn integration](https://github.com/NgyenKhoi/mentalbridge-backend/blob/497b4889297ae5bd31b799c15d9005e928d163c6/journal-ai-service/src/companion-voice/voice-turn.mongo.integration.test.ts)
covers both consent withdrawals, partial/invalid STT, replica fencing and context loss.
Those tests do not replace the live evidence in the table.

## Verification

### Local real-stack checkpoint, 2026-10-29

- Web, Identity, Care, Consultation and Journal/AI use real local Docker-backed
  databases and private env files outside the repository. No service/API/media
  response was intercepted for the consent flow.
- One synthetic ADMIN, two USERs and PLUS/PREMIUM source-DEMO grants were
  provisioned within PO comment 10255. Care profiles were created through each
  USER's authenticated public API, with no DOB or health data.
- Both USERs logged in through the real Web/Identity flow. Each UI displayed the
  current AI and independent Voice disclosure before recording the grant via
  Care (AI 201, Voice 200). The dialog then showed provider unavailable while
  admission stayed OFF. Zero session-creation requests or microphone/provider
  calls were made. These are controlled synthetic UI consent grants, not proof
  of human speech or live audio.
- The first browser attempt exposed a pre-hydration login fallback issue:
  without the client handler, a form used GET and put fixture credentials in
  its navigation query. Both temporary fixture passwords were rotated, refresh
  sessions revoked and diagnostics redacted. `LoginForm` now explicitly uses
  POST; the no-JavaScript browser regression proves credentials stay in the
  body and the navigation URL has no query. Ordinary client login still passes.
- After refreshing dev, the full frontend gate passed 323 files / 2,511 tests
  and production build. The focused auth tests and browser privacy regression
  cover the subsequently added one-attribute security fix; CI reruns on its head.

### Initial deterministic checkpoint

| Command                                                                                                                       | Result                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run format:check`, `npm run lint`, `npm run typecheck`                                                                   | PASS                                                             |
| `npm run contracts:check`, `npm run contract:check`, `npm run companion:budget`                                               | PASS                                                             |
| `npm run test:unit -- --maxWorkers=2`                                                                                         | PASS, 317 files / 2,460 tests at the full-gate checkpoint        |
| `npm run build`                                                                                                               | PASS, production standalone                                      |
| `npm run test:e2e -- tests/e2e/ai-voice-qa.spec.ts tests/e2e/ai-voice.spec.ts tests/e2e/ai-companion.spec.ts --reporter=line` | PASS, 12 Chromium tests: 5 MB-762 + 5 existing Voice + 2 AI Text |
| Focused Voice/reporter tests after final manifest refinement                                                                  | PASS, 77 tests in 6 files                                        |
| Required PR `quality-gate`                                                                                                    | Must pass on published head before handoff                       |

The full non-browser gate ran once because repository rules require it before
delivery. The final manifest refinement records the independent worker SHA,
separates reader count from USER contexts and rejects dialect overclaims;
focused tests and targeted lint/format cover those changes without repeating
the complete suite. CI validates all tests on the published head.

No live microphone, LiveKit media, STT/TTS/Claude inference, recording, Android
hardware or paid call has run. Read-only Cloud metadata and real synthetic-user
consent UI checks do not establish call proof. Live scenarios remain NOT_RUN;
no Jira Done/closure, merge or provider activation is implied by CI.
