# MB-624 mobile journey closure

MB-624 closes the current React Native delivery channel around the versioned
Mobile Delivery Contract v1 and the feature slices already accepted in
MB-606–MB-613 and MB-625–MB-634. It adds no mobile-owned business state, API,
database, clinical rule, appointment transition, or notification decision.

## Authoritative journey matrix

| Journey                   | Mobile surface                                                                        | Authority                    | Evidence                                                             |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Session and role entry    | public registration, verification and sign-in; protected USER/SPECIALIST route groups | Identity                     | MB-607 tests and protected route contract                            |
| Personal setup            | USER profile                                                                          | Care                         | MB-608 contract and stale-write tests                                |
| Screening and guidance    | PHQ-9 → GAD-7 → result/history/SupportGuide/help-now                                  | Care                         | MB-612 tests and Android real-contract journey                       |
| Daily check-in            | emotion create/update/delete, history and factual progress                            | Journal/AI                   | MB-613 tests and Android real-contract journey                       |
| Governed plan             | SupportPlan draft/current/history, occurrence engagement and approved proposals       | Care                         | MB-625 tests and Android real-contract journey                       |
| Reviewed self-help        | Resources catalogue/detail/progress                                                   | Content                      | MB-626 tests and Android real-contract journey                       |
| Private writing           | Journal CRUD and explicit AI reflection                                               | Journal/AI with Care consent | MB-627 tests and protected Android safe-outcome journey              |
| Peer support              | Community identity, feed, publication, interaction and safety actions                 | Community                    | MB-628 tests and protected controlled Android journey                |
| Find professional support | approved profile, policy and exact availability                                       | Consultation                 | MB-629 tests and protected controlled Android journey                |
| Request consultation      | explicit booking and owner appointment reload                                         | Consultation                 | MB-630 tests and protected controlled Android journey                |
| Appointment chat          | eligible appointment, durable messages and history-only closure                       | Realtime/Consultation        | MB-631 tests and protected controlled Android journey                |
| Notifications             | inbox, read state, preferences and allow-listed installed destinations                | Content/Notification         | MB-632 unit/route contract; native push transport remains outside v1 |
| Specialist operations     | professional profile and 60-minute availability                                       | Consultation                 | MB-633 tests and Android real-contract journey                       |
| Specialist continuity     | assigned appointment, Care brief and completed-session summary                        | Consultation/Care            | MB-634 tests and protected Android journey                           |

The USER and SPECIALIST homes only navigate to installed routes. Opening a
surface does not confirm a mutation, infer wellbeing, grant a role, reserve a
slot, create plan progress, or mark a notification read. Each destination
continues to parse and reconcile its owner response independently.

## Executable closure guard

`src/config/mobile-journey-closure.test.ts` fails when an accepted public,
USER, or SPECIALIST route disappears; a story evidence contract is removed;
an approved Android proof command is lost; role guards stop depending on
Identity authority; or protected exact-head evidence wiring is weakened.

Run from `mobile/`:

```powershell
npm run test:ci -- --runTestsByPath src/config/mobile-journey-closure.test.ts src/config/mobile-delivery-contract.test.ts src/screens/UserHomeScreen.test.tsx src/screens/SpecialistHomeScreen.test.tsx
npm run quality
```

## Evidence boundaries

Local `npm run quality` proves formatting, lint, strict TypeScript, Jest and
Android/iOS JavaScript bundle export. It is not a native compile, app boot, or
deployed-service claim.

The normal pull-request gate keeps the frozen v1 compile-only mobile policy.
Protected Android jobs remain opt-in and exact-head for journeys that require
resettable users, provider containers or staging fixtures. Promotion to
`staging` runs the complete mobile quality gate, Android native boot plus its
configured real-contract journeys, and iOS native compile/install/boot. A
skipped, unavailable or failed protected job is never recorded as passing
evidence.

Notification delivery on a physical device, production App/Universal Links,
store signing/submission, and successful paid external providers remain
release-environment concerns. MB-624 does not fabricate proof for them.
