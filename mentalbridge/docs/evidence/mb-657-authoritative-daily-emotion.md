# MB-657 — authoritative daily emotion

Evidence class: controlled fixture-browser and automated contract/component
coverage. The records and identity used here are synthetic.

## Behavior covered

- Dashboard starts with no selected emotion when the local day has no record.
- GREAT, GOOD, OKAY, LOW and VERY_LOW share one label, emoji and color mapping
  across Dashboard, Resources, Journal and emotion-history views.
- A draft selection is labeled as unsaved and does not replace the persisted
  value in the today comparison.
- A saved edit remains the same record after reload and a renewed browser
  session, then appears on Resources with its exact local date and timezone.
- Delete clears the daily record and invalidates progress before refreshed
  metrics render; Resources then reports an absent record.
- Loading, absent, dependency-failure and retry states remain distinct.
- Influence-factor chips were removed because the current contract does not
  persist them.

## Legacy audit

The unused `components/EmotionProgressModal.tsx` fixed-sample chart and its CSS
were removed. Production emotion charts and modal now import the canonical
presentation mapping and read only the emotion check-in APIs. Resources keeps
session storage solely for catalogue view controls; it does not store or infer
an emotion.

## Automated evidence

- `DailyEmotionCheckIn.test.tsx`: empty/default, all required input, retry with
  stable idempotency, unsaved draft, same-day edit, timezone boundary and
  deletion.
- `TodayEmotionSummary.test.tsx`: all five enums, exact date/timezone,
  absent/outage/retry, and cross-route refresh.
- `EmotionProgress.test.tsx`: factual metrics and invalidation while a
  mutation refresh is pending.
- Provider client and BFF route tests: exact-day identity binding, validated
  tombstone and idempotent delete.
- `emotion-check-in.spec.ts`: save failure/retry, reload, renewed session,
  Dashboard → Resources continuity, edit, delete, responsive layout, and
  privacy-safe analytics.

The controlled captures are:

- `mb-657-resources-emotion.png` — desktop Resources summary.
- `mb-657-resources-emotion-mobile.png` — 390 px Resources summary.

Regenerate them after `npm run build` with:

```text
node scripts/run-e2e.mjs tests/e2e/emotion-check-in.spec.ts --workers=1 --reporter=line
```
