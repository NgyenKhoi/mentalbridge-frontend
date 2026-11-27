# MB-659 authoritative resource reward evidence

## Delivery boundary

The web Resources page reads Content-owned `resource-reward-v1` data through the
same-origin authenticated BFF. It renders confirmed zero, visible, hidden,
loading, source-unavailable and post-save reconciliation states. A successful
resource completion remains acknowledged when reward reconciliation fails, but
the previous total, level and grants are removed until retry succeeds.

The presentation calls XP recognition of saved self-care participation and
explicitly excludes treatment, recovery, adherence and mental-health scoring.
Hiding rewards leaves the catalogue, daily journey, SupportPlan and professional
support available.

## Automated evidence

- Content provider contract parsing rejects malformed grant identity, dates,
  versions and provenance.
- BFF tests cover authenticated read, bounded visibility replacement and unknown
  input rejection.
- component tests cover confirmed new-owner zero, dependency outage, hide/show,
  save acknowledgement and failed reward reconciliation without stale totals.
- the controlled Playwright Resources journey covers desktop/mobile layout,
  reduced motion, confirmed zero, save, failed reconciliation, retry and a new
  authoritative grant.

Controlled captures: `evidence/mb-659-resource-rewards-desktop.png` and
`evidence/mb-659-resource-rewards-mobile.png`.

## Environment classification

- Browser evidence: controlled synthetic fixture, no production personal data.
- Backend integration: disposable PostgreSQL container.
- Android native/staging: `NOT_RUN`; MB-659 is backend/web only and mobile
  consumption remains assigned to MB-665/MB-666.
