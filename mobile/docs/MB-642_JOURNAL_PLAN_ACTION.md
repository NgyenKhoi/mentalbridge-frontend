# MB-642 — private Journal writing in a SupportPlan

## Delivered boundary

The existing native SupportPlan shell and canonical private Journal editor are
retained. A supported Journal action opens that editor with a closed origin:
`source=journal`, `occurrenceId`, `actionId`, `localDate`, and optional candidate
`journalId`. Neither raw writing nor mood/tags/AI results enter plan navigation.

The owned current native plan, exact action/source and schedule/date are read
before writing. A new entry is offered only for today's action in its schedule
timezone. The server's creation instant remains authoritative; an older entry
date or later revision does not create a new completion fact.

Only an actual owner-confirmed create response supplies a candidate ID. Save
and explicit return do not complete the activity. On return, the user explicitly
checks that exact activity; the Care request contains only `{ journalId }`.
Accepted evidence supersedes any new candidate. Missing/deleted source state is
separate from retained occurrence history; uncertainty shows retry, not absence.
No AI-processing, reflection reuse, or specialist-sharing consent is implied.

Drafts are not keyed to query changes. An origin is frozen when writing starts;
even a late context response cannot retarget an ordinary draft. Pending saves
block navigation, unknown outcomes retain the same retry request/key, and native
Back/stack removal asks before discarding a dirty draft. Account changes remount
the account-bound editor/client and abort the old client requests.

## Design evidence

User-approved fallback: native Stitch prototype is a flow reference, while the
source-shell local interaction prototype passed QA before implementation.
See `mentalbridge/.stitch/mb-642/` in the repository. Native Stitch play could
not be verified from the fresh unauthenticated browser; it is not a PASS claim.
No raw Stitch/CDN runtime or new shell was copied into the mobile application.

## Verification status

Focused Jest tests, TypeScript compile and targeted lint are development evidence.
They do not prove an installed Android/iOS app or real provider interaction.
Platform bundle/release verification remains a separate delivery gate.

**Android real-contract execution: NOT_RUN_MB666.** The following authored
files are NOT an executed result:

- `.maestro/mb-642-journal-plan.yaml`: create → save → explicit return → explicit
  check → repeat → revise same entry → check → restart/read persisted completion.
- `.maestro/mb-642-journal-plan-recovery.yaml`: isolated missing/deleted/open and
  accepted-history/unavailable/mismatch cases using a fixed metadata-only link.
- `scripts/verify-android-journal-plan-e2e.sh`: fail-closed author-only runner.

## Protected disposable-fixture prerequisites

Do not use these flows against the shared dev Docker/RDS/MongoDB stack, a real
person's account, fixture-auth bypasses, or forged JWTs. The future MB-666 harness
must provision real owner providers with ephemeral databases and synthetic USER,
record exact app/backend heads, and supply an isolated loopback/emulator edge.
The runner does not prove disposability or provision/reset any fixture itself.

The main fixture needs one active supported `JOURNAL` action scheduled for today,
activation before the run, no accepted fact, and no granted AI-processing consent.
The owner observer must assert creation happens once, revision uses the same
entry, checks carry only IDs, accepted completion is stable on retry, and no raw
text/mood/tags/AI payload reaches Care/events/logs. The future controlled harness
must provide missing/deleted/unavailable/mismatch variants and verify immutable
accepted history, as well as native dirty/pending Back, account change, day/zone
boundary, screen-reader focus and keyboard/safe-area behavior.

For recovery, `MAESTRO_MB642_RETURN_LINK` must be a `mentalbridge://support-plan`
URL with the closed keys above, not raw text, an arbitrary destination, or secret.
Provide expected natural-language source and occurrence labels via the two
`MAESTRO_MB642_EXPECTED_*` variables. Never log credentials, private entry text,
tokens, or request bodies into an evidence manifest. Do not claim completion or
provider coverage from a authored YAML file or a mocked Jest result.
