# MB-578 Community safety and moderation evidence

## Delivered boundary

- Users can report a visible post or comment with a stable governed reason and optional bounded context. The browser preserves one idempotency key across an ambiguous retry of the same normalized report.
- Users can personally hide a post/comment and block or unblock a public Community identity. Anonymous posts deliberately expose no profile identifier to block.
- ADMIN receives a dedicated Community moderation queue with state/priority filters, minimized first-report evidence, aggregate reasons, immutable action history, and bounded actions.
- A crisis-concern reason raises queue priority and links users to the existing help-now affordance. Neither UI nor API claims diagnosis, contacts third parties, books care, or changes SupportPlan.

## Security and privacy

- Browser calls remain same-origin; USER and ADMIN Route Handlers resolve their own role before forwarding a token.
- Ordinary users cannot call ADMIN moderation endpoints.
- Reporter identity and free-text report details are not returned in the queue response; public identity never exposes the private Identity subject.
- Hidden/removed content and bilateral blocks fail closed in Community reads and interactions.

## Automated evidence

- `CommunitySafetyActions.test.tsx` verifies ambiguous report retry key reuse, crisis copy, and block/unblock recovery.
- Backend `CommunityModerationIntegrationTests` verifies PostgreSQL migration execution, report replay/conflict behavior, personal visibility isolation, ADMIN authorization, immutable action audit, Community-only restriction, and comment count/revision consistency across moderation.
- The Community OpenAPI contract is synchronized at v1.5 and generated TypeScript is checked by the frontend contract gate.
