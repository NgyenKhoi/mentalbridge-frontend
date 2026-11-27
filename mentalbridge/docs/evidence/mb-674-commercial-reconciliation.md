# MB-674 commercial reconciliation verification

Executed on 2026-10-23 against the MB-674 feature branches. The cross-stack run used disposable PostgreSQL, real Spring HTTP, a production Next standalone server, Chromium, synthetic identities, and FAKE payment/payout providers. No real money moved.

| Command (working directory) | Result |
| --- | --- |
| `mvn -q -DskipTests test-compile` (backend `consultation-service`) | PASS |
| `mvn -q -Dtest=ConsultationOpenApiContractTests test` (backend `consultation-service`) | PASS, 16 tests |
| `mvn -q -Dtest=AdminCommercialReconciliationIntegrationTests test` (backend `consultation-service`) | PASS, 23 tests |
| `mvn -q '-Dtest=SubscriptionBillingIntegrationTests,SpecialistPayoutFlowIntegrationTests' test` (backend `consultation-service`) | PASS, 20 tests |
| `mvn -q '-Dtest=CommercialCrossStackTests' '-Dmb622.frontend=<absolute frontend mentalbridge directory>' test` (backend `consultation-service`) | PASS, 1 browser journey |
| `npm.cmd run contracts:check` (frontend `mentalbridge`) | PASS |
| `npm.cmd run typecheck` (frontend `mentalbridge`) | PASS |
| `npm.cmd run lint` (frontend `mentalbridge`) | PASS |
| `npx.cmd vitest run features/reconciliation/api/browser-client.test.ts features/reconciliation/components/business-date-range.test.ts features/reconciliation/components/AdminCommercialReconciliationManager.test.tsx __tests__/api/admin/commercial-reconciliation.route.test.ts` (frontend `mentalbridge`) | PASS, 26 tests |
| `npm.cmd run build` (frontend `mentalbridge`) | PASS |
| `npm.cmd run format:check` (frontend `mentalbridge`) | FAIL, 13 files: 11 untouched files and two existing reconciliation component files. The broad formatting drift predates this change; unrelated files were left untouched. |

The browser journey verifies PENDING to SUCCEEDED, exact credit counts before and after confirmation and upgrade, duplicate payment callback, one settled earning, one payout and payout item, replay stability, ADMIN payment/payout/provenance reads, USER/SPECIALIST denial, and no mutation from an unapproved ADMIN POST. It checks the ADMIN UI with owner-backed facts and verifies no viewport overflow at 1440, 1280, 768, 375, and 640 CSS pixels. The [synthetic ADMIN payout screenshot](mb-674-admin-payout-reconciliation.png) was captured from this run. The local machine-readable run manifest is generated under `test-results/mb674/admin-commercial-reconciliation.json`; it is intentionally not committed because it embeds run-specific IDs and the pre-commit Git state.

The owner contract documents business identifiers and the absence of a persisted cross-lifecycle correlation ID in backend `docs/mb-674-reconciliation-contract.md`. Date bounds are half-open for new UI requests; legacy inclusive `to` remains available. List `count` remains page-local. No refund, arbitrary adjustment, direct MoMo settlement, or payout retry was added.

## Jira MB-674 follow-up — 2026-10-27

Reviewed frontend `47b79c08b7d0e203e54228c537bae094cead266e` and backend `9431affef3984bedd46d1cd1ff5b24bb0b76d14b` against the Jira acceptance criteria. No owner API, migration, or financial action changed in this follow-up.

| Criterion | Evidence and result |
| --- | --- |
| ADMIN payment/payout browse, status/date/safe-identifier filters | **PASS** for persisted identifiers: Consultation `GET /api/v1/admin/payments` and `GET /api/v1/admin/payouts`, the ADMIN BFF routes, UI filters, owner integration tests, and BFF/component tests. **GAP** for a distinct persisted business correlation ID filter. |
| Owner-backed discrepancies and bounded provenance | **PASS**: `GET /api/v1/admin/commercial/discrepancies`, `GET /api/v1/admin/commercial/provenance`, payout/subscription detail reads, and owner integration tests cover duplicate webhook classification, failed payout, held earning, disputed settlement, and credit-to-earning-to-payout links. |
| Approved actions and financial safety | **PASS** for the delivered read-only ADMIN journey: refund, arbitrary earning adjustment, direct MoMo settlement, and payout retry remain unavailable. Owner tests cover payout idempotency and duplicate callbacks; the synthetic browser journey checks one payout/item, replay stability, role denial, and rejection of an unapproved ADMIN POST. |
| Success, pending, duplicate, failure, unavailable, and roles | **PASS** across owner, BFF, UI, and synthetic evidence: `AdminCommercialReconciliationIntegrationTests`, `SubscriptionBillingIntegrationTests`, `SpecialistPayoutFlowIntegrationTests`, `CommercialCrossStackTests`, `commercial-reconciliation.route.test.ts`, and `AdminCommercialReconciliationManager.test.tsx`. Frontend validation rejects malformed nested financial DTOs, and the UI hides stale results after a failed refresh. |

