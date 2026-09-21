# MB-513 SupportPlan activity occurrence evidence

## Implemented surface

The SupportPlan page now loads the Care-owned bounded occurrence window for an
`ACTIVE` or `PAUSED` plan. It separates today from the next 13 local days and
shows each occurrence's local time, IANA timezone, source title, exact resource
version, schedule version, SupportPlan version, and current state.

The user can explicitly mark an open occurrence completed or skipped. Pause,
resume, complete, and draft discard remain explicit plan commands guarded by
the returned optimistic version. Copy states that these inputs are
self-reported wellbeing activity, not treatment adherence, clinical outcome,
or recovery.

## Boundaries

- The browser calls only same-origin BFF routes; Care remains the schedule and
  lifecycle authority.
- BFF routes validate dates, UUIDs, state enums, and exact strong `If-Match`
  syntax before forwarding the authenticated access token server-side.
- Runtime validation rejects lost provenance or a changed interpretation code.
- `RESOURCE`, `JOURNAL_PROMPT`, and `EMOTION_CHECK_IN_PROMPT` remain distinct
  source types. The current Care generator emits only `RESOURCE` occurrences.
- AI has no browser or BFF command that can pause, complete, replace, discard,
  or mark an occurrence.

## Verification

Unit/component/BFF tests cover today/upcoming grouping, source versions,
complete/skip state, paused controls, bounded date forwarding, and optimistic
concurrency forwarding. The fixture Playwright journey covers schedule display
and completion with synthetic data. The normal `dev` CI gate remains the full
non-browser frontend suite; fixture Browser E2E is maintained here and runs in
the staging gate or manually, consistent with
[review and testing](review-and-testing.md).
