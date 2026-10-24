# MB-621 authoritative admin console closure

MB-621 consolidates administration operations under the protected
`/admin/[[...section]]` route. The route shell is presentation-only:
authorization and business ownership remain in the backend and in each bounded
same-origin BFF.

## Production route and source map

| Route | Production consumer | Same-origin boundary | Authority / evidence |
| --- | --- | --- | --- |
| `/admin/dashboard` | `AdminOperationsDashboard`, `ProductJourneyMetricsPanel` | `/api/admin/operations/dashboard`, `/api/admin/product-journey-metrics` | MB-584 aggregate operations and MB-596 privacy-bounded journey projections |
| `/admin/retention` | `AdminRetentionGovernance` | `/api/admin/retention/**` | MB-673 Identity-coordinated retention and deletion governance |
| `/admin/accounts` | `AdminAccountManager` | `/api/admin/accounts/**` | Identity account state and ADMIN authorization |
| `/admin/specialists` | `AdminSpecialistReviewSection` | `/api/admin/specialist-profiles/**` | Consultation specialist review authority |
| `/admin/content` | `AdminContentManager` | `/api/admin/resources/**` | MB-589 governed draft/review/publication/archive lifecycle |
| `/admin/moderation` | `AdminCommunityModerationSection` | `/api/community/admin/moderation-cases/**` | Community moderation cases and audited decisions |
| `/admin/appointments` | `AdminAppointmentMonitor` | `/api/admin/appointments` | MB-588 read-only Consultation operations view |
| `/admin/disputes` | `AdminAppointmentDisputes` | `/api/consultation/admin/appointment-disputes/**` | Consultation dispute settlement authority |
| `/admin/audit` | `AdminAuditLog` | `/api/admin/audit`, `/api/admin/audit/export` | MB-587 minimized browse/export projection |
| `/admin/reports` | `AdminReportsSection` | `/api/admin/platform-reports/**` | MB-585 immutable aggregate report jobs and artifacts |
| `/admin/payments` | `AdminPaymentsManager` | `/api/consultation/admin/payments` | MB-515/MB-622 authoritative commercial facts |
| `/admin/payouts` | `AdminPayoutsManager` | `/api/consultation/admin/payouts` | MB-516/MB-622 earning and payout facts |

The catch-all page calls `requireCurrentAccount(['ADMIN'])` before rendering.
Every listed BFF also performs its own ADMIN check. The layout is not treated as
an authorization boundary.

## Removed prototype and dead paths

`RoleWorkspace` is now specialist-only. The unreachable admin mode, its
hard-coded people/appointments/audit/report/payment data, generic mutation
drawer and alternate admin navigation were removed. Four standalone demo
managers that had no production owner-backed consumer were removed:

- `AdminUsersManager`
- `AdminAssessmentsManager`
- `AdminModerationManager`
- `AdminAppointmentsManager`

Assessment authoring and AI evaluation are not exposed as admin destinations
because MB-621 grants no clinical authority. Fabricated platform uptime,
security/privacy scores and unsupported health claims remain excluded.

## Privacy and authority review

- Dashboard and reports are aggregate and preserve source/as-of metadata.
- Appointment operations exclude ConsultationBrief content, chat bodies,
  SessionSummary clinical/private content, Journal data and assessment answers.
- Admin actions cannot mutate Care, Journal, SupportPlan, SessionSummary or chat
  content.
- Resource reviewer provenance comes from the Content-owned lifecycle.
- Payment and payout screens read backend facts; they do not derive balances,
  settlement or commercial state in the browser.
- Missing, delayed or failed sources remain loading, empty, stale, unavailable
  or error states owned by their production consumers.

## Browser and automated evidence

The controlled browser specs for accounts, resources, reports, specialist
review, Community moderation and Identity role routing remain the end-to-end
evidence for their owner paths. `AdminWorkspace.test.tsx` adds a consolidated
route-map regression test for all 12 destinations and rejects the former
assessment/AI prototype routes. `RoleWorkspace.test.tsx` proves the specialist
shell cannot render an alternate admin console or its fabricated records.

Exact command results are recorded in the MB-621 pull request.
