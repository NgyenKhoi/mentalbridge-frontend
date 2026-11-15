# MB-632 — mobile notification inbox and preferences

## Scope and authority

The USER workspace now links to a persisted notification inbox and a separate
delivery-preference screen. Content/Notification remains the only authority for
inbox lifecycle, read times/counts, channel/content-group choices, quiet hours,
email settings and preference versions. Identity still determines the subject
and role; requests contain no actor/account/owner identifier.

Source: backend `dev` commit `7ca921be72a59f12225a6dce83ae97c0b546c346`,
`contracts/openapi/content-notification-service.yaml` v1.6.0, plus existing
Community and reviewed Resource detail consumers. No backend change, dependency,
schema migration, local database or workflow change is introduced.

## UI brief and states

- USER home → notifications → selected installed destination, or preferences.
- Inbox is a chronological row list with explicit read/unread text; no clinical
  verdict, metric or sensitivity inference is added.
- Preferences group channels, content categories, quiet hours and existing email
  settings, with one primary save action. The current mobile Screen, buttons,
  native Switch/TextInput and MentalBridge tokens are reused; no new visual
  direction or styling framework is introduced.
- Initial loading, empty inbox, dependency/session/permission errors, pending
  mutations, confirmed read/save, stale preference and unavailable target states
  have local recovery. Content is hidden during authoritative refresh or failure.
- Controls have names, read/checked/disabled states and at least 48px button/input
  targets. Wrapped action rows and the existing 560px reading column avoid fixed
  screen widths; no new animation is introduced.
- Native screenshots, screen-reader/keyboard/zoom/device visual testing are not
  claimed; these remain part of the owner's consolidated device verification.

## Acceptance-criteria map

| Capability                           | Implementation / evidence                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persisted inbox and read/unread      | `NotificationInboxScreen`, strict active item/page parsing; server unread count                                                                               |
| Bounded pagination                   | Explicit load-more; `limit=20`, opaque returned cursor, no automatic prefetch; reject inconsistent/repeating cursor                                           |
| One/all read                         | Idempotent owner PATCH/POST; no optimistic read time/count or extra idempotency protocol; refetch after command                                               |
| Approved deep links                  | Exact action + targetId + published href allow-list, converted to installed mobile routes                                                                     |
| Deleted/unavailable target           | Revalidate notification with mark-read before opening; fresh target-owned detail fetch and safe 404/dependency states                                         |
| Persisted preferences                | GET/PATCH public preferences endpoint; exact strong If-Match equals response version; malformed ETag fails closed                                             |
| Channel/content/quiet hours          | Existing values editable; IANA timezone and HH:mm input checks; overnight window supported; disabled categories do not delete/filter historical inbox locally |
| PUSH honesty                         | Switch reflects this device only (registered + system permission granted); in-app off forces push off; denied/unavailable states say so                       |
| Privacy                              | Strict response fields; no raw Journal/assessment/chat/provider fields; no payload logs or on-device notification persistence                                 |
| Reload/restart/device/account change | Fresh mount/focus GET, owner-scoped query keys, account-keyed editor; abort old route HTTP and suppress late old-account writes/navigation                    |

## Public paths

```text
GET   /api/v1/notifications?limit=20&cursor=<opaque>
PATCH /api/v1/notifications/{notificationId}/read
POST  /api/v1/notifications/mark-all-read
GET   /api/v1/notification-preferences
PATCH /api/v1/notification-preferences  (If-Match: "<version>")
```

Read commands have no actor payload. Preference writes contain only supported
preferences, never their persisted version or updated time. Validation failures
retain the draft. Conflicts and ambiguous failures reload authority before
another write; a failed reload removes writable controls. The backend retains
the final delivery/quiet-hour decision.

## Approved links

| Notification action / exact public href       | Mobile destination                                         |
| --------------------------------------------- | ---------------------------------------------------------- |
| OPEN_JOURNAL / `/journal`                     | USER Journal                                               |
| OPEN_MESSAGES / `/messages`                   | Shared MB-631 appointment chat selector                    |
| OPEN_APPOINTMENTS / `/appointments`           | Owner appointment collection                               |
| OPEN_RESOURCES / `/resources`                 | Reviewed resource catalogue                                |
| OPEN_ASSESSMENTS / `/assessments`             | USER assessment journey                                    |
| OPEN_RESOURCE / `/resources/{targetId}`       | Exact resource detail, freshly loaded                      |
| OPEN_COMMUNITY_POST / `/community/{targetId}` | Existing Community detail via validated `postId` parameter |

No href is passed directly to Linking/router. External/protocol-relative,
encoded/traversal, query/fragment, mismatched type/path/ID, and invalid/repeated
target parameters cannot open content. The notification title/body is not passed
to a destination or used as a substitute for its authoritative content.

## Executed verification

From `mobile/` on the final implementation:

```powershell
npm run lint
npm run typecheck
npm run test:ci -- src/notifications src/community/CommunityScreen.test.tsx src/community/CommunityRoute.test.tsx src/screens/UserHomeScreen.test.tsx src/resources/ResourceDetailScreen.test.tsx
```

- Focused Jest: **9 suites / 95 tests passed**, including related Resource
  unavailable/reload and Community regressions.
- Lint and strict non-emitting TypeScript: passed.
- Formatting: check only the MB-632 changed files; not a global formatting claim.
- The exact-head normal dev gate must be green before handoff. Its mobile lane
  is compile-only; broader web regression runs in CI, not duplicated locally.

## Device verification and push

The owner requested consolidated Android testing later because there is no
mobile staging environment (2026-10-11). **Android E2E DoD is unverified**, not
passed. No native build, protected Android label/job, staging URL or synthetic
execution evidence is added for MB-632. UI runtime/visual verification remains
outstanding for the same device-test checkpoint.

Future device checklist: load real inbox → open an approved destination → return
and verify persisted read state → save channel/category/overnight quiet hours →
restart app and verify server state; repeat with an expired/deleted target and
dependency failure. Use an approved test USER; do not put credentials or private
content in chat, screenshots or committed fixtures.

Push is real since MB-849. Enabling it asks for the Android notification
permission, fetches an Expo push token and registers this device with
`PUT /api/v1/push-devices/{installationId}`; switching it off, losing the
permission or signing out sends `DELETE` for the same installation. Delivery
uses the channel `mentalbridge-chime-v1` with the MentalBridge sound. The
preferences switch reads this device's registration and permission, so a
stored PUSH preference alone is never shown as active delivery. A tap opens the
approved destination: emotion reminder/milestone kinds open the Home emotion
section, every other kind uses the same inbox mapping as the in-app list, and
malformed data opens the inbox. The notification is marked read on tap. Push
payloads carry only reviewed ids and the closed action, never private content.

Navigation guidance checked against [Expo SDK 57 Router documentation](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
