# MB-618 Community end-to-end closure evidence

MB-618 verifies the completed MB-573 Community experience as a coherent,
production-routed peer-support journey. The closure work adds regression and
browser evidence; it does not replace service-owned behavior with frontend
mocks or introduce a new Community capability.

## Browser journey

`tests/e2e/community-closure.spec.ts` starts the production standalone Next.js
server and drives the real Community pages and same-origin BFF handlers. It
covers two closure paths:

1. A mobile user selects anonymous-per-post identity, attaches two previewed
   media items, selects a governed reviewed resource, applies a sensitive
   warning, publishes, reloads, reveals the warning, and uses next/back media
   viewer navigation. The same content is then checked at desktop width.
2. A user blocks and unblocks a peer, submits a crisis-sensitive report,
   privately hides the post, and verifies an administrator can apply an audited
   hide. The original user then receives the indistinguishable unavailable
   state rather than moderation or existence details.

The first path explicitly emulates `prefers-reduced-motion: reduce` and checks
the narrow viewport for horizontal overflow. Existing Community browser tests
continue to cover profile setup, deterministic feed/topic paging, post
lifecycle, comments/replies, reactions, bookmarks, and saved posts.

## Evidence classification

This is controlled browser-contract evidence. It uses a production Next.js
build and the production BFF code with deterministic synthetic Identity,
Community, and media-provider fixtures. It does not claim live RDS, Kafka,
Cloudinary, or deployed-service coverage.

Real backend closure evidence is owned by
`CommunityEndToEndJourneyIntegrationTests` with disposable PostgreSQL. The
existing `CommunityNotificationRecoveryCrossServiceIT` covers notification
outage, Kafka retention, recovery catch-up, and replay deduplication with real
service code, disposable PostgreSQL owners, and real Kafka.

## Reproduction

From the frontend repository root:

```text
npm run quality
npm run build
npx playwright test tests/e2e/community-closure.spec.ts tests/e2e/community-feed.spec.ts --workers=1 --reporter=line
```

No production Community route contains seeded social rows. Fixture data is
limited to the test-only Identity/Community service process used by Playwright.
