# MB-612 mobile assessment and post-screening guidance

## Delivered journey

The authenticated USER route `/(user)/assessment` implements the Care-owned
initial-check journey:

```text
resume/start episode → PHQ-9 → GAD-7 → support evaluation → SupportGuide
```

Mobile loads the current published Vietnamese questionnaire and privacy
disclosure from Care. It sends only the selected immutable definition ID, exact
question IDs and response values, current disclosure acknowledgement, and a
per-attempt idempotency key. It sends no account ID, client score, severity,
safety result, or SupportPlan mutation.

Care remains authoritative for question wording, accepted instrument order,
validation, scoring, severity, safety status, screening meaning, next step,
history ownership, and the immutable SupportGuide snapshot. Raw answers exist
only in React state while the active questionnaire is open and in the HTTPS
submission body; they are not copied to profile, analytics, logs, URLs, public
configuration, or device persistence.

## Contract matrix

| User action                       | Care contract                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Resume/start                      | `GET /api/v1/screening-episodes/current?purpose=INITIAL_CHECK`, `POST /api/v1/screening-episodes`                                        |
| Load approved content             | `GET /api/v1/questionnaires/{instrument}/current`, `GET /api/v1/privacy-disclosures/current`, `GET /api/v1/consents`                     |
| Record missing current consent    | `POST /api/v1/consent-decisions`                                                                                                         |
| Submit exact episode step         | `POST /api/v1/screening-episodes/{episodeId}/assessments/{instrument}`                                                                   |
| Complete authoritative evaluation | `POST /api/v1/screening-episodes/{episodeId}/support-evaluation`                                                                         |
| Generate/replay guide snapshot    | `POST /api/v1/support-guides` with the exact owned PHQ-9/GAD-7 IDs                                                                       |
| Reopen history                    | `GET /api/v1/assessments`, `GET /api/v1/assessments/{assessmentId}`, immutable questionnaire definition, and SupportGuide history/detail |
| Explicit help-now lookup          | `POST /api/v1/safety-directory-lookups` with `HELP_NOW` or `POSITIVE_ITEM_9` and user-entered area                                       |

All calls use the shared bearer/correlation/error client and the single public
edge URL. The screen never accepts an actor ID. Opening a result or guide does
not call a SupportPlan endpoint.

## Explicit states and safety

- Loading, empty history, resumable episode, successful result, cached/stale
  overview, validation error, unauthorized/forbidden, and dependency failure
  have separate copy and recovery actions.
- A historical result reloads its exact immutable questionnaire definition and
  verifies definition, instrument, questionnaire version, and scoring version
  provenance before rendering.
- A stored guide is fetched by its owner-scoped ID and rendered as the exact
  immutable snapshot. Resource `EMPTY`, `STALE`, and `UNAVAILABLE` states do not
  replace or weaken Care's safety guidance.
- Positive item-9 UI is triggered only by Care's positive safety status/guide.
  The explicit help-now action asks the user for an area, renders the exact Care
  response, and fails closed. It never auto-calls, dispatches, books, contacts a
  third party, creates a SupportPlan, or infers crisis from severity.

## Automated evidence

Run from `mobile/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
```

The focused Jest evidence covers PHQ-9 and GAD-7 completion, server validation
failure, reload/resume, exact owned-history reopening, unauthorized access,
dependency failure, positive-safety guidance/help-now lookup, immutable guide
reopening, forbidden client-owned fields, and absence of SupportPlan calls.

## Android real-contract demo path

The deterministic UI path is committed at
`.maestro/mb-612-assessment.yaml`. It is intentionally not part of the `dev`
quality gate: native build/boot and real cross-stack E2E run only in the
approved staging environment, consistent with Mobile Delivery Contract v1.

Prerequisites:

1. A staging Android build connected to the approved public staging edge.
2. A dedicated verified USER fixture with no open initial-check episode and no
   pre-existing data that changes the PHQ-9 → GAD-7 order.
3. `MB_USER_EMAIL` and `MB_USER_PASSWORD` supplied to Maestro by the protected
   staging secret store; never commit or print them.

Run on the staging Android emulator:

```bash
maestro test \
  -e MB_USER_EMAIL="$MB_USER_EMAIL" \
  -e MB_USER_PASSWORD="$MB_USER_PASSWORD" \
  .maestro/mb-612-assessment.yaml
```

Passing evidence is the real signed-in flow reaching the server-returned result
and `Gợi ý hỗ trợ sau sàng lọc` screen after all nine PHQ-9 and seven GAD-7
answers. Staging should retain the Maestro report and screenshot artifact for
the tested commit without retaining credentials or raw answer payloads.
