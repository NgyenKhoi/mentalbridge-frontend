# MB-634 mobile specialist appointment continuity

## Delivered journey

The authenticated `SPECIALIST` route group now provides an appointment
workbench for assigned requests, upcoming consultations, and terminal history.
The app renders Consultation-owned state, submits only supported specialist
decisions, and opens bounded Care continuity only after current access has been
confirmed.

No mobile database, appointment completion command, credit settlement,
specialist earning, broad patient record, or second chat implementation was
introduced.

## Contract matrix

| Mobile capability                                   | Authoritative public contract                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Assigned request, upcoming, and history collections | `GET /api/v1/specialist/appointments`                                                                                                       |
| Confirm or reject an assigned request               | `POST /api/v1/specialist/appointments/{appointmentId}/accept\|reject` with exact `If-Match` and stable `Idempotency-Key`                    |
| Relationship and current continuity access          | `GET /api/v1/specialist/client-continuity`                                                                                                  |
| Appointment-scoped shared snapshot                  | `GET /api/v1/specialist/consultation-briefs/{appointmentId}`                                                                                |
| Published SessionSummary history                    | `GET /api/v1/specialist/appointments/{appointmentId}/session-summaries`                                                                     |
| First publication or versioned amendment            | `POST /api/v1/specialist/appointments/{appointmentId}/session-summaries` with stable `Idempotency-Key`; amendments include exact `If-Match` |

Response bodies are parsed with strict Zod schemas so an unreviewed contract
change fails closed instead of silently granting mobile authority.

## Authority, concurrency, and privacy

- Request decisions are available only for server-returned `REQUESTED`
  appointments before the server-returned decision deadline. The server still
  makes the final eligibility and assignment decision.
- Decision and summary command keys remain stable for the same versioned
  payload across an ambiguous retry. They rotate only after authoritative
  reconciliation succeeds, the payload changes, or the server reports an
  idempotency conflict.
- `409`, `412`, and authority-related failures lock governed commands while the
  appointment and summary collections reload. A failed reload stays locked and
  requires an explicit successful safe reload.
- Cached TanStack Query data never grants a mutation. A failed appointment
  refresh leaves actions disabled.
- ConsultationBrief content is shown only while the current continuity response
  says `AVAILABLE` for the exact appointment version. During refresh, after
  revocation/expiry, or on `403`, `404`, or dependency failure, private content
  is hidden and the brief cache is removed.
- Only the bounded snapshot fields approved by Care are rendered. The feature
  does not fetch raw Journal text, assessment answers, emotion history, private
  notes, chat history, Community content, or unrelated Identity fields.
- Summary composition is mounted only for server-owned `COMPLETED`
  appointments carrying a completion fact. Mobile cannot infer or command
  completion. Agreed next steps use only the supported Consultation values;
  resource composition is intentionally omitted because it requires a reviewed
  resource selector rather than a mobile-owned reference.

## MB-631 chat dependency

Appointment detail owns only a typed `SpecialistChatHandoff` seam. The current
`dev` branch does not yet contain the MB-631 shared appointment-chat route, so
the production adapter is intentionally unavailable and the button is disabled
with truthful copy. No temporary transport, fake message, or alternate chat
screen exists in MB-634. When MB-631 merges, its route adapter can implement the
seam without changing appointment authority.

## Automated evidence

From `mobile/`, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build:bundle
```

Focused Jest coverage exercises strict API parsing and headers, collection
grouping, confirm/reject success, replay keys, stale recovery, cached-state
fail-closed behavior, continuity authorization/revocation/dependency recovery,
completion-gated summaries, summary concurrency, reload behavior, and the chat
handoff seam.

## Android real-contract evidence

`.maestro/mb-634-specialist-appointment-continuity.yaml` runs only through the
protected `staging-mobile-e2e` Environment when the pull request carries the
`run-mobile-specialist-e2e` label. It requires a resettable staging SPECIALIST
account whose data is isolated from shared reviewers and reset before every run
with:

1. exactly one assigned `REQUESTED` chat appointment eligible for confirmation;
2. an approved, version-matched ConsultationBrief shared for that appointment;
3. exactly one authoritative `COMPLETED` appointment with a completion fact and
   no existing SessionSummary;
4. deterministic reset of decision, summary, consent, access-window, and credit
   side effects after the run.

The flow never fabricates server success. The protected job checks out and
verifies the exact pull-request head, compiles and installs that head, then runs
the journey with runtime-only credentials:

```powershell
npm run e2e:android:specialist-continuity:evidence
```

The resulting manifest records the exact commit and run URL. The flow returns
to the SPECIALIST home before its final screenshot, so the artifact contains no
credentials, ConsultationBrief content, SessionSummary content, or chat
messages.
