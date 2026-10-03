# MB-579 Community reactions and bookmarks evidence

## Delivered boundary

- A signed-in user can add, replace, or remove exactly one supportive reaction per active visible post. The bounded set is `SUPPORT`, `RELATE`, and `THANK_YOU`; there is no popularity-oriented like/dislike control.
- A signed-in user can bookmark or unbookmark an active visible post. Bookmark state is returned only as personalized viewer state and is never exposed to another user.
- PUT and DELETE commands are naturally idempotent. Repeating the same reaction or bookmark command does not create another row or change the aggregate count twice.
- Hidden, removed, personally hidden, or bilaterally blocked posts reject new interactions through the same fail-closed visibility policy used by Community reads.
- During rolling deployment, a v1.5 response without `viewerState` remains valid and exposes no interaction controls. The presence of valid v1.6 `viewerState` is the capability signal that enables reaction and bookmark commands.

## Data and product boundaries

- PostgreSQL uses one composite primary key per `(post_id, profile_id)` for reactions and bookmarks. A row lock on the target post serializes reaction count changes under retries and concurrency.
- Feed and detail responses expose only the current viewer's reaction and bookmark state. Aggregate reaction count remains non-clinical Community metadata.
- Reactions and bookmarks do not read PHQ-9, GAD-7, Journal, emotion history, severity, SupportPlan, or care recommendations and do not influence feed ranking.

## Automated evidence

- Backend `CommunityInteractionIntegrationTests` verifies reaction replay/replacement/removal, concurrent duplicate requests, exact aggregate counts, owner-private bookmarks, viewer-state isolation, and rejection for hidden posts against PostgreSQL with Liquibase migrations through `0010`.
- Frontend validation, API, Route Handler, and component tests verify the bounded contract, same-origin authenticated forwarding, retry-safe natural commands, count changes, and private bookmark toggles.
- Compatibility regressions verify that v1.5 feed/detail payloads remain readable while reaction and bookmark controls stay absent, so the frontend can deploy before the v1.6 provider.
- `tests/e2e/community-feed.spec.ts` exercises add/change/remove reaction plus bookmark persistence and removal through the browser journey.
- The Community OpenAPI contract is synchronized at v1.6 and generated TypeScript is checked by the frontend contract gate.
