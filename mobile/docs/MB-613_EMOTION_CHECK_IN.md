# MB-613 mobile emotion check-in and factual progress

## Delivered journey

The authenticated USER route `/(user)/emotion` consumes Journal/AI's existing
owner-scoped emotion contracts:

```text
load today's check-in → create or revision-aware update → history/progress refresh
                                               ↓
                                      owner deletion → refresh
```

Journal/AI remains authoritative for the stored local day, persisted history,
current and longest streaks, and the bounded 7/14/30-day progress windows. The
mobile client does not accept an actor identifier and does not calculate an
average mood, hidden score, recovery verdict, causal factor, or a 90-day
aggregate.

## Contract matrix

| User action                 | Journal/AI contract                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Load today's persisted data | `GET /api/v1/emotion-check-ins/{localDate}`                                                         |
| First daily check-in        | `POST /api/v1/emotion-check-ins` with current IANA timezone, local date, value, and idempotency key |
| Same-day update             | `PATCH /api/v1/emotion-check-ins/{localDate}` with `If-Match-Revision` and idempotency key          |
| Recent history              | `GET /api/v1/emotion-check-ins?limit=30`                                                            |
| Factual progress            | `GET /api/v1/emotion-check-in-progress?timezone={ianaTimezone}`                                     |
| Delete owned check-in       | `DELETE /api/v1/emotion-check-ins/{localDate}` with idempotency key                                 |

Responses are validated strictly at the mobile boundary. Progress must contain
exactly one consistent window for each supported period: 7, 14, and 30 days.
Mutation success updates the owner-scoped current cache and invalidates history
and progress so the screen reloads authoritative server state.

## Truthful states

- A missing current-day record starts with no selected emotion.
- Missing history days remain absent; copy explicitly says they are not evidence
  of improvement or deterioration.
- Loading, no history, cached-refresh failure, dependency failure,
  unauthorized/forbidden, stale revision, mutation failure, and successful
  save/delete have separate recovery behavior.
- Failed saves keep the user's selected emotion and intensity in memory.
- Deletion uses the server tombstone response, removes the matching cached item,
  and then reloads authoritative history and progress.
- The screen renders the factual source interpretation once; private notes are
  not collected or displayed by this journey.

## Automated evidence

Run from `mobile/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
```

Focused Jest evidence covers first create, same-day revision update, remount
reload, sparse history, no history, deletion, 7/14/30 switching, rejection of a
90-day window, owner-only payload boundaries, unauthorized access, dependency
failure, cache invalidation, and malformed authoritative responses.

## Android real-contract demo path

The staging-only flow is `.maestro/mb-613-emotion-check-in.yaml`. After the
single native Android build/boot smoke, the protected `mobile-android-smoke` job
runs `npm run e2e:android:emotion` with the dedicated verified USER fixture.
The flow:

1. authenticates through the real public staging edge;
2. removes an existing current-day fixture record when necessary;
3. persists a deterministic daily check-in;
4. verifies the authoritative 7-day count and history item;
5. restarts the app without clearing state; and
6. verifies the persisted check-in, history, and progress again.

CI retains `android-emotion-persisted.png` and a sanitized manifest inside
`android-native-and-real-contract-<commit>`. The artifact identifies the commit
and run but excludes fixture credentials, private notes, and request payloads.
The `dev` pull-request gate remains the short mobile TypeScript compile only.
