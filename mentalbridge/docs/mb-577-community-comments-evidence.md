# MB-577 Community comments and one-level replies evidence

## Delivered experience

- Post detail now includes a supportive comment composer, chronological comment list, bounded load-more pagination, and one-level replies.
- The composer encourages lived-experience support and explicitly avoids diagnostic language. Empty, loading, retry, conflict, deleted-tombstone, and unavailable-content states are visible and actionable.
- A Community member can edit or delete only comments tied to their current Community display profile. Edits send the exact comment version; deletion keeps a neutral tombstone so existing replies retain context.
- Create and delete update the visible post comment count immediately after the authoritative command succeeds. Reduced-motion behavior continues to use the shared Community shell contract.

## Boundary and contract evidence

- Community OpenAPI snapshot: `1.4.0`.
- The same-origin BFF exposes only the four implemented comment operations and validates UUIDs, cursors, limits, idempotency keys, comment text, parent IDs, and quoted versions before forwarding.
- Runtime response validation rejects undeclared fields and accepts only the frozen Community comment, author, state, timestamp, pagination, and version shape.
- Comment text is rendered only in Community and is not routed into Care, Journal/AI, screening, SupportPlan, specialist, or analytics features.

## Verification

- Backend community-service full suite: 37 tests passed against PostgreSQL Testcontainers, including Liquibase changesets 0001–0008.
- Backend repository policy: 953 tracked files and all 28 paired changes passed verification against `origin/dev`.
- Frontend full unit suite: 141 test files and 668 tests passed.
- Frontend format, lint, typecheck, Community/OpenAPI snapshot, and realtime contract checks passed.
- Next.js production build completed with both comment BFF routes in the generated route table.
- Community Playwright production journey: 4 tests passed, including create, edit, one-level reply, owner deletion, tombstone display, and reply preservation.
