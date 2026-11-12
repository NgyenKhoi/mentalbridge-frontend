# MB-666 Android capstone persona and evidence gate

Source: [Jira MB-666](https://vunguyenkhoi47.atlassian.net/browse/MB-666)

## Current execution status

`TEST_AUTHORED_NOT_RUN — staging milestone pending`

This `dev` delivery authors the protected fixture manifest, reset handshake,
Persona A/B Maestro batch, provenance and evidence index. It does **not** claim
native execution. Under MB-662, only an exact `dev -> staging` promotion or an
approved manual run on `dev`/`staging` may create `STAGING_PASS` evidence. A
feature branch, unit test, browser screenshot, Android boot screenshot, or
authored YAML is not milestone proof.

## Business narrative and claim boundary

### Persona A — time-constrained student

The synthetic USER completes the policy-owned PHQ-9/GAD-7 sequence, reads the
immutable Guide, reaches the Care-decided next action, reviews practical plan
preferences, re-enters through Home/Today, completes Resource, Emotion and
private Journal actions, reviews factual progress, and deliberately keeps or
changes the plan after reassessment.

The reassessment, rewards and comparison scenes load a labelled synthetic
14-day snapshot before the UI action. The evidence index records
`preseededHistoryDays: 14`; it never suggests that 14 days elapsed during the
demo or that the person clinically improved. Mobile displays only source-owned
facts and choices.

### Persona B — professional-support path

The synthetic USER follows the policy-owned professional-help path, discovers
an approved specialist and available slot, submits the authorized appointment
request and returns to the plan with the persisted appointment state. The chat
scene is optional and runs only when the protected provider supplies an
eligible appointment and remote peer; otherwise it is recorded as `DEFERRED`,
never silently passed. Payment and video are outside the core scenario.

Safety/help-now remains independently authoritative. Neither scenario treats a
score alone as diagnosis, emergency state, recovery, or specialist matching.

## Screen-to-source evidence map

| Required small-screen proof  | Scene(s)                                                | Owning Jira/contracts                  | What the screenshot proves                                                   | What it must not claim                                                    |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Home                         | `persona-a-home-plan`                                   | MB-663 Home decision                   | Current authoritative next step opens the owned route and returns            | A locally ranked or invented next step                                    |
| Screening result + Guide CTA | `persona-a-screening-guide`                             | MB-667, MB-668; Care assessment/Guide  | Paired screening reaches the persisted Guide and exact next action           | Diagnosis, recovery or client scoring                                     |
| Today / plan                 | `persona-a-home-plan`, `persona-a-plan-personalization` | MB-638, MB-669; Care SupportPlan       | Practical preferences and current plan remain separate, explicit authorities | Automatic activation or hidden plan mutation                              |
| Action detail                | personalization/resource scenes                         | MB-626, MB-638, MB-640                 | The selected action opens the source-owned destination                       | Completion inferred from navigation                                       |
| Emotion / Journal            | `persona-a-emotion-plan`, `persona-a-journal-plan`      | MB-641, MB-642                         | Private source action saves, returns and reconciles by owner ID              | Raw Journal text in Care/evidence; mood outcome inference                 |
| Progress / Bingo             | resource/rewards scenes                                 | MB-626, MB-665, MB-670                 | Persisted owner progress and verified versus self-marked facts               | Local XP rules, shame language or cross-owner data                        |
| Review / adjust              | three reassessment scenes                               | MB-645, MB-664                         | Resume, source-backed summary, explicit keep and comparison-before-change    | Pretending seeded history elapsed live or auto-replacing a plan           |
| Specialist path              | `persona-b-professional-support`                        | MB-643; Consultation discovery/booking | Approved specialist, slot, request and persisted return state                | Local eligibility, real payment or confirmed appointment before authority |

The executable mapping is versioned in
`fixtures/mb-666-personas.json`. Every required screen must be mapped or the
manifest validator fails.

## Protected fixture/reset contract

The staging Environment supplies two synthetic accounts, a protected fixture
control URL/token and non-sensitive expected labels/IDs. Credentials and the
control URL/token are never committed, printed or uploaded.

Before **every** scene,
`scripts/prepare-mb666-fixture.mjs` sends an authenticated reset command with:

- exact frontend and backend commit SHAs;
- immutable fixture dataset version;
- persona, scene and reset-profile IDs from the reviewed manifest.

The controller must return `READY` with the same dataset/persona/scene/profile,
the declared `0` or `14` pre-seeded history days and a safe immutable snapshot
ID. Any mismatch, redirect, non-HTTPS remote URL or failed reset closes the
gate. Only the sanitized receipt is stored. The fixture controller is staging
test infrastructure, not a public product endpoint.

Required protected secrets:

- `MB666_FIXTURE_CONTROL_URL`, `MB666_FIXTURE_CONTROL_TOKEN`;
- `MB666_PERSONA_A_EMAIL`, `MB666_PERSONA_A_PASSWORD`;
- `MB666_PERSONA_B_EMAIL`, `MB666_PERSONA_B_PASSWORD`.

Expected synthetic labels, slot IDs and result copy are repository/environment
variables named `MB666_*`; none may identify a real person.

## One-build execution

The approved staging job compiles, installs and boots one release APK, runs the
existing baseline journeys, then calls:

```bash
npm run e2e:android:capstone
```

The capstone runner resets each independent snapshot, aliases only the two
protected synthetic credentials to the already reviewed feature flows, runs
Maestro on the already installed app, and captures one task-focused screenshot
per scene. It never invokes Gradle or `expo run:android`.

`npm run milestone:android` records build and batch timings in
`android-milestone-timings.txt`. The MB-666 batch additionally writes:

- `mb-666-journey-status.tsv` — per-scene `STAGING_PASS`, `STAGING_FAIL` or
  `DEFERRED` plus duration;
- `mb-666-fixture-<scene>.json` — sanitized reset receipt;
- `mb-666-persona-*.png` — Android task screenshots;
- `mb-666-evidence-index.json` — exact revisions, fixture provenance,
  seeded-history disclosure, Jira traceability and final result.

Every required scene and screenshot must pass for the index to report
`STAGING_PASS`. The staging quality gate fails if Android fails or is skipped.

## Physical-device rehearsal on Windows

Use only an approved synthetic fixture and a development build. Do not label a
local rehearsal as staging evidence.

```powershell
adb devices
$env:ANDROID_DEVICE = '<device-serial>'
adb reverse tcp:8080 tcp:8080
$env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080'
npm run android
```

Keep Metro running for Fast Refresh. Rebuild only after native/config changes.
For a protected exact-revision local milestone, provide the same provenance,
fixture controller and synthetic environment inputs used by CI, then run
`npm run milestone:android`. Generated native projects, APKs, raw Maestro
debug dumps, credentials, tokens, request bodies and private text stay ignored.

## Usability cohort record

The capstone packet requires 5–8 task-focused sessions or a documented
practical cohort. Record only non-clinical observations; participants never
need to disclose health information.

| Session | Device/viewport | Assigned task | Completed without help | Confusion point | Recovery/action | Evidence reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1–8 | pending milestone | Home → exact next step; plan action; review choice; or specialist path | pending | pending | pending | pending |

Do not replace human task observations with unit tests or claim an unperformed
session. Store the completed, de-identified table alongside the milestone run
record before Jira completion.

## Verification and completion checklist

- [x] Persona/interaction storyboard and source mapping are versioned.
- [x] Deterministic synthetic fixture manifest and fail-closed reset handshake
      are versioned.
- [x] Maestro batch, per-scene duration/status and sanitized evidence index are
      versioned.
- [x] Physical-device and protected staging instructions are versioned.
- [ ] Exact frontend/backend pair has run in the approved staging milestone.
- [ ] Required Android screenshots/video are attached to the milestone record.
- [ ] Five to eight de-identified usability observations are recorded.
- [ ] Any provider-blocked or unverified optional lane is explicitly marked
      `BLOCKED_PROVIDER` or `DEFERRED`.

Until the unchecked items are complete, Jira MB-666 remains evidence-pending
even when this implementation PR is code-ready.
