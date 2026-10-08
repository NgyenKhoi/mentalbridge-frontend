# MB-627 private Journal and bounded AI assistance

Jira: [MB-627](https://vunguyenkhoi47.atlassian.net/browse/MB-627).
Baseline: frontend `dev` at `9a959ca` after MB-626 was merged.
This story follows [Mobile Delivery Contract v1](MB-611_MOBILE_DELIVERY_CONTRACT_V1.md).

## Ownership and approved boundaries

The USER home opens `/(user)/journal`. Journal/AI owns encrypted entries,
revisions, owner authorization, processing status and normalized output. Care
owns the current disclosure and consent decision. Journal/AI checks current
consent and entitlement server-side before processing; mobile never calls an
internal entitlement endpoint or decides that a subscription permits AI.

Source contracts are the backend `dev` OpenAPI files
`contracts/openapi/journal-ai-service-v1.yaml` (1.7.0) and
`contracts/openapi/care-service-v1.yaml`. No backend contract or schema changes.

| Action           | Public contract                                                                        | Mobile boundary                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Browse / open    | `GET /api/v1/journals?limit=20&cursor`, `GET /api/v1/journals/{id}`                    | Authenticated subject in query keys; validate returned owner and identity                                              |
| Create           | `POST /api/v1/journals`                                                                | Only `clientEntryId`, `occurredAt`, `content.text`, explicit `mood`, `tags`; stable idempotency key on uncertain retry |
| Edit             | `PATCH /api/v1/journals/{id}`                                                          | `If-Match-Revision` from loaded entry; only text/mood/tags; no silent stale overwrite                                  |
| Delete           | `DELETE /api/v1/journals/{id}`                                                         | Explicit confirmation, validate owner tombstone, refresh history                                                       |
| AI permission    | Care disclosure and `/consents/ai-processing/authorization`                            | Current `vi-VN` disclosure, explicit checkbox/decision, fresh read before every request/retry                          |
| Exact reflection | `POST /journals/{id}/revisions/{revision}/analysis-jobs`, `GET /analysis-jobs/{jobId}` | No request body; validate job ID + source entry + exact eligible revision (1–200)                                      |
| Time comparison  | `POST /longitudinal-analysis-jobs`, `GET /longitudinal-analysis-jobs/{jobId}`          | Equal bounded half-open UTC periods, 7/14/30 days each; preserve server coverage/source revisions                      |

All paths above have `/api/v1` prefixes. No actor/account ID, score, diagnosis,
local sentiment or client consent/entitlement claim is submitted to Journal.
The public API edge and existing bearer/correlation/error conventions are reused.

## UX and integrity

- Writing, history, and AI have independent loading/error states. Missing or
  revoked consent and provider/entitlement outages do not disable manual CRUD.
- Draft text, mood and tags stay in React memory. No autosave or background AI
  submission. Closing an unsaved editor asks for confirmation; Android hardware
  back is guarded and the iOS route gesture is disabled while using this editor.
- An ambiguous save locks edits and retries the identical body/key. A revision
  conflict preserves the draft and blocks saving until the user explicitly
  chooses to open the authoritative latest version.
- Subject changes remount all draft/analysis state, even without a navigation
  remount. Account-route removal cancels pending transport requests.
- `RUNNING` is shown as queued/processing using server `attemptCount`.
  `FAILED` preserves the server terminal reason with safe localized copy;
  retry requires a new explicit action and a fresh consent read. No fallback AI
  result. Stale/deleted sources cannot be retried as if they were current.
- Results are supporting reflections, not clinical authority. Coverage is the
  server's coverage, not an average or local inference. Insufficient comparison
  coverage shows the limitation and no comparative verdict. A source disclosure
  retains exact revision/window/provider/model/prompt/time provenance.
- Editing hides the old reflection. Each saved revision has a separate request
  identity; a revision number alone is never used as an account-wide marker.

## Reload and privacy

SecureStore retains only `{requestKey, jobId?}` under an authenticated-subject
and exact-source key. It never stores text, AI output, permissions, entitlement,
or a journal body. This minimal pointer is necessary because the published
contract provides job GET by ID, not a latest-job listing endpoint.

After remount/restart, entries come from Journal GET and a saved job pointer
causes only GET/polling. An unresolved POST has no job ID and can be reconciled
only by explicitly retrying the same request key. A different device or removed
SecureStore has no pointer: no old result is fabricated or automatically
requested. Query data is memory-only and existing logout clears the QueryClient.
No journal/AI data is added to analytics, notifications, profile, events, logs,
or unrelated features.

## Change-to-test map

| Required behavior / DoD                                      | Focused evidence                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Owner CRUD, create/edit/delete and validation                | `journal-api.test.ts`, `JournalScreen.test.tsx`                                           |
| Stale revision and uncertain write retry                     | Editor regression tests; draft kept, save blocked, same key/body on retry                 |
| Consent missing/revoked/outdated, grant and fresh permission | `JournalAnalysisPanel.test.tsx`; cached permission cannot trigger processing after revoke |
| Entitlement/provider failure and explicit retry              | Authoritative failure cases; no local fallback or hidden authority                        |
| Processing/completed and exact source validation             | Job-state schemas + cross-ID/revision rejection                                           |
| Insufficient data and source/coverage provenance             | Trend schema/UI tests; no sparse-data comparative claim                                   |
| App reload / subject change                                  | Entry reload, GET-only job restore, draft reset and subject-scoped marker tests           |
| No raw-content persistence                                   | Strict marker-schema tests + manual boundary review                                       |
| Actual Android real-contract flow                            | Protected exact-head gate described below; not satisfied by a committed flow alone        |

Local checks use Node 22.21.0/npm 10.9.4; CI pins the agreed Node
22.13.0/npm 10.9.2 baseline. Lint, typecheck, focused Jest and shell/Node syntax
checks were run locally. Full frontend `dev` checks are required in PR CI.

An accidentally broad Jest invocation also found five existing
`SupportPlanScreen.test.tsx` failures in the unmodified merged baseline. Those
are not Journal failures and are not fixed in this story; the complete mobile
staging gate remains responsible for surfacing them before release. Ordinary
`dev` mobile gates still do only a clean install and TypeScript compile.

## Protected Android proof

The `.maestro/mb-627-journal.yaml` journey is wired into the staging Android
job and the existing optional exact-head job. A maintainer applies
`run-mobile-journal-e2e` to a same-repository PR into `dev`. The gate:

1. runs inside `staging-mobile-e2e` and checks out/verifies the PR head SHA;
2. runs focused Journal regressions, lint and typecheck;
3. uses the dedicated protected staging USER and public edge when all inputs
   exist, or runs unmodified Identity, Care and Journal/AI services plus real
   ephemeral PostgreSQL/MongoDB databases on backend `dev`;
   controlled setup creates only a synthetic Care profile through public
   `PUT /api/v1/profile`, because consent requires an existing profile. Consent
   itself is still an explicit UI action, not seeded or bypassed;
4. compiles/installs/boots the exact-head Android release app;
5. proves save → explicit consent when needed → explicit AI request →
   authoritative terminal outcome → app restart → persisted entry/job GET;
6. uploads `android-journal-real-contract.txt`, a synthetic-only final screenshot
   and routing-only logs in `android-mb-627-real-contract-<head-sha>`.

Controlled mode deliberately leaves Consultation unavailable. The real Journal
worker must persist `ENTITLEMENT_UNAVAILABLE`, with manual Journal persistence
still working. This is the Jira-allowed **safe failure** path, not a fabricated
permission/result or a claim of successful real-provider AI output. Credentials
and detailed Maestro debug reports are excluded from artifacts. Existing
MB-626 evidence and ordinary short `dev` checks remain supported.

Reproduce from `mobile/` with a dedicated synthetic verified USER and approved
public edge, then run `npm run native:android:smoke` and
`npm run e2e:android:journal`. CI must pass for the final head and the artifact
must contain the successful manifest before this story is handed off. No merge
is performed by this task; reviewer approval remains separate.
