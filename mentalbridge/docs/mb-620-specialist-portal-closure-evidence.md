# MB-620 Specialist Portal production closure evidence

Evidence class: controlled fixture-browser and frontend contract tests.

The `/specialist` production composition now exposes only capabilities backed
by an existing Consultation or Care owner: dashboard, assigned appointments,
60-minute in-app availability, appointment-scoped clients, appointment chat,
post-session continuity, and the specialist profile. The shell identity is
loaded from the authenticated specialist profile contract.

Earnings and specialist notifications are not represented as delivered data.
Their navigation entries and fixed badges are absent; direct legacy URLs render
an explicit unavailable state until their authoritative owners are delivered.
No fixed balance, payout, transaction, bank, session, notification, client, or
specialist identity is rendered by the specialist production route.

Verification:

- `components/RoleWorkspace.test.tsx` checks the production navigation,
  unsupported appointment actions/modalities, and deferred states.
- `components/SpecialistWorkspaceIdentity.test.tsx` checks authoritative,
  missing-profile, and unavailable-owner identity states.
- `tests/e2e/specialist-portal-closure.spec.ts` follows the required dashboard
  → appointments/clients → messages/continuity → earnings → notifications
  journey through the same-origin API boundary with synthetic contract data.
- The browser journey also checks unknown-route closure and horizontal overflow
  at 1440×900, 1280×800, 768×900, and 375×812.

Regenerate the controlled screenshots after a production build with:

```text
npm run test:e2e -- tests/e2e/specialist-portal-closure.spec.ts
```

Generated screenshots contain only the synthetic identity “Chuyên gia An”:

- `docs/evidence/mb-620-specialist-portal-desktop.png`
- `docs/evidence/mb-620-specialist-portal-laptop.png`
- `docs/evidence/mb-620-specialist-portal-mobile.png`
