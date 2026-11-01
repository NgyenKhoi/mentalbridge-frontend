# MB-723 — Mobile ConsultationBrief approval and revocation

## Delivered behavior

Inside a confirmed USER appointment, mobile now provides one appointment-scoped
ConsultationBrief journey:

- prepare a private manual draft from bounded current-situation text, one exact
  Care-owned screening context, and one to five user goals;
- save the draft without sharing it;
- review the exact server-returned draft in an explicit confirmation sheet;
- approve that exact version for the assigned specialist and display the
  authoritative access window;
- explicitly confirm revocation and display the server-confirmed revoked state.

Approval remains disabled after any local edit until the edited draft is saved
and the exact server response is visible. Switching appointments clears the
brief, confirmation sheet, form values, notices and errors before the next
appointment loads. Late responses from the previous appointment are ignored.

The UI never requests or renders raw screening answers, journal entries, chat,
private notes, diagnosis or AI-generated content. AI drafting is optional in the
platform contract and is deliberately outside MB-723.

## Contract and fail-closed boundary

- Owner endpoints only:
  - `GET /api/v1/consultation-briefs/screening-contexts`
  - `GET /api/v1/consultation-briefs/{appointmentId}`
  - `PUT /api/v1/consultation-briefs/{appointmentId}/draft`
  - `POST /api/v1/consultation-briefs/{appointmentId}/approve`
  - `POST /api/v1/consultation-briefs/{appointmentId}/revoke`
- Draft update, approval and revocation use quoted `If-Match` versions exactly
  as defined by Care OpenAPI.
- Strict parsers reject additional response/request properties, a mismatched
  appointment, an unexpected action result, invalid UUIDs, unbounded text or a
  screening count mismatch.
- Forbidden, missing, version-conflict, appointment-change and dependency-error
  paths clear prior content and actions before showing plain-language recovery.
- A missing brief is treated as a new draft only for the exact
  `CONSULTATION_BRIEF_NOT_FOUND` owner response; other 404 responses fail closed.

## State coverage

| State                                         | Mobile behavior                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| No saved brief                                | Private form; approval disabled until save succeeds.                                        |
| Saved draft                                   | Exact server draft stays editable; review enabled only while inputs still match it.         |
| Approval pending                              | Confirmation sheet names what is and is not shared; no API call occurs before confirmation. |
| Active sharing                                | Read-only approved content, server access window and explicit revoke action.                |
| Revocation pending                            | Destructive confirmation sheet; future reads are not claimed blocked before server success. |
| Revoked                                       | Read-only content plus authoritative revoked status; no active revoke action.               |
| Appointment switch / late response            | Old content and modal close immediately; late response is ignored.                          |
| Stale, forbidden, missing or dependency error | Sensitive content and actions are cleared; retry reloads authoritative state.               |
| No complete screening context                 | No draft controls; no content is shared.                                                    |

## Design evidence

- Stitch project: `10509806209320093143` (`MentalBridge UI Redesign`).
- Design system: `8a18e52ae11e456889c382c58acd21d0`
  (`Clinical Calm & Precision`).
- Existing approved references inspected:
  - `16211750247226507679` — appointment summary content hierarchy;
  - `06fc7b4fd228451b8bb1cede5470079a` — revoked-access treatment.
- A new Stitch edit was rejected by the external-service risk gate before any
  internal brief or contract detail was transmitted. The approved existing
  references and local full-frame prototype were used instead.
- Current route baseline and full-frame interactive prototype were rendered at
  390 × 844. Local QA verified draft → review → approve → revoke and stale →
  reload, modal Escape/focus restoration, reduced-motion rendering, no
  horizontal overflow and visible controls of at least 48 px.
- Local `.stitch/MB-723` evidence is excluded from the pull request under
  repository policy. Production uses repository-owned React Native primitives,
  tokens and accessibility behavior.

## Verification record

Commands are run from `mobile/` unless noted otherwise. Final command counts and
CI links are recorded on the pull request.

| Command                                                                                       | Result                                                                                    |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `node .stitch/MB-723/prototype-qa.mjs`                                                        | PASS — full interaction, focus, reduced-motion, touch-target and overflow checks.         |
| `npm test -- --runInBand src/appointments/AppointmentsScreen.test.tsx src/consultation-brief` | PASS — 4 suites, 48 tests.                                                                |
| `npx prettier --check <MB-723 files>`                                                         | PASS — every changed text file uses the configured style.                                 |
| `npm run lint`                                                                                | PASS — zero warnings.                                                                     |
| `npm run typecheck`                                                                           | PASS.                                                                                     |
| `npm run test:ci`                                                                             | PASS — 101 suites, 850 tests; existing non-failing React `act()` console warnings remain. |
| `npm run build:bundle`                                                                        | PASS — Android and iOS Expo exports completed.                                            |
| `npm run format:check`                                                                        | BASELINE BLOCKED — 397 existing `origin/dev` files warn; no MB-723 file is among them.    |
| `node scripts/pr-overlap.mjs` (repository root)                                               | PASS — no file overlaps another open PR into `dev`.                                       |

`mobile/.maestro/mb-723-consultation-brief-sharing.yaml` is authored. Device
execution is `NOT_RUN` until MB-666 provides the protected staging/device gate
and disposable confirmed-appointment fixture. Post-merge Docker/runtime
walkthrough is also `NOT_RUN`; no post-merge claim is made in this PR.

## Merge gate

This is one FE-MOBILE pull request with no backend contract change. It can merge
into `dev` only after required review and CI pass. No automatic merge is
authorized.
