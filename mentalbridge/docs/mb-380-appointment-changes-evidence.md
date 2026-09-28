# MB-380 appointment cancellation and reschedule evidence

## Delivered journey

The authenticated appointment page now lets an owner cancel or replace a
future requested or confirmed appointment. Every mutation carries the current
appointment version and a fresh idempotency key through the same-origin BFF.
After success, the page reloads Consultation's authoritative state rather than
predicting credit or slot outcomes locally.

Cancellation requires an explicit confirmation. The warning explains the
24-hour forfeit rule for a late confirmed appointment. Reschedule keeps the old
appointment until the linked replacement succeeds and warns when a late change
requires another consultation entitlement.

## Persisted evidence shown to the user

- Current state and exact release, forfeit, or transfer outcome.
- Old-to-new and new-to-old replacement relationship without exposing internal
  identifiers.
- Cancellation actor, stable user-facing reason, occurrence time, and ordered
  lifecycle history.
- Version/dependency failures use bounded user-facing copy and trigger an
  authoritative reload path.

The controlled browser capture
[`evidence/mb-380-appointment-changes.png`](evidence/mb-380-appointment-changes.png)
contains synthetic appointment data only.

## Verification

The MB-380 component, validation, provider-client, and route tests cover exact
version forwarding, confirmation, persisted audit rendering, strict malformed
response rejection, and replacement linkage. The fixture Playwright journey
checks cancellation and reschedule request headers and produces the screenshot
above. Repository formatting, lint, type generation, contract sync, unit tests,
production build, and the focused browser journey are required before handoff.
