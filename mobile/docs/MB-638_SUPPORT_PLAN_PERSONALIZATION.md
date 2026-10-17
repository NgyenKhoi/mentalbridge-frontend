# MB-638 mobile SupportPlan personalization

## Delivered contract

The authenticated SupportPlan route reads and replaces the same Care-owned
personalization resource as web:

- `GET /api/v2/support-plan-personalization` returns the current immutable
  preference revision and strong `ETag`.
- `PUT /api/v2/support-plan-personalization` sends the complete replacement
  with the exact `If-Match` value from the preceding read.
- Every preference remains optional. Sending null scalar values and empty
  arrays explicitly records the skip path; mobile does not infer clinical
  meaning from a preference.
- A stale write preserves the user's on-screen selections and offers an
  explicit reload. It never retries against a new revision silently.
- `planReview.required` explains that an active plan remains unchanged and
  requires an explicit review/change path.

Strict Zod parsing rejects unknown or invalid server values. The cache key is
scoped to the authenticated subject and server responses remain the only
authority.

## Verification

Focused Jest coverage includes absent, partial, complete/review, invalid
contract and stale-write behavior. Run from `mobile/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
```

## Android journey status

`E2E_AUTHORED_NOT_RUN`

`.maestro/mb-638-support-plan-personalization.yaml` is authored for a protected,
resettable staging USER. Physical Android execution is intentionally deferred
to MB-666; this file is future journey coverage, not execution evidence.
