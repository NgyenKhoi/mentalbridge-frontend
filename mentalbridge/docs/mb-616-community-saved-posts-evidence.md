# MB-616 Community saved posts evidence

MB-616 adds an authenticated, private `/community/saved` collection backed by
Community-owned bookmark state. The browser never supplies an owner identifier;
the BFF forwards only bounded `limit` and opaque `cursor` parameters from the
authenticated USER session.

## Delivered behavior

- Saved posts are loaded from `GET /api/v1/community/saved-posts` in the
  backend-defined newest-saved order.
- The Community shell exposes a dedicated **Bài viết đã lưu** destination on
  desktop and mobile.
- Existing Community cards, sensitive-content disclosure, media availability,
  supportive reactions, and post-detail navigation are reused.
- Removing a bookmark immediately removes the card and reloads the authoritative
  collection. Reloading the page confirms the server-owned result.
- Loading, empty, dependency-error, and cursor-continuation states are explicit.
- The view does not add recommendation, popularity, assessment, Journal,
  emotion, or mental-health inference signals.

## Automated evidence

- Component tests cover private-view composition, empty/error states, opaque
  continuation, and removal plus authoritative reload.
- BFF tests reject cross-owner and profiling parameters and sanitize dependency
  failures.
- The deterministic fixture-browser journey bookmarks a post, opens the saved
  collection, reloads it, removes the bookmark, and confirms the empty state
  still holds after a second reload.

The desktop and mobile screenshots
[`evidence/mb-616-community-saved-posts.png`](evidence/mb-616-community-saved-posts.png)
and
[`evidence/mb-616-community-saved-posts-mobile.png`](evidence/mb-616-community-saved-posts-mobile.png)
contain synthetic fixture data only. They are controlled browser evidence, not
a live cross-stack claim.

Regenerate the journey after a production build with:

```text
npm run test:e2e -- tests/e2e/community-feed.spec.ts
```
