# Review and testing

## Current quality gate

Run from `mentalbridge/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
npm run test:e2e
```

`npm run typecheck` runs `next typegen` before TypeScript so generated App
Router helpers such as `PageProps` are available in a clean CI checkout. Do not
replace that command with a bare `tsc --noEmit` invocation.

Install Chromium once with `npm run test:e2e:install`. Browser tests run against
the production build. Identity error cases are intercepted explicitly in the
browser; tests must not call a live Identity environment. Documentation-only
changes still require format/lint/typecheck because rules and examples must
remain consistent with the active application. If a build depends on an
unavailable external resource, report the exact failure; do not claim it passed
or weaken configuration.

GitHub Actions pins `ubuntu-24.04` and sets
`PLAYWRIGHT_BROWSER_CHANNEL=chrome` so browser smoke tests use the Google Chrome
already included in that runner image. Keep local runs on Playwright's bundled
Chromium; do not add `playwright install --with-deps` back to CI unless the
runner strategy changes.

## Test ownership

- Unit tests: schema/error mapping, pure feature logic, and session utilities.
- Component tests: form validation, accessible interactions, and loading/error
  states.
- Route/BFF integration tests: cookies, timeouts, Problem Details, auth failures,
  and refresh/logout semantics.
- Browser tests: login, refresh, role routing, logout, public registration, and
  protected-route navigation.

Tests should assert user-visible outcomes and security boundaries, not internal
implementation details. Use sanitized fixtures; never use real credentials,
tokens, verification codes, or personal health data.

## Review gates

Every review checks:

- Jira acceptance criteria and intentionally excluded scope;
- installed Next.js guidance for version-sensitive patterns;
- OpenAPI compatibility for request/response/role changes;
- server/client and secret-exposure boundaries;
- authentication and authorization close to protected operations;
- loading, empty, error, unauthorized, forbidden, and dependency-down states;
- keyboard access, labels, focus behavior, contrast, responsive layout, and
  reduced motion;
- no unrelated files, generated output, or unreviewed dependency changes.

Visible changes include screenshots at representative desktop/mobile sizes.
Identity/session changes include evidence for success, invalid credentials,
expired/rotated sessions, forbidden roles, logout, and backend unavailability.

## Definition of done

A story is done only when its acceptance criteria are implemented, relevant
documentation and `.env.example` are current, required checks pass (or a blocker
is explicitly recorded), the final diff is scoped and reviewed, and risks plus
follow-up stories are named. A sub-task may be checked off only as evidence for
the parent story; the parent is the delivery unit.
