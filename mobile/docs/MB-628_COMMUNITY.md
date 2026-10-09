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

Implementation and protected exact-head evidence are in progress. Nothing in
this document asserts that Android E2E or final-head CI has passed yet.
