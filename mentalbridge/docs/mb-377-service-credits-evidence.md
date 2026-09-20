# MB-377 service-credit consumer evidence

- The subscription page reads the Consultation-owned snapshot through `GET /api/consultation/service-credits`.
- The server-only client forwards the bearer and correlation ID, validates the provider response, bounds response size, and fails closed on malformed or unavailable responses.
- The UI shows plan, exact period, available/held/consumed/forfeited counts, transition history, and explicit demo-versus-paid provenance.
- Unsupported fake checkout/local-storage credit mutation was removed. Purchase, downgrade, and refund actions are not presented as implemented.

Verification on 2026-09-20:

- `npm run typecheck` — pass.
- `npm run test:unit` — 65 files, 330 tests passed, including validation, server client, and credit-panel coverage.
- `npm run lint` — pass after the effect initialization was aligned with repository hook policy.
- `npm run build` — pass with the production Next.js build.
- `npx playwright test --workers=1 --reporter=line` — 50 passed, 7 live-environment scenarios skipped by configuration, 0 failed. This includes the MB-377 mobile balance journey and the regression proving the page exposes no simulated or live payment action.

No live cross-stack or real-payment evidence is claimed.
