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
