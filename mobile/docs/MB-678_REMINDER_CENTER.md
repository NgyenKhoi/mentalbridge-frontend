# MB-678 — Today / reminder center with MB-676 A2

## Status and source

The feature now uses the real `GET /api/v1/reminder-overview` consumer instead
of an unconditional unavailable source. Provider code and OpenAPI v1.10.0 are
in backend branch `feat/content-notification-reminder-overview-(MB-676)`;
payload version is 1.0. Provider and consumer use separate task branches and PRs.
Deploy the provider before this consumer. Until rollout, a genuine 404/501
keeps the truthful unavailable state; other failures offer retry without fake rows.

Frontend branch: `feat/mobile-reminder-center-(MB-678)`.
Base: `origin/dev` at `80f627f549f266d1126091c7c49f2fad1f248d46`, updated by a
normal merge on 2026-10-23 in response to integrator review. The four newer dev
commits merge without conflicts; the reminder implementation is unchanged.
OpenAPI v1.10.0 snapshot parity is checked again against the provider branch.
The refreshed head requires its own quality gate and integrator re-review;
backend PR #218 must still merge before mobile PR #220.
The existing user-approved mobile-theme fallback remains in effect because
Stitch tools are unavailable. No new styling framework or navigation shell is added.

## Delivered behavior and ownership

Home → **Hôm nay và lời nhắc** → **Hôm nay / Sắp tới**.

- Today shows enabled Journal/Emotion activity from the owner projection as
  due or completed, then opens the existing Journal/Emotion route. Read inbox
  status never completes an activity. No local scheduler or activity mutation.
- Upcoming shows bounded reminder eligibility estimates, channel/status and
  actual latest delivery records. It does not invent tomorrow's activities or
  claim that an eligible reminder will certainly be sent.
- Paused reminders, quiet hours, disabled channels, processing, failed or
  uncertain sends retain distinct Vietnamese copy. The backend remains authoritative.
- SupportPlan, individual Resource, reassessment and PUSH scheduling are
  explicitly unavailable in this A2 version. Appointment email exposes its
  separate delivery history, with no guessed next time or private appointment ID.
- The presentation component still supports skipped/rescheduled/unavailable
  owner facts for future approved adapters; this provider does not manufacture
  those states for Journal/Emotion. Unsupported categories do not become task rows.
- Existing MB-632 inbox and notification preferences are reused. Supported
  cadence/time changes remain at the existing versioned preference endpoint.

Only reminders, its new thin route, tests/evidence and two Home integration
lines (import + entry mount) are changed. No root navigator, package/lockfile,
shared auth/theme/client infrastructure, CI or other mobile feature is changed.
The mobile integrator should serialize that tiny Home hunk with MB-663/705.

## Consumer and privacy guarantees

`reminder-api.ts` uses the shared authenticated API client through the one public
edge. Requests have no actor/date/timezone overrides and consume Query's abort
signal. Account-scoped keys, cancellation and focus refresh preserve the existing
session/cache rules. Cached facts are hidden during refetch, offline or failure.

The parser validates version, bounds, date/timezone binding, category/action
pairs, unique rows/kinds, channel compatibility and estimate semantics. Unknown
additive fields are ignored; inconsistent/unsupported facts fail closed with a
safe error. Destinations are a closed list of installed routes. No raw private
content, provider payload, token, score, XP or adherence measure is rendered.

The provider exports `reminder-overview-v1.contract.json` from its OpenAPI.
Consumer tests compare the required properties and supported enums; the backend
export command `--check` verifies the entire snapshot semantically. It is never
used as production sample data. Typed test fixtures are imported only by tests.

## UI and accessibility

Uses the current Screen, PrimaryButton, native Pressable and theme tokens.
Controls wrap and have minimum 48px targets with selected/disabled states.
Text retains native scaling without fixed row heights or truncation. There is
no new animation. Loading, empty, unavailable, retry, offline, timeout, session,
permission and changed-preference states are explicit in Vietnamese.

