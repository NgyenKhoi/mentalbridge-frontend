# Story 902 credential lifecycle evidence

## Status

| Field | Value |
| --- | --- |
| Story | 902 |
| Target branch | `dev` |
| Status date | 2026-09-09 |
| Result | Implemented and locally verified |

Story 902 adds verification resend, password recovery/reset, and authenticated
password change without exposing credentials or account eligibility to the
browser. Identity remains the source of truth for account state, one-time
challenges, and refresh-session revocation. The frontend owns only
the same-origin BFF, bounded validation, safe user feedback, and local session
cookie cleanup.

## Acceptance and security coverage

- Verification resend and recovery request routes always return the same empty
  accepted response for eligible and ineligible accounts.
- Reset and change enforce the shared password bounds, forward only allowlisted
  fields, require exact upstream success statuses, and clear local session
  cookies after Identity revokes account sessions.
- Authenticated password change requires a valid session and exact same-origin
  request. Cross-origin requests fail before reaching Identity.
- Verification and reset challenges are read in the browser, removed from the
  address bar and history immediately, and held only in component memory.
- Unit and browser tests cover invalid input, dependency-safe errors, cookie
  cleanup, challenge URL cleanup, resend, reset, and change.

## Visual evidence

- [Password recovery mobile](evidence/mb-902-password-recovery-mobile.png)
- [Password reset desktop](evidence/mb-902-password-reset-desktop.png)

Both captures use synthetic data. Password values are masked and no challenge,
token, cookie, email address, or upstream URL is visible.

## Verification

Run from `mentalbridge/` in the isolated Story 902 worktree:

| Command | Result |
| --- | --- |
| `npm run quality` | Passed: format, lint, typecheck, three OpenAPI contract checks, 169 unit tests, and production build with 44 routes |
| `$env:CARE_E2E_MODE='fixture'; npm run test:e2e` | Passed: 21 Chromium scenarios against synthetic local fixtures |
| `git diff --check` | Passed; only Git's existing CRLF conversion notices were emitted |

No automated test calls a live Identity or Brevo endpoint. Backend delivery
tests use a mocked HTTP server or a mocked delivery port. The production build
continues to emit the existing non-blocking multiple-lockfile workspace-root
warning.
