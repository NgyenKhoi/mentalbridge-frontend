# MB-628 — Community on mobile

## Scope and interface brief

USER peer support consumes Community v1.10.0 through the configured public API
edge. Community, not Care or Journal/AI, owns visibility, display identity,
anonymity, posts, media, comments, reactions, bookmarks, reports and blocks.

The primary journey is a calm, chronological feed → readable detail → explicit
interaction. A secondary saved collection and display-profile editor remain
separate from the user's health profile. The composer uses in-memory drafts,
one to three governed topics, an explicit profile/anonymous choice, optional
sensitive-content warning, a Content resource reference and at most ten READY
media attachments. Existing mobile typography, colours and 44-point-or-larger
controls are reused; content remains a bounded reading column on tablets.

Loading, empty, validation, expired-session, forbidden/restricted, missing or
hidden content, stale revision and unavailable dependency states must be
visible. A failed fresh visibility read never renders a stale post. Anonymous
responses must have no public profile link. Counts, viewer state and pagination
are returned by Community, never inferred from health data or local ranking.

## Change-to-test map

- Contract/API: strict public shapes, anonymity, READY delivery, owner-only ETag,
  public paths, If-Match, idempotent create/retry, subject-free request bodies.
- Feed/detail: cursor/topic and saved navigation, warnings, resource routing,
  comments/replies, authoritative reaction/bookmark refresh, hidden/unavailable.
- Composer/profile/media: draft cancellation, exact versions, safe upload host,
  credential-free upload, READY-only attachment, processing/rejected failure.
- Safety: explicit report acknowledgement, bilateral block removes content,
  anonymous authors cannot become blockable identities, existing help-now only.
- Protected Android: synthetic dedicated USER identities, real Identity and
  Community contracts; create → interact → report/block, exact-head manifest
  and non-sensitive final screenshot. Execution is required, not merely a flow.

## Verification status

Focused contract/API/native-media/UI tests, mobile lint and TypeScript compile
have run locally. The protected exact-head Android run is still pending; no
claim of Android execution is made until its manifest is produced successfully.

## Protected Android reproduction

Add `run-mobile-community-e2e` to a same-repository PR targeting `dev`. The
`staging-mobile-e2e` environment runs the exact PR head, checks mobile lint,
TypeScript and focused regressions, then builds and boots Android API 36 on the
pinned runner. Ordinary dev PRs remain compile-only for mobile.

This opt-in Community gate always uses disposable real Identity and Community
services from backend `dev` with their committed PostgreSQL/Liquibase migrations.
It uses two dedicated synthetic USER identities; the peer's display profile
and post are created through public APIs, not business-data SQL or mocked
responses. A routing-only edge forwards ETag and If-Match unchanged. Community
interaction relay is disabled; Care, Journal/AI and Cloudinary delivery are not
needed by the bounded E2E journey. The synthetic Cloudinary settings are never
used for paid uploads. Media selection/upload/finalize/READY/error paths have
focused adapter/component coverage, not real Cloudinary execution evidence.

The successful artifact is `android-mb-628-real-contract-<head>` and contains
`android-community-real-contract.txt`, `android-community-status.png` and a
method/path/status routing log with record IDs redacted. Detailed Maestro
dumps remain outside the artifact directory. The manifest records frontend
head, backend head, contract version and CI run. A failed execution produces no
success manifest; the aggregate quality gate requires success when opted in.

For an already built app in an approved test environment, set
`MAESTRO_MB_USER_EMAIL`, `MAESTRO_MB_USER_PASSWORD` and
`MAESTRO_MB_COMMUNITY_PEER_POST_ID` to dedicated fixtures, then run
`npm run e2e:android:community`. Never use a real person's account or content.

## Privacy and remaining platform checks

- All ordinary writes omit actor/account selectors; Community derives ownership
  from the authenticated session. Anonymous owner editing depends only on the
  returned owner ETag, never reverse lookup of the author.
- Anonymous public authors are required to have null profile ID/avatar. A
  deleted-author tombstone may retain its public Community ID per the current
  runtime, but is neither rendered as an active profile nor offered for block.
- Drafts, selected file URIs, signed upload fields and post/comment text are not
  persisted to device storage or logged. Session material uses the existing
  secure credential seam; provider uploads omit credentials and deny redirects.
- Reports acknowledge intake only. Help-now uses the existing authoritative
  directory lookup and does not create assessments, Care decisions or contacts.
- iOS native execution, screen-reader traversal and real Cloudinary delivery
  are not asserted by this Android-focused story evidence. Release verification
  remains governed by staging's existing Android/iOS gates.
