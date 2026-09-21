# MB-362 online specialist availability evidence

## Scope

The Consultation service is the owner of specialist availability. The browser
uses authenticated same-origin `/api/consultation/availability-slots` handlers;
service credentials and upstream addresses remain server-only. The UI supports
only exact 60-minute `IN_APP_CHAT` and feature-gated `IN_APP_VIDEO` slots with
an IANA display timezone. It does not collect or display a practice location,
phone number, or external meeting link.

The provider decision is recorded in backend ADR 0019. Publishing video
availability is disabled by default and does not create or authorize a video
room. Withdrawn slots remain visible as tombstones, and started slots are shown
as stale instead of being presented as bookable.

## Acceptance evidence

| Requirement                                   | Evidence                                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Persisted list, publish, and withdrawal       | Typed Consultation client, same-origin BFF, specialist component, and provider-backed browser fixture                                           |
| Exact duration and UTC                        | Browser conversion regression test, strict BFF parser, provider validation, PostgreSQL duration constraint                                      |
| Owner authorization and optimistic withdrawal | SPECIALIST BFF role check, provider subject ownership, `If-Match` version requirement                                                           |
| Overlap and concurrent publication            | Provider repository integration tests plus PostgreSQL exclusion constraint                                                                      |
| Chat and video gate                           | Unit/component tests cover chat and disabled video; provider integration test covers enabled video                                              |
| Responsive and accessible states              | Mobile viewport is set before login/page load; loading, empty, error, unavailable-video, stale, withdrawn, labels, and live status are explicit |
| No physical dependency                        | OpenAPI, BFF payloads, UI, and tests contain no practice location, telephone, or external meeting URL                                           |

## Verification run on 2026-09-19

| Command                                                                     | Result                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run lint`                                                              | Pass, zero warnings                                                         |
| `npm run typecheck`                                                         | Pass                                                                        |
| `npm run contracts:check`                                                   | Pass for all five service snapshots and generated clients                   |
| `npm run test:unit`                                                         | Pass, 57 files / 297 tests after rebasing onto current `origin/dev`         |
| `npx next build --webpack` plus `node scripts/prepare-standalone.mjs`       | Pass; production standalone created                                         |
| `npx playwright test tests/e2e/specialist-availability.spec.ts --workers=1` | Pass in Chromium at 390x844 against the synthetic HTTP Consultation fixture |

The fixture browser run proves the same-origin browser/BFF/provider boundary
with synthetic data. It is not evidence of a deployed Consultation instance.
The normal `npm run build` Turbopack command cannot run inside this detached
worktree because its intentionally shared `node_modules` junction points
outside Turbopack's filesystem root. The same source passes the production
webpack build; CI uses a normal checkout and remains the authority for the
standard build command.
