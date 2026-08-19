# Frontend architecture

## Context and ownership

MentalBridge is a Next.js web client for backend services. Identity is a remote
backend capability, not a frontend-owned identity system.

```text
Browser
  | same-origin pages and /api/identity/*
  v
Next.js application
  |-- Server Components / server-only data access
  |-- bounded Identity BFF Route Handlers
  |-- HttpOnly session cookies
  v
API gateway / Identity service
  |-- credentials, accounts, roles, JWT and refresh lifecycle
  `-- authorization source of truth
```

The frontend owns rendering, navigation, interactive form/query state, safe
cookie transport, and user-facing error states. The backend owns authentication,
account state, roles, token validity, and authorization.

## Rendering boundary

- `page.tsx` and `layout.tsx` are Server Components by default.
- Fetch initial or privileged data on the server when practical.
- Add `"use client"` only for state, event handlers, effects, custom client hooks,
  or browser APIs. Keep the directive at the smallest useful subtree.
- Pass minimal serializable DTOs from server to client. Do not pass tokens,
  cookies, headers, backend errors, or full account records unnecessarily.
- Context/query providers belong as deep in the tree as their consumers allow.

## API and query boundary

Story 211 provides Axios and TanStack Query with these responsibilities:

- Server-only Identity client: authenticated backend calls, timeout policy,
  response validation, and normalized backend errors.
- Same-origin BFF Route Handlers: browser-facing login/session operations and
  explicit public API validation. They are not a general backend proxy.
- Axios browser client: same-origin `/api/*` transport only; it never reads or
  attaches bearer/refresh tokens.
- TanStack Query: interactive client cache, retries, invalidation, mutations,
  and async UI state. It is not the source of truth for authorization.
- Server Components call the server data-access module directly rather than
  making an HTTP round trip through this application's Route Handlers.

Transport details stay in `lib/api` and `lib/auth`; feature query keys, hooks,
schemas, and UI state stay in the owning `features/<feature>` package.

## Approved Identity session design

Story 212 must implement the following design:

- The browser sends credentials only to a same-origin login Route Handler.
- The server exchanges credentials with Identity and stores the access and
  refresh material in `HttpOnly`, `Secure` in production, `SameSite`, scoped
  cookies. Tokens are never returned to client JavaScript.
- Refresh rotation is coordinated server-side so concurrent requests do not
  replay a rotated refresh token. Cookie expiry follows backend expiry.
- Logout clears frontend cookies even when the dependency is unavailable, while
  surfacing whether backend revocation could not be confirmed.
- Optimistic route redirection may inspect cookie presence in Next.js Proxy, but
  secure checks call Identity/current-account close to protected operations.
- Client-visible account state is a minimal DTO derived from the backend current
  account endpoint. The browser does not decode a token to decide permissions.

Public self-registration is restricted to public backend actor types (`USER`
and `SPECIALIST` when allowed by the reviewed contract). `ADMIN` is provisioned
only through a protected backend workflow. The `/admin` UI may be developed
independently, but after Identity integration both page access and every
privileged operation require backend-confirmed authorization.

## Error and dependency behavior

- Normalize Identity RFC 9457/Problem Details responses at the transport edge.
- Keep stable machine codes separate from localized user messages.
- Distinguish invalid credentials/validation errors from an unavailable or
  timed-out Identity dependency.
- Never log passwords, verification codes, cookie values, access/refresh tokens,
  or sensitive account payloads.
- Define loading, empty, error, unauthorized, forbidden, and dependency-down UI
  states for every integrated feature.

## Security checks

Route Handlers and Server Actions are public entry points. Validate input,
authenticate, authorize, and return only minimal data. Layout checks alone do
not protect data because layouts may not re-run for every navigation. Security
checks belong in the server data-access layer and protected handlers, close to
the backend operation.
