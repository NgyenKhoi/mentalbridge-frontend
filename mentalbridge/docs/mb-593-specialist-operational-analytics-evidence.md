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
