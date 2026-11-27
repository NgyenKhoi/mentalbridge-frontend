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

## Appointment presentation follow-up

The overview now leads with the next confirmed appointment or pending request,
followed by the four user-facing filters and chronological appointment rows.
Active appointments sort oldest-first; history sorts newest-first. Available
times are grouped by their own timezone/day and remain usable when the
appointment list fails independently.

Each row opens the owner-scoped `/appointments/{id}` detail. Cancellation,
replacement, preparation, final summary, rating, and dispute controls belong to
that detail; every chat link still goes to Messages. The mutation/version,
credit, and authorization contracts are unchanged. Failed detail loading has
an inline retry, distinct from an unavailable deep link. History uses the shared
Disclosure; reschedule scrolling honors reduced motion.

Synthetic evidence:

- [Overview](evidence/appointments-overview-redesign.png): 1280 × 900 viewport.
- [Cancelled detail](evidence/mb-380-appointment-changes.png): 1280 × 900 viewport.
- [Mobile detail](evidence/appointments-detail-mobile-redesign.png): 375 × 812 viewport.

The focused browser tests cover overview → detail → cancel/replace, persisted
audit outcomes, and reminder deep links. Responsive overflow assertions cover
1440, 1280, 768, 375, and 640 CSS px (the 1280 × 800 @200% equivalent).
