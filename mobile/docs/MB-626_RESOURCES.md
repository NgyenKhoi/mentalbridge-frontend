# MB-626 mobile reviewed Resources

## Delivered journey

The authenticated USER route `/(user)/resources` consumes Content's existing
published catalogue/detail contracts and the owner-scoped progress contract:

```text
browse reviewed catalogue → open authoritative detail → record bounded progress
                                                        ↓
                                      reload persisted daily server state
```

Content remains authoritative for eligibility, publication status, locale,
structured copy, interaction semantics, completion mode, safety notes, source
review, and content version. The mobile app does not expose editorial/admin
endpoints, accept an actor ID, retain a second copy of Resource content, invent
completion criteria, or interpret progress as clinical improvement or
SupportPlan adherence.

## Contract matrix

| User action               | Content contract                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Browse reviewed Resources | `GET /api/v1/resources?locale=vi-VN&category&limit&cursor`                                                           |
| Open authoritative detail | `GET /api/v1/resources/{resourceId}?locale=vi-VN`                                                                    |
| Load owner progress       | `GET /api/v1/resource-progress?from={localDate}&to={localDate}`                                                      |
| Record owner progress     | `PUT /api/v1/resource-progress/{resourceId}/{localDate}` with only `status` and server-provided `completedActionIds` |

Strict Zod boundaries accept only `PUBLISHED` summaries and `REVIEWED` details.
Article, practice, timed, and video-confirmation interactions render only the
allowlisted structured fields and interaction configuration returned by
Content. External media opens only a credential-free HTTPS URL.

## Truthful states

- Filters, the selected date, and pagination cursor are bounded UI state;
  catalogue, detail, and progress always reload from the server.
- An authoritative unavailable catalogue is distinct from a valid empty result.
- An archived/missing detail remains unavailable and cannot be completed.
- A progress dependency failure leaves approved content readable but disables
  mutation to avoid overwriting unknown server state.
- Checklist/timed completion uses only action IDs and duration supplied in the
  reviewed interaction contract. Unsupported interactions fail closed.
- Progress copy explicitly avoids adherence, recovery, and improvement claims.

## Automated evidence

Run from `mobile/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
```

Focused Jest coverage includes catalogue pagination and filtering, article,
practice checklist, timed practice, video confirmation, completion and reload,
empty/unavailable states, wrong actor, dependency failures, malformed or
unreviewed payload rejection, and owner-only progress requests.

## Android real-contract demo path

The staging-only flow is `.maestro/mb-626-resources.yaml`. After the shared
native Android build/boot smoke, the protected `mobile-android-smoke` job runs
`npm run e2e:android:resources` with the dedicated verified USER fixture. It:

1. authenticates through the approved public staging edge;
2. browses and filters the published reviewed catalogue;
3. opens an authoritative article detail;
4. records completion when it is not already complete;
5. restarts the app without clearing state; and
6. verifies that the server-owned completion reloads.

CI retains `android-resource-progress.png` and a sanitized manifest inside
`android-native-and-real-contract-<commit>`. Evidence excludes fixture
credentials, Resource bodies, private notes, and request payloads. The `dev`
pull-request gate remains the short mobile TypeScript compile only.

When exact-head proof is required before merging a `dev` pull request, a
maintainer applies the `run-mobile-staging-e2e` label. The existing frontend
workflow then checks out `github.event.pull_request.head.sha`, verifies the
checkout identity, and runs only the native boot plus MB-626 Resource journey
inside the protected `staging-mobile-e2e` Environment. The conditional
`quality-gate` requires that job to succeed while the label is present. Its
`android-mb-626-real-contract-<head-sha>` artifact contains the same sanitized
manifest and screenshot; ordinary pull requests continue to skip native builds.
