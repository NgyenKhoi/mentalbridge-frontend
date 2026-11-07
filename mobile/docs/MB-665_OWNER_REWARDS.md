# MB-665 mobile owner rewards

## Authority and privacy

The React Native client reads the approved Content-owner contracts directly:

- `GET/PUT /api/v1/achievements` and `/preference` for the private achievement
  collection and its strong ETag visibility preference;
- `GET/PUT /api/v1/resource-rewards` for persisted XP/level reads and the
  independent reward visibility preference;
- `GET /api/v1/resource-bookmarks` and
  `PUT/DELETE /api/v1/resource-bookmarks/{resourceId}` for bookmarks;
- `/api/v1/resource-bingo/{weekStart}` plus `/plan-sync` and the
  `/items/{position}/self-confirmation` command for versioned Bingo.

The mobile route table is type-checked against the generated Content OpenAPI
contract so provider path or HTTP-method drift fails TypeScript validation.

Mobile contains no XP thresholds, streak rules, badge defaults, clinical
improvement inference, missed-day failure language, raw Journal content or
emotion notes. Rule and policy versions are displayed from owner responses.
Hidden achievements and hidden XP do not restrict Resources, Journal, Emotion
or SupportPlan.

## Truthful states

- Returning to the route or manually refreshing reloads every owner source. The
  previous snapshot stays visibly stale and read-only only while authority is
  in flight; a failed source is then removed rather than presented as current.
- A lost bookmark or Bingo mutation response becomes uncertain and requires an
  authoritative reload before another command.
- Achievement and Bingo `412` responses clear the stale projection and require
  reload.
- Content-verified Bingo is distinct from a user self-mark. Verified-only,
  retired, paused-plan and superseded-plan tiles are read-only.
- Current ACTIVE/PAUSED plans are synchronized by Content against exact current
  Care `RESOURCE` action references. A board read without a current plan is
  labelled as a historical saved board and stays read-only; mobile does not
  infer which plan produced it.
- A bookmark whose source resource was deleted remains removable and is shown
  as unavailable only after an authoritative `404/410`. Network, `5xx` or
  malformed lookups use a separate retryable state; mobile does not invent its
  title or content.
- The route and all query identities are scoped to the authenticated subject so
  an account switch cannot retain another owner's projection.

## Verification and evidence status

Focused Jest coverage verifies strict contract parsing, the 1000-bookmark
provider boundary, generated-contract routes and headers, visibility opt-out,
focus refresh, stale/read-only presentation, account switch, bookmark
save/remove/retry, `404` versus `503`, plan pause/retirement/history, verified
versus self-marked Bingo, stale ETags and absent/deleted sources.

`.maestro/mb-665-owner-rewards.yaml` is authored for a protected, deterministic
staging fixture and is explicitly **NOT_RUN on dev**. Per Jira MB-665 and the
MB-662 staging policy, native Android execution plus screenshot evidence is
deferred to a designated staging milestone. A valid evidence run must record:

- the backend reward and achievement rule/policy versions;
- one Content-verified unlock;
- the same owner facts on web and Android;
- self-mark persistence after app restart; and
- screenshots produced by the exact staging commit provenance.

No local emulator screenshot is presented as staging evidence for this branch.
