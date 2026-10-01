# MB-609 Community standalone peer-support evidence

## Delivered experience

- `/community`, `/community/[postId]`, and `/community/profile` now live in a dedicated authenticated route group with their own header, sidebar, responsive bottom navigation, and page shell.
- The main MentalBridge header links directly to Community, while the Community shell keeps explicit exits to the personal dashboard and the safety directory.
- Community uses the shared display/body font variables and design tokens. Motion is limited to small state and surface transitions and is disabled by `prefers-reduced-motion`.
- The composer previews bounded local image/video attachments before publish. Published media opens in an accessible viewer with previous/next controls and arrow-key navigation.
- Community display name/avatar remain independently editable. Create and edit flows now send the versioned `PROFILE` or `ANONYMOUS` author mode for that individual post.
- Anonymous public responses are validated as `state: ANONYMOUS` with a null `communityProfileId` and avatar. Ownership remains server-side for edit/delete and abuse controls.
- Post detail provides a visible route to immediate-help resources and continues to identify Community content as personal experience, not professional advice.

Report/block and sensitive-content moderation controls are not simulated in the browser. They remain dependent on their governed Community endpoints and policy contracts.

## Contract evidence

- Community OpenAPI snapshot: `1.3.0`.
- `CommunityPostAuthorMode`: `PROFILE | ANONYMOUS`.
- `CommunityAuthor.state`: includes `ANONYMOUS`; `communityProfileId` is nullable only for that public projection.
- The frontend contract snapshot and generated TypeScript types pass `npm run contracts:check`.

## Verification

Executed on 2026-10-01:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run contracts:check` — passed.
- `npm run test:unit` — 140 files, 660 tests passed.
- `npm run build` — Next.js 16 production build passed; all three Community routes were emitted as authenticated dynamic routes.
- `npx playwright test tests/e2e/community-feed.spec.ts --workers=1 --reporter=line` — 3 Community journeys passed, including per-post anonymous publish followed by an owner-controlled switch back to the Community identity.
- Backend `community-service` `mvn test` — 33 tests passed, including Liquibase 0006/0007, Hibernate schema validation, OpenAPI assertions, and the anonymous public projection/owner lifecycle.
