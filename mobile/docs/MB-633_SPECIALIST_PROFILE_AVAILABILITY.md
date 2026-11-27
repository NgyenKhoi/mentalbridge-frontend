# MB-633 mobile SPECIALIST profile and availability

## Delivered journey

The authenticated `SPECIALIST` route group now exposes professional profile
lifecycle and owner-scoped online availability. The mobile client consumes the
existing Consultation contracts; it does not reuse the USER Care profile or
Community identity, and it does not add physical locations or unsupported
modalities.

## Contract matrix

| Specialist action                           | Consultation contract                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Load the authoritative professional profile | `GET /api/v1/specialist-profile`                                         |
| Create or replace editable profile data     | `PUT /api/v1/specialist-profile`; existing profiles use exact `If-Match` |
| Submit a saved draft                        | `POST /api/v1/specialist-profile/submit` with exact `If-Match`           |
| Resubmit a rejected revision                | `POST /api/v1/specialist-profile/resubmit` with exact `If-Match`         |
| List owner slots and tombstones             | `GET /api/v1/availability-slots?includeWithdrawn=true`                   |
| Publish a 60-minute online slot             | `POST /api/v1/availability-slots` with a stable `Idempotency-Key`        |
| Withdraw an available future slot           | `DELETE /api/v1/availability-slots/{slotId}` with exact `If-Match`       |

`PENDING` plus the server-owned `submittedAt` value distinguishes a saved
draft from a profile currently under review. Reject and suspension reason codes
are presented as factual feedback. Approved and suspended profiles are
read-only under this contract; later amendment workflows remain outside
MB-633.

## State, cache and safety

- Query keys include the authenticated Identity subject and logout clears the
  shared query cache.
- Only `NEW`, draft, pending-review and rejected profiles expose the supported
  save path. Saving a pending-review edit requires explicit confirmation
  because the server removes it from review.
- Submit and resubmit use the exact returned version. A `409`, `412`, ambiguous
  network error or server failure locks profile commands until authoritative
  recovery succeeds; failed recovery stays fail-closed.
- Availability mutations are shown only while the current profile is
  `APPROVED`. Pending, rejected and suspended specialists can inspect persisted
  slots but cannot publish or withdraw them.
- Publish converts an IANA-local selection to an exact 60-minute UTC interval.
  Its command key remains stable across ambiguous retries and resets only after
  success, a payload change or an explicit idempotency conflict.
- Overlap, video-disabled, validation, stale, withdrawn and approval errors use
  server-owned codes. Stale withdrawal and lost approval force profile and slot
  reconciliation before any further command.
- The client sends only `IN_APP_CHAT` and server-enabled `IN_APP_VIDEO`. It
  neither collects a physical location nor invents eligibility or approval.

## Automated evidence

From `mobile/`, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build:bundle
```

Focused Jest coverage verifies lifecycle derivation, field bounds, strict
response parsing, create/update concurrency headers, submit/resubmit,
reject/approve/suspend presentation, exact 60-minute conversion, stable publish
idempotency, overlap errors, withdrawal confirmation, non-approved read-only
behavior and fail-closed stale recovery.

## Android real-contract evidence

`.maestro/mb-633-specialist-profile-availability.yaml` signs in with a protected,
resettable SPECIALIST staging fixture. It loads the server-approved profile,
publishes a future 60-minute chat slot, withdraws it, reloads the owner list and
asserts the persisted tombstone. Run it with:

```powershell
$env:MAESTRO_MB_SPECIALIST_EMAIL = 'dedicated-specialist@example.invalid'
$env:MAESTRO_MB_SPECIALIST_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:specialist
```

The staging Environment supplies credentials only at runtime. The artifact
contains the exact commit, run URL, final screenshot and journey classification;
it excludes credentials and professional profile fields.
