# MB-665 mobile owner rewards

## Authority and privacy

The React Native client reads the approved Content-owner contracts directly:

- `GET/PUT /api/v1/achievements` and `/preference` for the private achievement
  collection and its strong ETag visibility preference;
- `GET/PUT /api/v1/resources/rewards` for persisted XP/level reads and the
  independent reward visibility preference;
- owner bookmark list/save/delete endpoints;
- versioned weekly Bingo read, current-plan sync and `If-Match` guarded
  self-confirmation endpoints.

Mobile contains no XP thresholds, streak rules, badge defaults, clinical
improvement inference, missed-day failure language, raw Journal content or
emotion notes. Rule and policy versions are displayed from owner responses.
Hidden achievements and hidden XP do not restrict Resources, Journal, Emotion
or SupportPlan.

## Truthful states

- Each source fails independently and old data is removed when authority cannot
  be refreshed.
- A lost bookmark or Bingo mutation response becomes uncertain and requires an
  authoritative reload before another command.
- Achievement and Bingo `412` responses clear the stale projection and require
  reload.
- Content-verified Bingo is distinct from a user self-mark. Verified-only,
  retired, paused-plan and superseded-plan tiles are read-only.
- Current ACTIVE/PAUSED plans are synchronized by Content against exact current
  Care `RESOURCE` action references. No-plan owners keep the general catalogue,
  bookmarks and optional collections without a personalized-plan label.
- A bookmark whose source resource was deleted remains removable and is shown
  as unavailable; mobile does not invent its title or content.
- The route and all query identities are scoped to the authenticated subject so
  an account switch cannot retain another owner's projection.

## Verification and evidence status

Focused Jest coverage verifies strict contract parsing, exact endpoints and
headers, visibility opt-out, partial/unavailable sources, account switch,
bookmark save/remove/reload, plan pause/retirement, verified versus self-marked
Bingo, stale ETags and absent/deleted sources.

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
