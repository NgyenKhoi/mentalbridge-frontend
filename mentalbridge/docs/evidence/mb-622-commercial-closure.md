# MB-622 commercial closure

## UI implementation brief

Keep the existing subscription cards, specialist earnings layout and protected
ADMIN workspace. Replace mock financial data with actual Consultation reads;
do not introduce a new visual direction, second ledger or client-side rights.
Primary actions are selecting a server-priced plan, checking a pending payment,
withdrawing eligible earnings and reading bounded admin reconciliation. Technical
IDs remain behind the shared collapsed disclosure. No fake revenue, reconciliation
success, unsupported payment methods or locally granted credits are displayed.

| Surface | Required material states |
| --- | --- |
| USER subscription | loading, unavailable/retry, current plan, allowed upgrade, pending restored on remount, confirmed, failed, chargeback, unconfirmed provider link, explicit sandbox |
| SPECIALIST earnings | existing loading/empty/error and destination/withdrawal states; FAKE warning even before a destination; server authoritative eligibility and paid balance |
| ADMIN payments/payouts | protected role, loading, empty, failed/retry, bounded canonical records, latest attempt, explicit synthetic money and no global-revenue claim |

## Contracts and compatibility

Consume Consultation OpenAPI 1.16.0: optional pricing policy and payout-provider
fields, ADMIN-only bounded payment read, owner payment history and nullable
checkout URL. Missing historical optional fields remain accepted; unknown policy,
provider, unexpected payload fields, invalid amounts/counts and malformed records
fail closed. The BFF verifies roles, forwards only server-side credentials and
retains refreshed HttpOnly cookies with no-store responses. No actor/price/provider
payload is accepted from checkout callers.

Deploy this consumer before the new checkout writer emits null URLs. A null link
keeps the pending status, disables another charge and never redirects. Verified
server history/credits, not a browser return URL, determine activation.

## Evidence and verification

The paired backend runbook is
`consultation-service/docs/MB-622_COMMERCIAL_JOURNEY.md`. Run its explicit
`CommercialCrossStackTests` command after building this frontend. The committed
runner calls actual production BFF routes and the real Spring HTTP application
against disposable PostgreSQL, with synthetic Identity/payment/payout adapters.
This is not proof of a real MoMo transfer or a production environment.

Generated evidence is in `test-results/mb622/`. The final PR records both exact
clean source SHAs and the sanitized manifest; no raw logs or credentials are
published. Screenshots cover 1440/1280px desktop and 768/375px regression widths,
plus 640 CSS-px zoom-equivalent layout. Keyboard filter focus and reduced-motion
mode are exercised. This is not assistive-technology or all-browser certification.

Reviewed screenshots from the same implementation and rebased development base:
[subscription desktop](mb-622/subscription-1280.png),
[subscription narrow](mb-622/subscription-375.png),
[admin payments desktop](mb-622/admin-payments-1440.png), and
[admin payments narrow](mb-622/admin-payments-375.png). The exact clean-head
execution manifest is recorded separately in the paired PRs.

Focused tests cover pending remount/authoritative refresh, stable ambiguous-command
replay, FAKE no-redirect/no-activation, null provider link, server catalogue and
allowed upgrades, bounded parsers, dependency failure and USER/ADMIN BFF role/
cookie/input/privacy boundaries. The normal dev gate stays non-browser; mobile
native builds and unrelated features are unchanged. CI success and actual E2E
execution are distinct evidence and are recorded separately in the PR.