`X-Correlation-Id` is request tracing only. Payment `idempotency_key` is scoped to a payment command; `momo_order_id` and `momo_request_id` identify the provider checkout. Payout `idempotency_key` is scoped to a payout command, while `provider_payout_reference` belongs to a persisted payout attempt. Existing filters perform exact matches on those facts. Neither `payment_transaction` nor `specialist_payout` stores a shared business correlation ID; audit/outbox `correlation_id` does not establish a financial relationship. A payout may contain earnings from multiple subscriptions, so no single historical payment-to-payout ID can be inferred safely.

The minimum owner decision is the business correlation scope and cardinality (for example, per credit/earning lineage versus payout group), who generates it at which transaction boundary, how it propagates through owner records, and exact filter semantics. Only then can Consultation add persisted fields and a migration, expose them in OpenAPI, and let BFF/UI filter them. Historical values without verified owner links must remain null. Until that decision and contract exist, the Jira correlation-ID criterion is an acceptance gap and MB-674 cannot be marked Done.

Current CI: [frontend quality run 680](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/40495856774) and [frontend overlap run 95](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/40495856408) **PASS** for the frontend commit; [backend quality run 557](https://github.com/NgyenKhoi/mentalbridge-backend/actions/runs/40049647691) and [backend overlap run 60](https://github.com/NgyenKhoi/mentalbridge-backend/actions/runs/40049647700) **PASS** for the backend commit. The earlier 2026-10-23 local format failure above is historical and is superseded by the current frontend CI result. The focused parser/component tests (20 tests), identity validation tests (5 tests), typecheck, lint, and changed-file Prettier check passed on the committed frontend tree; no tests were rerun for this documentation-only follow-up.

## Final scope approval and branch acceptance — 2026-10-27

The requester confirmed approval of the bounded MB-674 identifier-filtering scope. This decision **supersedes the previously recorded correlation-ID acceptance gap** for this task; the historical review above is retained as an audit trail, not the final acceptance status.

The accepted ADMIN correlation/filtering capability uses only **persisted, owner-authoritative business transaction identifiers**: payment and payout IDs, subscription/specialist identifiers where supported, payment/payout idempotency keys, MoMo order/request IDs and persisted payout provider reference values. Consultation provenance traverses only verified persisted relationships among payment, subscription credit, earning and payout records. `X-Correlation-Id` remains HTTP request tracing only; neither an invented cross-lifecycle correlation ID nor speculative historical backfill is required or claimed. A new generic shared business-correlation field is **not part of the approved MB-674 scope**.

**Final AC/DoD assessment under this approved scope: PASS.** Authoritative lifecycle filters, owner-backed discrepancies, read-only/unavailable unapproved financial actions, safe provenance, idempotency, role enforcement and synthetic E2E have supporting tests and prior evidence above. No changes to financial mutations, schema, or owner facts were made by this documentation update.

CI verified for frontend commit `f65ccd04691e7b7d3591b5ccbea1e4b810376f78`: [Frontend quality](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/40522960505) **PASS** (including production build); [PR overlap](https://github.com/NgyenKhoi/mentalbridge-frontend/actions/runs/40522960512) **PASS**. Backend commit `9431affef3984bedd46d1cd1ff5b24bb0b76d14b`: [Backend quality](https://github.com/NgyenKhoi/mentalbridge-backend/actions/runs/40049647691) **PASS**; [backend PR overlap](https://github.com/NgyenKhoi/mentalbridge-backend/actions/runs/40049647700) **PASS**.

At acceptance review, GitHub reported frontend PR #229 and backend PR #226 as mergeable against their respective `dev` bases. The feature branches were **not merged or rebased**; this is a current mergeability check, not a guarantee that future base changes cannot introduce conflicts. The remaining old merge-to-`dev` PR checklist items are outside this requested **DONE ON BRANCH** scope.