The local `.stitch/mb-678/` prototype is source-reviewed HTML evidence for the
existing layout and state style, not Stitch output or a native screenshot.
Prototype checks covered 360/390/768px, 200% text, keyboard, reduced motion and
state transitions. Actual Android visual/TalkBack verification stays with MB-666.

## Verification

From `mobile/`:

- `npm run lint`: passed after using the named Axios test import.
- `npm run typecheck`: passed.
- Targeted Prettier checks for all feature files, route, Home and Maestro: passed.
- `node node_modules/jest/bin/jest.js --ci --runInBand src/reminders src/screens/UserHomeScreen.test.tsx src/navigation/route-policy.test.ts`:
  6 suites / 74 tests passed. The asynchronous loading assertion waits for Query notification.
- `npm run build:bundle`: Android and iOS JavaScript exports passed with a synthetic
  public edge URL. This is bundle evidence, not a native compile or device run.
- Provider snapshot parity check: passed against backend OpenAPI v1.10.0.
- Temporary actual Nest HTTP → Axios → mobile parser check: due/completed,
  subsequent completion, pause and safe owner outage passed with synthetic sources.

No live private account or paid provider was used. Local Node 24.16.0/npm 11.13.0
emits the project's engine warning; pinned Node 22.13.0/npm 10.9.2 belongs to CI.
Broader unrelated mobile suites and native E2E remain at the staging gate.

## Authored Maestro — NOT_RUN

`.maestro/mb-678-reminders.yaml` signs in, opens Today, refreshes and reuses the
existing inbox/preferences routes. Its owner-data subflow opens private Journal
and checks Upcoming estimates/unsupported capabilities. Both use actual installed
routes; no development fixture screen is shipped.

At MB-666, supply `MAESTRO_MB_REMINDER_USER_EMAIL` and
`MAESTRO_MB_REMINDER_USER_PASSWORD` for a resettable staging USER. Seed through
owner-approved test setup: Journal due and Emotion completed for the configured
local day, Journal/Emotion categories enabled and a compatible deployed A2 edge.
The test cannot rely on a fixed calendar date or production sample rows.

Also verify largest system font, TalkBack focus/selection, reduced-motion setting,
airplane-mode recovery, timezone/day boundaries, a real completion followed by
focus refresh, account change and pause/quiet hours. These remain NOT_RUN until
the physical Android batch; Jest and bundle export do not substitute for them.

## Delivery order

1. Review/merge/deploy backend MB-676 first; route `/api/v1/reminder-overview`
   through the approved public edge to Content alongside existing preferences/inbox.
2. Review/merge this mobile branch and build against that edge; no private
   service URL enters Expo public config.
3. Run MB-666 native journeys and record actual results before release closure.

Delivery slices are provider contract/read model/tests; separate mobile
consumer/UI/tests; evidence/Maestro. GitHub PRs and Jira carry the actual remote
revision, review and delivery status. A published branch does not imply deployment.

## Acceptance states

| State                     | User sees                                                    | Must not show                                            | Authority                                       |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| Due today                 | Owner-backed activity with the installed Journal/Emotion CTA | Fixture tasks or another account's data                  | MB-676 A2; existing activity routes             |
| Completed                 | Factual completed label                                      | Completion inferred from reading a notification          | Journal/AI owner projection                     |
| Upcoming                  | Eligibility estimate, channel and latest delivery record     | Guaranteed send or invented tomorrow tasks               | Content notification preferences and ledgers    |
| Paused/quiet hours        | Explicit paused/quiet-hours copy                             | Coercive streak recovery or bypassed preferences         | MB-562/676                                      |
| Unsupported               | Named unavailable capabilities                               | Fabricated skipped/rescheduled owner facts               | A2 supported categories                         |
| Loading/offline/error     | Vietnamese status and safe retry when online                 | Cached facts while refetching or after an account change | Account-scoped Query and API boundary           |
| Large text/reduced motion | Wrapping native text, 48px controls and no animation         | Truncation or mandatory animation                        | Existing mobile theme; Android evidence NOT_RUN |

Code-first review and authored Maestro satisfy the dev delivery scope. Physical
Android usability and native E2E remain NOT_RUN at the MB-666 staging milestone;
they are not prerequisites to claim a native PASS here.
