# MB-642 — private Journal action in SupportPlan

## Delivered boundary

An eligible native JOURNAL action opens the existing Journal editor with a
bounded occurrence/action/date origin. Fresh owned plan and occurrence reads
resolve that hint; URL values do not authorize writing or completion. The
schedule timezone determines whether new writing is for today's activity.
Invalid, changed, inactive, or unavailable context leaves ordinary Journal
usable without attaching its writing to a plan.

A successful create returns the Journal owner's entry ID as a candidate. The
user explicitly returns to the exact activity, then explicitly checks its
completion. Care receives only `{ journalId }`; no text, mood, tags, preview,
analysis, or client-authored completion fact is sent to Care. A save, revision,
route render, refresh, or return never silently completes the activity or starts
AI analysis/sharing. Existing consent and reuse decisions remain separate.

The owner verifies server creation time, attribution, activation, schedule-local
date, bounded source, and uniqueness. Revisions retain the creation fact. Source
absence/deletion is separate from already accepted immutable completion history.
An outage preserves the candidate and the current status until an explicit retry.
Accepted evidence takes precedence over another URL candidate, including after
ending its action advances the action version.

New eligible proposals include at most one optional bounded Journal action for
a saved JOURNALING preference. Existing plans are not rewritten. Reassessment
continues to preserve its four independent dimensions, source coverage and
insufficient/unavailable states; completion is not adherence or recovery.

## UI and design evidence

The existing shell, route header, four SupportPlan tabs and canonical editor
controls remain the source of truth. Journal uses the shared native Dialog top
layer so the safety widget cannot cover Save. Initial heading focus preserves
the top of the editor on a narrow screen. Dirty close/return/Back confirmation,
pending guards, stable create retries and captured origin protect writing.

Stitch project: [MB-637 SupportPlan v3](https://stitch.withgoogle.com/projects/1256373820415012052).
The user-created native prototype node is
`678423c41ebc47d49538c0d6b85ebe38`. Its existence/export were verified, but native
play is **NOT_VERIFIED**: a fresh unauthenticated browser could not access it.
The raw export is a flattened reference, not proof of interaction.

Generated/corrected screens changed locked chrome and contained inaccurate copy;
those failed visual gates are recorded in `.stitch/mb-642/`. The user explicitly
approved retaining the actual shell/editor and implementing after supplemental
local interaction QA. The local prototype passed five viewports and seven
transition groups; it is a synthetic state model, not live persistence evidence.

## Verification checkpoints

- Focused web transport/origin/route/component tests cover owner isolation,
  closed payloads, returned identity, dirty A/B schedules, retry, source states,
  immutable history, day mismatch and no hidden completion commands.
- After integrating backend MB-647/649 and frontend MB-648, `npm run quality`
  passed formatting, lint, typecheck, paired contracts, Realtime schema checks,
  235 unit suites / 1,326 tests and a production build. The earlier focused
  review/Back regression run passed 29/29; the complete post-sync gate includes
  those fixes.
- `tests/e2e/support-plan-journal-action.spec.ts` owns controlled production-browser
  evidence for plan → canonical editor → save → exact return → explicit check,
  ambiguous retry, dirty/pending Back, revision/deletion/outage, and five viewport
  screenshots. Post-sync controlled Chrome execution passed both Journal and
  Emotion journeys (2/2), including dirty/pending Back. This is not shared-account
  or native evidence.
- Backend post-sync: Journal 145 unit/HTTP tests plus one real disposable Mongo
  integration test and format/lint/typecheck/build/contract/migration checks
  passed. Care's 30 reconciliation/consumer/OpenAPI tests passed again; its earlier
  unchanged owner checkpoint passed 334 tests with disposable PostgreSQL, zero
  skips, and package build. These do not prove shared-account/native execution.
- Mobile post-sync TypeScript passed. Earlier focused evidence on the same mobile
  implementation passed nine suites / 101 tests, targeted lint and formatting.
  Authored Maestro is tracked separately. Actual
  Android real-contract execution is **NOT_RUN — MB-666**; no shared fixture reset
  or forged participation is allowed.

No schema migration, historical plan backfill, native shell redesign, global
workspace redesign (MB-644), or clinical completion interpretation is introduced.

## Post-sync Docker checkpoint

Backend base is `c27e6c79`; frontend base is `aa474e5`. Journal OpenAPI 1.12.0
retains both the MB-649 Companion endpoint and MB-642 creation-evidence read.
No existing Companion runtime, shell or policy was discarded during sync.

`docker compose --profile demo build --progress plain journal-ai frontend` and
`docker compose --profile demo up -d --no-deps --wait --wait-timeout 120 journal-ai frontend`
both exited 0. All ten running services were healthy. Running image IDs matched
Journal `93d32aeda26f` and frontend `d8b32509fcb1`; the previously verified Care
image `ae5915a3459f` was retained because base sync did not change Care code.
Journal live/readiness and frontend root returned HTTP 200. Unauthenticated
Journal/SupportPlan requests returned the expected 307 login redirect.

No shared database migration/reset, volume removal, account change, SQL seed or
authenticated live journey was performed for this checkpoint. Journal's existing
dependency audit warning (one moderate, four high, one critical) was reported;
no unrelated lockfile change or automatic audit fix was applied. GitHub CI is a
separate publication gate, not implied by local or Docker results.
