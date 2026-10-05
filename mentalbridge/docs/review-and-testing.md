# Review and testing

## Pre-production CI lanes

### Feature delivery to `dev`

Run from `mentalbridge/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
```

`npm run typecheck` runs `next typegen` before TypeScript so generated App
Router helpers such as `PageProps` are available in a clean CI checkout. Do not
replace that command with a bare `tsc --noEmit` invocation.

`npm run quality` and `npm run ci` both represent this complete non-browser
gate. `.github/workflows/frontend-quality.yml` runs it for pull requests and
pushes to `dev`; its stable branch-protection check is `quality-gate`.

Documentation-only changes still require format/lint/typecheck because rules
and examples must remain consistent with the active application. If a build
depends on an unavailable external resource, report the exact failure; do not
claim it passed or weaken configuration.

### Promotion from `dev` to `staging`

`.github/workflows/staging-quality.yml` accepts only `dev` as the source of a
staging pull request and also runs on pushes to `staging`. It checks the
Realtime schemas against the backend `staging` branch, installs Chromium, then
runs `npm run ci:staging`: the complete non-browser gate, controlled Realtime
browser tests, and the full fixture Playwright suite against a production
build. The same workflow runs the complete mobile quality gate and native
Android/iOS boot smokes. Pull requests into `dev` run only the mobile TypeScript
compile check. The stable branch-protection check is `staging-quality-gate`.

Branch protection must require `quality-gate` on `dev` and
`staging-quality-gate` on `staging`; workflow files cannot enable repository
rules themselves. A red, skipped, cancelled, or missing required check blocks
promotion.

Fixture Browser E2E uses synthetic services and data. `npm run test:e2e:live`
remains opt-in for an explicitly approved deployed environment and is not part
of either automatic gate.

Install Chromium locally with `npm run test:e2e:install` before a manual fixture
run. Both local and staging-gate fixture runs use Playwright's bundled Chromium.

## Test ownership

- Unit tests: schema/error mapping, pure feature logic, and session utilities.
- Component tests: form validation, accessible interactions, and loading/error
  states.
- Route/BFF integration tests: cookies, timeouts, Problem Details, auth failures,
  and refresh/logout semantics.
- Browser tests: login, refresh, role routing, logout, public registration, and
  protected-route navigation.

When application work materially changes an existing browser journey, update
the owning Playwright test in the same change. Running that full browser suite
is normally deferred to the staging release gate; maintaining it is not.

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

## Visual and journey review

For changes inside a priority journey, review the complete transition that the
change affects, not only the edited component. The current priority journeys,
reference screens, and route outcomes are defined in
[`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md).

Desktop/laptop UI evidence includes the primary state at 1440 × 900 and
1280 × 800. Also inspect every changed state that can materially alter layout:
loading, empty, partial/error, success, long content, and open dialog/drawer.
Tablet/mobile remain regression gates at 768px and 375px.

Review screenshots for hierarchy, primary-action clarity, text contrast,
content density, clipping, horizontal overflow, sticky/fixed collisions, chart
labels, and layout shift. Exercise keyboard focus and reduced motion; a static
screenshot cannot prove either behavior.

### Optional external advisory review

The local contracts, the
[`UI_IMPLEMENTATION_PLAYBOOK.md`](UI_IMPLEMENTATION_PLAYBOOK.md), executable
tests, and visual evidence are sufficient to review and deliver UI work. A
human or AI second reviewer is optional, not part of the default quality gate.

When the product owner explicitly requests an external review, send only
sanitized screenshots and the relevant contract excerpt—never `.env` files,
credentials, tokens, production identifiers, or personal health data. Ask for
findings as `blocker`, `major`, or `minor`, tied to a specific route/state and a
rule ID from `PRODUCT_EXPERIENCE.md` or `DESIGN_SYSTEM.md`. Reproduce every
functional claim locally before accepting it.

An external reviewer cannot approve business logic, API contracts, privacy
boundaries, merge readiness, or replace the playbook's required self-review.
Its absence never blocks delivery unless the Jira task explicitly makes that
review an acceptance criterion.

## Definition of done

A story is done only when its acceptance criteria are implemented, relevant
documentation and `.env.example` are current, required checks pass (or a blocker
is explicitly recorded), the final diff is scoped and reviewed, and risks plus
follow-up stories are named. A sub-task may be checked off only as evidence for
the parent story; the parent is the delivery unit.
