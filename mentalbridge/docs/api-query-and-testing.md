# API, query, contract, and test baseline

Story 211 establishes the shared integration baseline. It does not implement
login or create Identity BFF endpoints; those begin in Story 212.

## Browser API client

`lib/api/browser-client.ts` is the only shared Axios instance for browser
requests. Its base URL is `/api`, so browser code can call only same-origin
Next.js Route Handlers through this client. It sends cookies using
`withCredentials` and deliberately has no bearer-token or refresh-token
interceptor.

All Axios failures pass through `toApiError`. Valid backend RFC 9457 Problem
Details retain the stable `code`, HTTP `status`, `correlationId`, documented
fields, and unknown extension fields. Invalid or undocumented payloads become a
safe stable fallback such as `HTTP_502`, `NETWORK_ERROR`, or `REQUEST_TIMEOUT`.
UI code must map those machine codes to reviewed user messages; it must not show
raw backend detail by default.

## TanStack Query

`app/providers.tsx` is the narrow Client Component boundary used by the root
layout. It contains `QueryProvider`, while the layout, route pages, and all other
children remain Server Components unless they independently require browser
behavior.

The shared QueryClient:

- uses a short non-zero stale time to avoid immediate duplicate refetches;
- does not refetch every query on window focus;
- does not retry client/auth/validation failures below HTTP 500;
- retries transient or unknown query failures at most twice;
- never retries mutations automatically.

Feature-specific query keys, options, invalidation, and hooks belong in
`features/<feature>/api` or `features/<feature>/hooks`, not in the shared client.
Server Components call server-only data access directly and do not fetch this
application's own `/api` routes.

## Identity contract workflow

The committed backend OpenAPI snapshot lives at
`contracts/openapi/identity-service-v1.yaml`. `openapi-typescript` generates
`contracts/identity.generated.ts`; application aliases live in
`features/auth/api/identity-contract.ts`. Do not copy backend DTOs into pages.

Commands:

```powershell
npm run contracts:sync      # copy sibling backend source and regenerate
npm run contracts:generate  # regenerate from the committed snapshot
npm run contracts:check     # validate snapshot and fail on stale generated types
```

Set `IDENTITY_OPENAPI_SOURCE` when the backend checkout is not in the documented
sibling location. CI always validates the committed snapshot and generated
types. When that variable is provided, the check additionally verifies that the
backend source and snapshot are byte-for-byte equal.

## Test layers

- Vitest + React Testing Library: unit and Client Component behavior.
- MSW: HTTP behavior at the API boundary without a live or paid service.
- Playwright Chromium: production-build browser smoke behavior.

Representative tests cover the Query provider, Axios Problem Details
normalization including unknown extensions, fallback HTTP errors, authoritative
workspace resolution, duplicate login/logout prevention, logout cookie semantics,
registration idempotency, public actor restrictions, verification challenge
cleanup, and public/protected/authentication browser behavior. Registration and
verification browser tests mock only the same-origin BFF; Route Handler tests
separately verify the exact Identity paths, minimal responses, contract limits,
and sensitive-data sanitization.

```powershell
npm run test:unit
npm run test:watch
npm run test:coverage
npm run test:e2e:install
npm run build
npm run test:e2e
```

`test:e2e` starts `next start` on port 3100 by default and therefore requires a
current production build. Set `PLAYWRIGHT_BASE_URL` to test an already running,
explicitly approved environment; never point automated tests at production.

## Quality commands

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
npm run test:e2e
```

`npm run quality` runs every gate except browser tests. `npm run ci` runs the
complete sequence and assumes the Playwright Chromium binary has already been
installed. The GitHub Actions workflow performs a clean install, uses only a
synthetic unreachable Identity URL, installs Chromium, and fails on every
required command.
