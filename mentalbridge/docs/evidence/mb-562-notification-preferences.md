# MB-562 frontend evidence

The notification settings screen now loads and saves the Content/Notification owner preference aggregate through an authenticated Next.js BFF. It forwards the server `ETag` as `If-Match`, exposes loading, retry, validation, saving, saved, dependency-failure, and cross-device stale-version states, and never keeps a second local-only preference source.

The screen covers all three channel choices, six content groups, quiet start/end, IANA timezone, email cadence, and both explicit email opt-ins. Push copy states that delivery is not active. The public UI does not claim a quiet-hour bypass or automatic safety email and does not hold sensitive source content.

Verification includes BFF owner/session tests, closed request validation, safe failure mapping, upstream ETag/header tests, component save/retry/stale validation tests, generated contract checks, and a Playwright fixture journey that saves then reloads the same account from the persisted fixture state.
