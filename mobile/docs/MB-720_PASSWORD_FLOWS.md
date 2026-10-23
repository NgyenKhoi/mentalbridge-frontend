# MB-720 mobile password flows

## Delivered scope

- Public recovery request at `/reset-password` with a generic acknowledgement
  for every accepted email request.
- One-time reset challenge handling on the same route. The challenge is copied
  to volatile component memory, removed from Expo Router state, never rendered,
  and cleared after successful use.
- Authenticated USER password change at `/change-password`, reached from the
  profile screen. A confirmed change clears local credentials, cached account
  data, and the in-memory session before returning to sign-in.
- Frozen Identity endpoints only:
  - `POST /api/v1/auth/password-recovery-requests`
  - `POST /api/v1/auth/password-resets`
  - `PUT /api/v1/account/password`
- Client validation mirrors the shared Identity policy: 12–128 Unicode code
  points and at most 72 UTF-8 bytes for a new password.

## Design evidence

- Stitch-first brief and shell-integrated prototype:
  `mobile/.stitch/MB-720/`.
- Generated recovery, reset, and authenticated change screens were inspected as
  both screenshots and HTML. Production intentionally omits Stitch-only preview
  tabs, invented app bars, decorative icons, and unsupported compliance claims.
- Existing `Screen`, auth styles, profile back behavior, palette, typography,
  and 48px action targets remain authoritative for the native implementation.

## Automated verification

Run from `mobile/` on 2026-10-23:

| Command                                      | Result                         |
| -------------------------------------------- | ------------------------------ |
| `npm run typecheck`                          | PASS                           |
| `npm run lint`                               | PASS                           |
| Prettier check for every MB-720 changed file | PASS                           |
| Focused password/auth/profile tests          | PASS — 8 suites, 47 tests      |
| `npm run test:ci`                            | PASS — 93 suites, 820 tests    |
| `npm run build:bundle`                       | PASS — Android and iOS exports |

The repository-wide `npm run format:check` reports the pre-existing CRLF
checkout baseline across 360 unrelated files on Windows. No unrelated file was
rewritten; the complete MB-720 changed-file set passes Prettier.

## Deferred evidence

- `mobile/.maestro/mb-720-password-recovery.yaml` is authored and marked
  `NOT_RUN`. Device/staging execution remains gated by MB-666 as required.
- Docker walkthrough, merge commit, and post-merge UI-ready evidence are not
  claimed before this PR is merged. The implementation PR must remain unmerged
  for review.
