# MB-549 appointment reminder consumer evidence

Evidence class: local source, contract, BFF and component tests using synthetic appointment data. This is not proof of a live provider send or cross-service deployment; MB-550 owns those checks.

The Content OpenAPI snapshot was synchronized from the MB-517 backend branch and its generated types were refreshed. The USER notification settings page exposes `email.appointmentRemindersEnabled` as a separate persisted opt-in, disabled by default, next to the existing timezone and quiet-hour controls. The page explains the approximately one-hour, single-reminder policy, cancellation/reschedule invalidation, quiet-hour suppression, and separation from the daily digest. The BFF validates the field and preserves optimistic concurrency; failed saves remain visibly unsaved.

The safe email entry path `/appointments/{appointmentId}` now resolves inside the authenticated USER dashboard. It displays the matching account-owned appointment from the existing Consultation list, or a generic not-found state if that ID is absent. It does not place appointment details or sensitive content in the email URL.

Focused check from `mentalbridge/`:

```text
npm.cmd test -- app/api/notifications/preferences/route.test.ts 'app/(dashboard)/notifications/page.test.tsx' features/appointments/components/AppointmentRequestPanel.test.tsx lib/content/content-validation.test.ts lib/content/notification-preference-client.test.ts
PASS: 5 files, 36 tests (before the additional failed-save test).

npm.cmd test -- app/api/notifications/preferences/route.test.ts 'app/(dashboard)/notifications/page.test.tsx' features/appointments/components/AppointmentRequestPanel.test.tsx lib/content/content-validation.test.ts lib/content/notification-preference-client.test.ts
PASS: 5 files, 37 tests (final focused run).

npm.cmd run quality
PARTIAL: formatting, lint, typecheck, generated contract checks and 130 unit-test files / 628 tests passed. The build step could not fetch the project's existing Google Fonts in the restricted network environment.

npm.cmd run build
PASS with approved network access; Next.js production build lists `/appointments/[appointmentId]` as a dynamic route.
```

The backend-owned email template was inspected: its content is restricted to local appointment date/time, timezone, chat/video modality and the in-app link. No Journal, assessment, ConsultationBrief, health or chat content is included. The authenticated detail route can render account-private content only after entry into the app.
