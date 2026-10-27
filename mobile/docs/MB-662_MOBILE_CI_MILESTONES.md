# MB-662 mobile CI milestone policy and timing evidence

**Status:** implemented; staging execution remains `NOT_RUN (staging milestone pending)` until an intentional workflow run completes.

## Decision table

| Event                             | Mobile cloud work                                                                                             | Required result                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Mobile pull request into `dev`    | None: no install, TypeScript, bundle, native build, or Maestro job                                            | `quality-gate` succeeds and reports `NOT_RUN (staging milestone pending)` |
| Web pull request into `dev`       | Existing web checks only                                                                                      | `quality-gate` requires web success                                       |
| Promotion from `dev` to `staging` | Full `npm run quality`, Android build/install/boot and every approved Maestro journey, iOS build/install/boot | Every staging job must succeed                                            |
| Manual staging milestone          | Same complete staging workflow on the exact selected revision                                                 | Every staging job must succeed                                            |
| Physical-device/local development | Developer-triggered; reuse the development build for JS/TS changes                                            | Optional review evidence, never represented as cloud CI                   |
| Reusable Android APK              | Produced by the Android native milestone and uploaded with revision provenance                                | On demand; no dedicated 8 GB EC2 builder                                  |

Tests, Maestro flows, and verification scripts remain source controlled even
though ordinary development PRs defer their execution.

## Required-check and credential inventory

The `dev` ruleset currently requires the single `quality-gate` status context
with strict base synchronization. The workflow therefore always emits that
context for an applicable frontend/mobile change. Removing the workflow from a
mobile-only PR would leave the required context missing and block the PR.

The staging Android job uses the protected `staging-mobile-e2e` Environment and
requires:

- `MOBILE_STAGING_API_BASE_URL`
- `MB_USER_EMAIL` and `MB_USER_PASSWORD`
- `MB_SUPPORT_PLAN_USER_EMAIL` and `MB_SUPPORT_PLAN_USER_PASSWORD`
- `MB_SPECIALIST_EMAIL` and `MB_SPECIALIST_PASSWORD`

Values are read only at runtime, are not printed, and must identify resettable
non-production fixtures. The iOS smoke uses a synthetic public API URL because
it proves native compile/install/boot rather than a live data journey.

## Exact milestone commands

Run the mobile source and bundle gate:

```powershell
npm ci
npm run quality
```

Run Android compile/install/boot once followed by all approved journeys against
the already installed APK:

```powershell
npm run milestone:android
```

Run iOS compile/install/boot on the pinned macOS/Xcode environment:

```bash
npm ci
npm run native:ios:smoke
```

For a physical Android development device, follow
[`NATIVE_VERIFICATION.md`](NATIVE_VERIFICATION.md): use `adb reverse` for the
local edge, `npm run android` for the development build, and keep Metro running
for Fast Refresh. Native rebuilds are needed only for native/config changes.

## Observed GitHub Actions timing evidence

The evidence below is from repository workflow metadata collected for MB-662.
Durations are wall-clock execution after a runner starts unless identified as
queue delay.

| Workflow run                                                                               | Scope/result                                                              | Observation                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------- |
| [39194171598](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/39194171598) | Staging success; Android was skipped by the former temporary exception    | 44.2 minutes execution                              |
| [39108744218](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/39108744218) | Staging push success; Android skipped                                     | 42.8 minutes execution                              |
| [39032254173](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/39032254173) | Staging attempt 3 failed in Android                                       | 176.8 minutes queued, then 17.9 minutes execution   |
| [37270660271](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/37270660271) | Historical mobile feature gate with web, mobile quality, Android, and iOS | 36.2 minutes execution                              |
| [40495856774](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/40495856774) | Recent dev gate with web plus mobile TypeScript                           | approximately 5.8 minutes on the successful attempt |

These observations do **not** prove that a single build executed for more than
one hour. The verified over-one-hour delay above was runner queue time. The
historical Android job also grouped build and journeys into one command, so it
did not provide reliable phase-level attribution. The new milestone runner
writes `android-milestone-timings.txt` with the build and each journey duration.

## Before/after claim boundary

The policy change removes mobile cloud work from ordinary `dev` pull requests,
so the expected mobile cloud duration there is zero. A comparable after-change
GitHub Actions measurement must come from a real run on the committed workflow;
until then it is intentionally recorded as:

```text
NOT_RUN (staging milestone pending)
```

Do not claim that MB-662 "fixed a >1 hour build." After the first intentional
staging run, record its URL, exact SHA, queue time, job duration, per-phase
Android timings, and final gate result here before making performance claims.

## Constraints and failure semantics

- Hosted-runner queue availability is external capacity; queue time and job
  execution time must be reported separately.
- Android staging is required. Missing credentials, provider unavailability,
  native build failure, journey failure, or a skipped Android job fails the
  staging gate.
- iOS remains a compile/install/boot smoke on the pinned macOS image; live iOS
  journey expansion needs an explicit owner decision.
- The APK artifact is tied to `EVIDENCE_COMMIT_SHA`/`GITHUB_SHA`; never reuse an
  artifact as evidence for another revision.
- Generated native projects, credentials, fixture personal data, and local
  machine paths are not committed.
