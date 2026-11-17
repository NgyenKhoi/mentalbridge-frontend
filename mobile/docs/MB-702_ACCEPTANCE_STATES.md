# MB-702 acceptance states — draft for owner confirmation

Status: **NOT APPROVED**. This matrix records the requested outcomes; it is not
evidence of owner confirmation or an approved Stitch mobile interaction.

| State                                                  | Required outcome                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligible PLUS/PREMIUM, no current plan                 | Review one current Care proposal with its approved actions, reasons, effort, cadence, day one, timezone and 14-day review checkpoint. Preferences are optional where supported. |
| ACTIVE or PAUSED plan                                  | Open the authoritative current Today/Review; do not create, replace, restart or renew a plan automatically.                                                                     |
| FREE/locked                                            | Use the native locked-plan experience where available; retain authorized Guide/support options.                                                                                 |
| Missing or sparse data, stale source, expired proposal | Show a truthful state and permitted next steps; do not invent activities or activate a stale proposal.                                                                          |
| Revoked entitlement or safety priority                 | Respect Care's decision, prevent activation and retain authorized support options.                                                                                              |
| Outage or network failure                              | Show a privacy-safe failure and retry path; do not imply a plan was created or activated.                                                                                       |
| Explicit confirmation                                  | Activate only after the user's action, with Care revalidation, the exact version and a stable idempotency key; suppress duplicate submissions.                                  |
| Conflict or ambiguous activation timeout               | Reconcile authoritative state before retry; handle version/concurrency conflicts and do not create a duplicate.                                                                 |
| Activation succeeds                                    | Navigate to authoritative Today/Review.                                                                                                                                         |
| Refresh, return or preference edit                     | Never activate automatically.                                                                                                                                                   |

The 14 days are a product review interval, not a treatment duration. Owner
confirmation, approved Stitch preview/interaction, and the precise supported
fallback and navigation behavior remain to be verified before production UI work.
