# MB-376 SupportPlan engagement evidence

## Implemented journey

The SupportPlan page now presents each current Care-owned occurrence as an
owner workspace. The user can record completion or skip, optional helpfulness
or a coded barrier, a private reflection of at most 500 characters, and an
explicit approval for minimized facts to be reused in a later bounded summary.
They can edit, reopen, hide/show, or delete that mutable response. Deletion
keeps the scheduled occurrence and exact source provenance visible.

## Boundaries

- The browser uses only the authenticated same-origin BFF. Replacement and
  deletion forward Care's strong `If-Match` version and accept only the
  authoritative returned representation.
- Runtime validation fails closed on unknown states, ratings, barriers,
  malformed timestamps, missing booleans, and reflections over 500 characters.
- A paused plan exposes no engagement actions. The UI explains that these are
  self-reported wellbeing signals, not adherence, treatment success, clinical
  improvement, or recovery.
- The consent label is narrow: only minimized coded facts may support a later
  user-approved bounded summary. Private reflection is not included in the
  event, and specialists cannot continuously observe this checklist.
- Hidden items remain owner-accessible in a collapsed group. Controls retain a
  44px minimum target and collapse without horizontal overflow on mobile.

## Verification

Unit/component/BFF coverage exercises exact response validation, optimistic
replacement and deletion, helpfulness/reflection/approval capture, hide/show,
reopen, delete, paused controls, and source provenance. The maintained fixture
Playwright journey records a complete response with helpfulness, reflection,
and approval for manual or staging execution. The normal `dev` CI gate remains
the full non-browser frontend suite, consistent with
[review and testing](review-and-testing.md).
