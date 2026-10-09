# MB-593 specialist operational analytics

The Specialist Portal exposes a dedicated operational analytics view backed by
Consultation's authenticated specialist endpoint. The browser chooses a bounded
7, 30, or 90 day preset; the same-origin BFF converts that choice to an explicit
UTC half-open period and forwards only the server-held access credential.

The response contains aggregate slot utilization, immutable appointment
lifecycle transition counts, no-show outcomes, the current MB-364 rating
aggregate, source timestamps, and the specialist operational state. Runtime
validation rejects extra client, Journal, assessment, emotion, recovery,
adherence, chat, or private-note fields rather than forwarding them to the UI.

Earnings and successful payout values are sourced from the MB-516 owner facts
and bounded to the selected period. The dedicated earnings workspace remains
the authoritative detailed view. Empty, stale, dependency-error, unapproved,
and suspended states have distinct user-facing explanations; suspension keeps
historical facts visible while clearly stating that new activity is disabled.
The period and response generation time are both rendered in the authoritative
specialist analytics timezone so the displayed range and as-of time cannot
silently disagree.

Focused evidence:

- contract validation rejects sensitive or inconsistent projections;
- BFF tests cover specialist authorization and bounded preset conversion;
- component tests cover factual metrics, period changes, suspension, stale
  data, unavailable financial values, and timezone-consistent generation time;
- backend provider tests cover immutable transition counts, period validation,
  specialist authorization, suspension, privacy, and real PostgreSQL queries.

## Prototype implementation — 2026-10-08

The four workspace HTML references now drive the full-width layout, segmented
period controls, animated utilization gauge, fractional rating stars, tactile
lifecycle tiles, financial cards and metric/privacy dialogs. Existing MentalBridge
colors and typography remain unchanged. Hover, press, focus, loading and reduced
motion states are implemented rather than copied as static decoration.

The prototype's invented benchmarks, certifications, payment dates and activity
logs are not presented as product facts. Details explain the existing API:

- Utilization means slots in the period that were ever confirmed. Unused slots
  are not a count of future bookable slots; no denominator renders `—`, not 0%.
- Lifecycle totals are historical transitions, not mutually exclusive current
  appointment statuses. No-show totals follow their settlement timestamps.
- Ratings are the current all-time aggregate and do not change meaning when the
  period filter changes.
- Earnings and successful payouts are separate period-bounded aggregates, not
  an inferred account balance.

Initial loading, empty aggregates, profile approval gates, suspended historical
data, stale sources, unavailable financials and request errors have separate
surfaces. A failed refresh keeps only facts belonging to the selected period;
401/403 clears cached facts. Obsolete responses cannot overwrite newer requests.
Changing a period does not generate an unsolicited refresh-success toast.

Verification on the final implementation:

- `npm run quality`: formatting, ESLint, TypeScript, paired consultation/realtime
  contract checks, 187 Vitest files / 909 tests, and production build passed.
- Three Chromium journeys passed with synthetic API fixtures: populated
  interactions and responsive/reduced-motion behavior; empty and approval-gated
  states; loading, dependency failure, retry and refresh failure retention.
- Screenshots were inspected at desktop and mobile sizes. Assertions cover
  overflow at 1440, 1280, 768, 375 and 640px, mobile navigation, keyboard dialog
  access, focus containment/restoration and a toast close button above the crisis
  support control. These are fixture-based UI tests, not a live-account API test.

Browser reports and deployment evidence are stored outside the app in
`D:/mentalbridge/.artifacts/specialist-analytics/`. The Docker configuration uses
the current publication worktrees and existing local environment files. The user
authorized restoring the entire stack after Docker was found empty; no database
reset or repeated demo-data seed is part of this work.
