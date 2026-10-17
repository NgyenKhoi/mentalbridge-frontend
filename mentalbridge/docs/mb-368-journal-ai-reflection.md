# MB-368 Journal AI reflection

MB-368 lets an authenticated user explicitly request a non-clinical reflection
for the exact revision currently displayed on the Journal page. The frontend
uses the committed Journal and Care OpenAPI snapshots as the contract source;
it does not infer fields, statuses, or provider behavior.

## Implemented boundary

- The Care BFF reads the current `AI_PROCESSING` disclosure and records grant
  or revocation decisions using the backend-owned policy version.
- The Journal BFF creates an analysis job only for a path-bound journal ID and
  positive revision, forwards one stable idempotency key, and reads job status
  by UUID.
- `RUNNING` with attempt zero is presented as queued; later `RUNNING`,
  `SUCCEEDED`, and `FAILED` responses have separate UI states. A failed eligible
  job is retried only after a manual user action.
- A completed result is rendered only when its journal ID and revision match the
  entry being viewed. Editing the entry makes the prior reflection visibly
  stale rather than attaching it to the new revision.
- Suggested actions are mapped from the closed contract enum to `/resources`,
  `/support-guides`, `/support-plan`, or `/safety-directory`. `NONE` and unknown
  values cannot produce a link.
- Browser persistence contains only request correlation identifiers. Journal
  text and normalized analysis output are not written to local storage.
- The reflection view uses concise result labels and provenance without
  repeating the product-wide scope note shown in the profile experience.

## Verification evidence

Unit and component tests cover strict contract parsing, BFF forwarding and
error mapping, current-policy consent, consent denial/revocation, queued and
running states, reload recovery, success, terminal failure and manual retry,
exact-revision rejection, and allow-listed action routing.

The controlled Playwright journey uses synthetic journal content and a
deterministic provider fixture. It exercises the same-origin BFF from consent
through async completion, reload restoration, stale revision, failure/retry,
governed navigation, and revocation. This is `fixture-browser` evidence, not
proof of a live AI provider or live cross-stack deployment.

No database migration or backend API change is introduced by MB-368. The
frontend snapshot is synchronized to the already-published backend contract.
