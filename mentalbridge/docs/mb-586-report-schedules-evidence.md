# MB-586 recurring platform reports

ADMIN can create, edit, pause, resume and delete account-activity report schedules
at `/admin/reports`, reached through the admin navigation. The primary action is
**Tạo lịch**; manual generation and report history remain available below it.
Identity owns cadence calculation, occurrence deduplication, authorization,
aggregate generation, artifact retention and download access.

The approved destination is ADMIN report history. No email, external recipient,
health record or additional report type is introduced. Deploy the additive
Identity migration and API in [backend PR #136](https://github.com/NgyenKhoi/mentalbridge-backend/pull/136)
before enabling this consumer.

## States and boundaries

- Loading, empty, populated and recoverable schedule-load failure are independent
  of the manual catalogue/history region.
- Mutations disable concurrent actions, preserve the draft on failure and reload
  authoritative data after success. A 412 conflict reloads the list and asks the
  admin to select the latest schedule before saving again.
- Pause/resume and delete use the latest expected version. Delete uses the shared
  confirmation dialog and preserves existing report artifacts.
- The BFF checks current ADMIN authority, same-origin mutations, bounded JSON,
  UUID/version parameters and the exact implemented Identity schema. Dependency
  responses are validated and minimized before reaching the browser.
- The owner-defined bound is 50 non-deleted schedules, minute-resolution IANA
  local time, daily/weekly/monthly cadence and 1–366 completed UTC days.

## Verification

Focused component and API-boundary tests cover create, lifecycle commands,
stale revision, access/origin validation, malformed dependency responses and
204 deletion. The existing manual-report and admin-navigation tests are included
in the regression checkpoint. Production build, lint, TypeScript and generated
contracts are checked by the repository quality gate.

The Playwright scenario uses a synthetic local ADMIN login and sanitized
same-origin report fixtures. It verifies the lifecycle inside the real admin
shell; real PostgreSQL scheduling/concurrency remains covered by provider tests.
Responsive gates are 1440×900, 1280×800, 768×844 and 375×844, plus 640×400 CSS pixels
as the 1280×800 at 200% zoom reflow equivalent. Each gate asserts no horizontal
overflow. Keyboard focus and reduced motion are exercised. Schedule actions have
44px minimum targets and visible focus; status/error messages use live semantics.

## Visual evidence

Route `/admin/reports`, role ADMIN, sanitized fixture, zoom 100% unless specified.
The desktop shell reserves 260px for navigation. Report content widths are 1100px
at 1440, approximately 943px at 1280, 462px at 768 and 335px at 375; mobile
navigation reflows above the work surface. The 640px reflow equivalent has 600px
content width.

- [Active schedule, desktop](evidence/mb-586-schedule-1440.png)
- [Active schedule, laptop](evidence/mb-586-schedule-1280.png)
- [Active schedule, tablet](evidence/mb-586-schedule-768.png)
- [Active schedule, mobile](evidence/mb-586-schedule-375.png)
- [200% reflow equivalent](evidence/mb-586-schedule-640.png)
- [Source empty](evidence/mb-586-schedule-empty.png)
- [Paused schedule](evidence/mb-586-schedule-paused.png)

The controlled browser test is additional story evidence. The full staging
browser/live cross-stack suite is outside this ordinary dev PR gate.
