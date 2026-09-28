# MB-363 approved specialist discovery consumer evidence

## Scope

The frontend consumes the Consultation-owned discovery contract through
USER-only same-origin BFF routes. It renders a real list, server-backed filters,
fresh detail, ranking explanation, and exact 60-minute `IN_APP_CHAT` or
feature-gated `IN_APP_VIDEO` slots. Opening a profile performs a new detail
request so approval and availability changes fail closed at the owning service.

FREE is browse-only. PLUS and PREMIUM can hand the exact returned slot ID and
modality to the existing MB-378 appointment request; MB-378 remains responsible
for the current entitlement and credit decision. The consumer never infers
approval or reconstructs a slot.

## Privacy and product boundaries

The strict response parser reconstructs only the approved public discovery
shape. Unknown upstream properties are discarded before they reach the UI.
Tests include synthetic prohibited properties for phone, price, credentials,
practice location, external meeting URL, assessment answers, Journal content,
and chat content and prove they are absent from the parsed result.

The UI contains no static specialist fixture, physical or telephone mode, fake
price, unsupported credential/specialty, rating display, or external-meeting
affordance. Ranking copy describes only screened support-area compatibility,
language, selectable availability, and timezone. It makes no diagnosis or
clinical matching claim.

## Consumer evidence

| Requirement                                       | Evidence                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real list, filter, detail, explanation, and slots | Consultation browser client, bounded BFF routes, `SpecialistDiscovery`, and component tests                                                           |
| Free versus paid boundary                         | FREE renders browse and upgrade information without booking; PLUS test submits through MB-378                                                         |
| Exact slot handoff                                | Component test asserts the unchanged slot UUID and `IN_APP_CHAT` modality passed to `appointmentBrowserClient.request`                                |
| Fail-closed payload                               | Strict parser rejects malformed duration, entitlement drift, and video slots while video is disabled                                                  |
| No prohibited content                             | Parser minimization regression and UI assertions use non-sensitive synthetic fields                                                                   |
| Browser journey                                   | Playwright security/degradation journey intercepts synthetic discovery responses and checks browse-only UI against the production standalone frontend |

## Verification on 2026-09-28

| Command                                                                                                                                                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run contracts:sync`                                                                                                                                                                             | Pass; Consultation OpenAPI snapshot and generated TypeScript contract synchronized                                                                                                                                                                                                                                                                                            |
| `npm.cmd run typecheck`                                                                                                                                                                                  | Pass                                                                                                                                                                                                                                                                                                                                                                          |
| `npm.cmd test -- --run lib/consultation/consultation-validation.test.ts app/api/consultation/specialists/discovery-routes.test.ts features/specialist-discovery/components/SpecialistDiscovery.test.tsx` | Pass, 3 files / 19 tests, including empty, dependency-failure, and stale-slot UI states                                                                                                                                                                                                                                                                                       |
| `npm.cmd run lint`                                                                                                                                                                                       | Pass, zero warnings                                                                                                                                                                                                                                                                                                                                                           |
| `npm.cmd run contracts:check`                                                                                                                                                                            | Pass for every checked service snapshot and generated client                                                                                                                                                                                                                                                                                                                  |
| `npm.cmd run build`                                                                                                                                                                                      | Pass after allowing network access for the existing `next/font` Google Font fetch; 79 static pages generated and standalone output prepared                                                                                                                                                                                                                                   |
| `npm.cmd run quality`                                                                                                                                                                                    | Partial: format, lint, typecheck, both contract checks, and 108/111 test files passed. It stopped before build because 11 existing Journal, Emotion Check-in, and AI Companion client tests fail under local Node `v24.15.0` with MSW's cross-realm `AbortSignal` error. Running those three files alone reproduces the same failures; MB-363 tests pass inside the full run. |
| `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'; npx.cmd playwright test tests/e2e/security-degradation.spec.ts --grep "specialists page uses approved online discovery" --workers=1 --reporter=line`  | Pass; Chromium fixture journey 1/1 against the production standalone frontend and non-sensitive synthetic discovery payload                                                                                                                                                                                                                                                   |
| SHA-256 comparison with backend `contracts/openapi/consultation-service-v1.yaml`                                                                                                                         | Pass; source and consumer snapshots match exactly                                                                                                                                                                                                                                                                                                                             |

Cross-owner Story verification is recorded in the backend parent evidence. The
browser run is fixture evidence only; this document does not claim deployed or
live-service evidence.
