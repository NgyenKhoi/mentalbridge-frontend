# MB-360 specialist lifecycle evidence

## Delivered flow

- The specialist workspace displays safe rejection or suspension reasons.
- A rejected specialist edits the existing profile and explicitly resubmits it;
  the browser never creates a replacement profile.
- A suspended profile is read-only and explains that an administrator must
  restore it.
- The admin workspace lists `PENDING`, `APPROVED`, `REJECTED`, and `SUSPENDED`
  profiles and exposes only valid actions for the selected state.
- Reject and suspend forms send only closed contract reason codes. Suspension
  reports the exact committed counts for withdrawn slots, cancelled
  appointments, and released credits. Restoration warns that prior records are
  not revived.

## Boundary controls

The same-origin BFF authenticates the required actor role, validates UUIDs,
ETags, lifecycle filters, bounded request bodies, and state-specific reason
enums before forwarding the user token to Consultation Service. Response
parsers fail closed on unknown reasons, invalid state/reason combinations, or
incoherent suspension counts.

## Verification

Component coverage exercises same-profile rejection remediation/resubmission,
suspended read-only behavior, admin rejection, admin suspension outcomes, and
status queue selection. Client and validation tests verify reason encoding,
optimistic concurrency headers, and exact suspension effects. The committed
OpenAPI snapshot and generated TypeScript declarations are synchronized from
the backend owner contract.

On 2026-09-24 the following checks passed locally:

```text
npm test -- --run features/specialist-profile/components/SpecialistProfileWorkspace.test.tsx features/specialist-profile/components/AdminSpecialistReviewSection.test.tsx lib/consultation/consultation-validation.test.ts lib/consultation/consultation-client.test.ts
Test Files: 4 passed; Tests: 18 passed

npm run quality
Format, lint, typecheck, generated-contract checks, 87 test files / 422 tests,
and the Next.js production build passed.
```

The component tests prove the real actor components and BFF client behavior
with synthetic responses; they are component/API-boundary evidence, not a
fixture-browser or live cross-stack claim. The redacted suspension result shown
to the administrator is:

```json
{
  "effects": {
    "withdrawnAvailabilitySlots": 2,
    "cancelledAppointments": 1,
    "releasedCredits": 1
  }
}
```
