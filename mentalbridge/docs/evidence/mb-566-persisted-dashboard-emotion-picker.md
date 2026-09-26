# MB-566 persisted dashboard emotion picker evidence

## Scope

The dashboard now reads and writes the existing MB-510 owner-scoped daily
emotion check-in. It does not introduce another persistence model and does not
use the self-reported value for diagnosis, safety classification, recovery, or
SupportPlan decisions.

The user chooses an emotion and an independent intensity from 1 to 5. No value
is selected when the authenticated owner has no check-in for the current local
day. The browser sends the IANA timezone and local date on create, and sends the
persisted revision on a same-day update.

## Automated evidence

- Route-handler tests cover authenticated create, owner isolation at the BFF
  boundary, exact revision forwarding, invalid input, session expiry, not-found
  and sanitized dependency failures.
- Component tests cover empty state without a default mood, create, persisted
  reload, same-day update, failed-save truthfulness, idempotent retry, session
  expiry, and local-day rollover in the user's IANA timezone.
- `tests/e2e/emotion-check-in.spec.ts` is a controlled fixture-browser journey
  covering empty state, a failed first save, retry with the same idempotency
  key, refresh restoration, and revision-aware update from the dashboard. It
  produces `mb-566-persisted-dashboard-emotion-picker.png` with synthetic data
  after the persisted update is confirmed.

Run the focused checks with:

```text
npx vitest run app/api/emotion-check-ins/route.test.ts app/api/emotion-check-ins/[localDate]/route.test.ts features/emotion-check-in/DailyEmotionCheckIn.test.tsx
npm run build
npm run test:e2e -- tests/e2e/emotion-check-in.spec.ts
```

The fixture uses synthetic data only. It is not live cross-stack evidence.
