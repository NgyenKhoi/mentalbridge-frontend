# MB-379 appointment decision frontend evidence

## Delivered user journeys

The specialist appointment workspace now reads assigned appointments from the
same-origin Consultation BFF instead of fixture rows. It shows the persisted
schedule and timezone, decision deadline, appointment state, and consultation
credit outcome in Vietnamese.

Only a `REQUESTED` appointment offers actions. Accept sends the current version
and a stable idempotency key. Reject first uses the shared confirmation dialog,
then sends the same concurrency and idempotency controls. A successful response
updates the card from the authoritative payload and uses the shared action
toast. Version, deadline, and terminal-state conflicts reload before explaining
the current state.

The user appointment panel also translates `CONFIRMED`, `REJECTED`, and
`EXPIRED` plus the actual credit outcome. It does not infer a refund from the
appointment label.

## Boundaries and accessibility

- Browser requests stay behind authenticated same-origin route handlers; the
  specialist role is checked before Consultation is called.
- Internal account, appointment, slot, credit, policy, and service identifiers
  are not shown in normal product copy.
- Loading, empty, error, disabled, focus-visible, mobile, and reduced-motion
  states are present. Controls keep a minimum 44-pixel target.
- The UI reuses `FeedbackProvider` and `ConfirmDialog` rather than defining a
  feature-local toast or modal system.

## Verification

On 2026-09-26 the focused frontend suite passed with synthetic contract data:

```text
npm test -- features/appointments/components/SpecialistAppointmentDecisionPanel.test.tsx \
  features/appointments/components/AppointmentRequestPanel.test.tsx \
  lib/consultation/consultation-validation.test.ts \
  app/api/consultation/specialist/appointments/appointment-decision-routes.test.ts

Test files: 4 passed
Tests: 16 passed
```

`npm run typecheck` and `npm run contracts:check` also passed against the MB-379
Consultation OpenAPI source. These checks cover BFF validation, specialist list,
accept, persisted terminal rendering, stale-version reload, timezone snapshots,
and invalid state/credit combinations. No live user data is included.

The final `npm run quality` gate also passed: formatting, lint, type generation,
contract checks, all 99 unit-test files (466 tests), and the Next.js production
build with the two specialist appointment BFF routes included.
