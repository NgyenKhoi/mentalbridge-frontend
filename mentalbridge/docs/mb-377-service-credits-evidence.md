# MB-377 service-credit consumer evidence

- The subscription page reads the Consultation-owned snapshot through `GET /api/consultation/service-credits`.
- The server-only client forwards the bearer and correlation ID, validates the provider response, bounds response size, and fails closed on malformed or unavailable responses.
- The UI shows plan, exact period, available/held/consumed/forfeited counts, transition history, and explicit demo-versus-paid provenance.
- Unsupported fake checkout/local-storage credit mutation was removed. Purchase, downgrade, and refund actions are not presented as implemented.

Verification on 2026-09-20:

- `npm run typecheck` — pass.
- Focused Vitest for validation, server client, and credit panel — 3 files, 12 tests passed.
- `npm run lint` — pass after the effect initialization was aligned with repository hook policy.

No live cross-stack or real-payment evidence is claimed.
