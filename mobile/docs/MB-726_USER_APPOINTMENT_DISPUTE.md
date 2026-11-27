# MB-726 — USER appointment dispute on mobile

## Delivered behavior

Inside the exact owner appointment detail, mobile provides one bounded journey
for reading or opening an appointment dispute:

- load the authoritative dispute for the selected appointment;
- treat the owner-scoped `APPOINTMENT_DISPUTE_NOT_FOUND` response as no existing
  dispute, without exposing another participant or appointment;
- offer one deliberate open action only for a settled appointment whose
  server-list timestamp is still within the 24-hour presentation window;
- submit one of four stable operational reason codes without free text or
  evidence metadata;
- retain the exact request body and idempotency key after an ambiguous response,
  then replay it only when the user explicitly chooses retry;
- render the exact server-confirmed `OPEN` or `RESOLVED` dispute even after the
  local presentation window has elapsed.

The backend remains the final eligibility authority. The local 24-hour check
only controls presentation and never authorizes a mutation.

## Contract and fail-closed boundary

- Owner endpoints only:
  - `GET /api/v1/appointments/{appointmentId}/dispute`
  - `POST /api/v1/appointments/{appointmentId}/dispute`
- POST sends only:

  ```json
  {
    "reasonCode": "OUTCOME_INCORRECT",
    "evidenceType": null,
    "evidenceOccurredAt": null
  }
  ```

- Supported reasons are `OUTCOME_INCORRECT`,
  `PARTICIPATION_EVIDENCE_INCORRECT`,
  `SESSION_DELIVERY_NOT_RECOGNIZED`, and `TECHNICAL_FAILURE`.
- The `Idempotency-Key` is printable ASCII, 16–128 characters. An ambiguous
  retry reuses the exact actor-scoped key and payload; the app never generates a
  replacement command automatically.
- Strict parsers reject additional properties, invalid state combinations,
  invalid versions, and a response whose `appointmentId` does not match the
  selected owner appointment.
- `APPOINTMENT_DISPUTE_ALREADY_EXISTS` triggers an authoritative refetch. The
  client does not fabricate success.
- Forbidden, stale, network, malformed-contract, and appointment-switch paths
  clear stale visible data and provide explicit retry/refetch recovery.

## Privacy and product boundary

The UI contains only four fixed operational reasons. It never requests or
renders raw chat, health information, screening answers, Journal content,
ConsultationBrief content, recordings, clinical notes, uploads, free text,
private evidence, or another participant's identity.

`RELEASE_USER_CREDIT` is described only as a server-confirmed consultation
credit result. Mobile does not promise or imply a cash refund, payout, automatic
credit, or a particular review outcome.

## State coverage

| State                               | Mobile behavior                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Loading                             | Appointment-scoped progress; no action before the owner read resolves.                                |
| Eligible, no dispute                | Four fixed reasons; submit disabled until one reason is selected.                                     |
| Ambiguous mutation                  | Exact command retained; explicit same-key retry only; no automatic second POST.                       |
| Existing `OPEN`                     | Server-confirmed review status; no duplicate-open control or refund promise.                          |
| `RESOLVED` credit release           | Consultation-credit result only; no cash-refund or payout language.                                   |
| `RESOLVED` recorded outcome upheld  | Operational outcome shown without private evidence or clinical detail.                                |
| Expired/ineligible, no dispute      | Plain-language availability explanation; no mutation control.                                         |
| Already exists                      | Refetch exact dispute; never replace it with local success.                                           |
| Forbidden/not found after ownership | Clear prior dispute data and show a redacted retry state.                                             |
| Network/dependency error            | Clear stale server view and expose refetch; an ambiguous POST retains only the exact pending command. |
| Appointment/account switch          | Old content, selection, error, and pending visual state disappear before the next scoped read.        |

## Design evidence

- Stitch project: `10509806209320093143` (`MentalBridge UI Redesign`).
- Design system: `8a18e52ae11e456889c382c58acd21d0`
  (`Clinical Calm & Precision`).
- Generated full-route reference:
  `ac08ef6b81e442b1816c04981ab934d6` — `Lịch hẹn người dùng - Yêu cầu xem xét
kết quả phiên (MB-726 Di động 375px)`.
- Repository shell, spacing, colors, type scale, appointment detail hierarchy,
  and 48px controls were held constant. Only the settled-detail content slot
  between the session summary and change history was changed.
- Stitch HTML inspection found all four fixed labels, no `textarea`, and only
  `Manrope, system-ui, sans-serif`. The local full-frame prototype covers
  eligible, ambiguous retry, open, resolved, and expired states.
- Local `.stitch/MB-726` evidence is excluded from the pull request under
  repository policy. Production uses repository-owned React Native primitives,
  tokens, and accessibility behavior.

## Verification map

Final command output, commit SHA, provider run links, and CI evidence belong on
the pull request so they prove the exact head. Before merge, the final head must
record these gates from `mobile/` unless noted otherwise:

| Gate                                                                                           | Required evidence                                                                                                     |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Focused contract/API tests                                                                     | Strict request/response, identity, exact URL/body/header, private/additional-field rejection.                         |
| Focused panel/navigation tests                                                                 | Eligible/open/resolved/expired, same-key retry, already-exists refetch, A → B → A reset, no automatic second POST.    |
| `npx prettier --check <MB-726 files>`                                                          | All MB-726 text files formatted.                                                                                      |
| `npm run lint`                                                                                 | Zero warnings on the final head.                                                                                      |
| `npm run typecheck`                                                                            | Final TypeScript graph passes.                                                                                        |
| `npm run test:ci`                                                                              | Full mobile Jest suite passes.                                                                                        |
| `npm run build:bundle`                                                                         | Android and iOS Expo exports pass when the task risk/gate requires it.                                                |
| `node scripts/pr-overlap.mjs` from repository root                                             | Open-PR overlap and merge order recorded; MB-726 precedes the held MB-725 PR, which must then rebase and rerun tests. |
| `node mobile/.stitch/MB-726/verify.mjs` from repository root (local evidence, never committed) | Four fixed reasons, no sensitive-input controls, required states and interaction script present.                      |

## Authored Maestro — NOT_RUN until MB-666

`mobile/.maestro/mb-726-user-appointment-dispute.yaml` is author-only evidence.
It requires one protected disposable USER fixture with three ordered history
appointments:

1. eligible and settled within 24 hours, with no existing dispute;
2. an existing resolved dispute with `RELEASE_USER_CREDIT`, older than 24 hours;
3. an expired eligible settlement with no dispute.

The flow uses Android airplane mode to force one ambiguous POST, restores the
network, explicitly replays the same command, verifies the server-confirmed
`OPEN` result, then reads the resolved and expired appointments. The backend
fixture and idempotency record must be reset before every run. It must never run
against shared dev or production data.

Device execution is `NOT_RUN` until MB-666 provides the protected
staging/device gate and resettable fixture. The post-merge Docker/runtime
walkthrough is also `NOT_RUN`; this pull request makes no post-merge claim.

## Merge gate

This is one FE-MOBILE pull request with no backend contract change. It may merge
into `dev` only after required review and CI pass. MB-725 is held and overlaps
the appointments screen/tests, so the intended order is MB-726 first, followed
by an MB-725 rebase and complete retest. No automatic merge is authorized.
