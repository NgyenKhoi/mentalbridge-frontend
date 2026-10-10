# MB-629 — Mobile approved specialist discovery

## Experience brief

- USER job: find a currently discoverable approved specialist, inspect their
  public profile, and select a server-provided 60-minute online slot.
- Route: `/(user)/specialists`, entered from USER home. One reading column,
  existing native tokens, 48px controls, wrapping filter choices; target phone
  widths 375px/768px and larger Expo layouts without horizontal overflow.
- Primary actions: search with supported criteria → open profile → select a
  freshly revalidated slot. Back preserves the applied criteria and list page.
- Authority: Consultation OpenAPI v1.12.0, `GET /api/v1/specialists` and
  `GET /api/v1/specialists/{specialistAccountId}` through the shared public edge.
  Public discovery is the approval/selectability boundary, not the private
  specialist profile endpoint. Server ordering, explanations, rating aggregates,
  online capability and booking handoff policy are authoritative.
- States: loading, results, source-empty/filter-empty, next-page cursor stale,
  dependency failure, unauthorized/forbidden, unavailable profile, stale slot,
  selection verification and selected-slot summary. Failed fresh reads hide
  stale profiles/slots. Account changes discard the whole local journey.
- Excluded: booking commands, prices, physical/phone consultations, credential
  claims, local ranking/eligibility, health-content personalization and local
  persistence. Selection is an in-memory downstream handoff, not a reservation.
  `BROWSE_ONLY` permits a slot preview but never a booking handoff.

## Verification map

Contract/API tests cover strict public schemas, supported GET criteria, identity,
exact duration, server capability and malformed/private responses. Screen tests
cover neutral FREE browsing, filter/page navigation, authoritative profile and
ratings, refresh failures, suspension, stale-slot/version checks and subject
changes. Local lint/typecheck and focused tests precede publication; ordinary dev
mobile CI remains compile-only. Protected opt-in Android execution must prove
real Identity → Consultation browse → profile → fresh slot selection, using only
dedicated synthetic fixtures and retaining sanitized head/provider manifests.

Execution status and exact-head evidence are recorded on the PR after the
protected run, so changing documentation does not invalidate its proven head.

## Protected exact-head Android gate

Same-repository PRs explicitly labeled `run-mobile-discovery-e2e` run the existing
`staging-mobile-e2e` protected environment on the exact PR head. Ordinary PRs keep
mobile compile-only. The required aggregate gate cannot pass an opted-in run if
Android evidence fails. The job uses backend `dev` owner migrations and real
Identity/Consultation containers on disposable PostgreSQL volumes, never shared
dev/staging storage. No backend code or public contract is modified.

Controlled fixture provisioning is restricted to CI with the controlled-provider
marker. Synthetic Identity roles are established in its own disposable database;
real login/account responses must confirm each role. The specialist public
profile is saved, submitted, approved and an exact 60-minute chat slot published
via Consultation commands, not SQL. A real FREE browse preflight is required.
Only the explicit `DEMO` entitlement projection is operator-provisioned in the
disposable Consultation database, with a synthetic administrator as
`established_by`, to prove policy-approved selection handoff; no `PAID`, credit,
appointment, payment or rating facts are fabricated. Video remains disabled in
this controlled environment; enabled-video behavior has focused contract/UI
coverage, not a native-video/provider proof.

Run `npm run e2e:android:discovery:evidence` in that prepared environment. Retained
artifacts include `android-discovery-real-contract.txt`, selected-slot screenshot
and redacted GET route/status log. Maestro debug dumps and login bodies are not
uploaded. The selection itself remains in memory; MB-630 must recheck policy,
slot, entitlement, credit and reservation limits before any booking command.
