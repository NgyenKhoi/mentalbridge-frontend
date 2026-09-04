# MB-139 Identity integration and delivery evidence

## Status

| Field                 | Value                            |
| --------------------- | -------------------------------- |
| Jira                  | MB-139                           |
| Parent delivery scope | Sprint 1 frontend Story 216      |
| Status date           | 2026-08-31                       |
| Target branch         | `dev`                            |
| Result                | Implemented and locally verified |

MB-139 verifies the existing Identity frontend integration rather than creating a second authentication design. Identity remains the owner of accounts, roles, credentials, access and refresh lifecycle, and authorization facts. The frontend owns the same-origin BFF, secure cookie transport, role-derived navigation, sanitized UI errors, and browser delivery evidence.

## Acceptance coverage

### Component and query behavior

- Login, registration, email verification, session actions, workspace resolution, browser API normalization, and query-provider tests cover validation, accessible feedback, pending state, duplicate submission prevention, authoritative role navigation, and dependency-aware errors.
- Registration idempotency is stable across an unchanged retry and changes when the logical submission changes.
- Verification removes the challenge from browser history before the BFF call and groups invalid, expired, and ineligible challenges into one safe user state.
- Browser code receives only the bounded current-account DTO and never derives authorization from a token.

### BFF session, authorization, and dependency failures

- Route tests cover public input validation, mass-assignment rejection, exact upstream paths, response validation, minimal browser responses, and sanitized RFC 9457 Problem Details.
- Session tests cover cookie attributes, current-account validation, role checks, concurrent refresh coordination, stable refresh idempotency, invalid refresh cleanup, logout, and logout-all.
- Timeout, connection/unavailable behavior, malformed success/error JSON, backend `4xx`/`5xx`, and local cookie clearing are covered without returning or logging credentials or raw upstream details.

### Browser session lifecycle

Playwright runs the production Next.js server against `scripts/identity-e2e-server.mjs`, a synthetic local fixture implementing only the reviewed Identity endpoints needed by these scenarios.

- Anonymous protected navigation redirects to login with a bounded `next` path.
- USER login reaches `/dashboard`; an attempted `/admin/dashboard` navigation fails closed and returns to the confirmed USER workspace.
- An expired access credential triggers one server-side refresh rotation before protected navigation succeeds.
- SPECIALIST login reaches `/specialist/dashboard` from the backend-confirmed role.
- Logout revokes the current upstream session, clears both local cookies, and returns to login.
- Logout-all revokes all upstream sessions, clears both local cookies, and returns to login.
- Access and refresh cookies are `HttpOnly`, `Secure` in the production test server, `SameSite=Lax`, and scoped to `/`.
- Tokens are absent from `document.cookie`, local storage, session storage, URLs, and the login response body.

## Verification

Run from `mentalbridge/` in the isolated MB-139 worktree:

| Command                   | Result                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `npm ci`                  | Passed; 596 packages installed, 0 reported vulnerabilities |
| `npm run format:check`    | Passed                                                     |
| `npm run lint`            | Passed                                                     |
| `npm run typecheck`       | Passed; Next.js route types generated successfully         |
| `npm run contracts:check` | Passed; Identity snapshot and generated types are valid    |
| `npm run test:unit`       | Passed; 17 files and 84 tests                              |
| `npm run build`           | Passed; production build generated 30 routes               |
| `npm run test:e2e`        | Passed; 9 Chromium scenarios                               |

The final `npm run ci` completed successfully before handoff. Exact counts above describe the current MB-139 worktree and must be updated if later changes add or remove tests.

## External integration boundary

No automated test calls a live Identity service or uses real credentials. OpenAPI snapshot validation plus route/provider tests verify the boundary, while the synthetic fixture proves browser-to-BFF-to-server session behavior deterministically. A deployed environment smoke test remains an environment-specific release activity and must use approved synthetic accounts.

## Review notes

- No visible UI or styling changed.
- No dependency, environment variable, backend contract, or generated contract file changed.
- The local Identity fixture is test-only and is never bundled as application runtime behavior.
- Next.js reports a non-blocking workspace-root warning because the repository contains both root and application lockfiles; the production build and browser suite still pass.
