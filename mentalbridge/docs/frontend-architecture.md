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

Story 212 implements the following design:

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

The implemented BFF surface is deliberately bounded to
`/api/identity/register`, `/api/identity/email-verification`,
`/api/identity/login`, `/api/identity/session`, `/api/identity/refresh`,
`/api/identity/logout`, and `/api/identity/logout-all`. The server validates
Identity responses before storing credentials, returns no access or refresh
material to JavaScript, and maps dependency failures to sanitized Problem
Details. Refresh commands share a short-lived process-local single flight and
derive one stable opaque idempotency key from the high-entropy refresh
credential across a bounded transient retry. Identity remains the authoritative
replay and rotation coordinator across application instances.

The root `proxy.ts` checks only access/refresh cookie presence for fast protected
route redirects. Server-only data access calls Identity `/api/v1/account` for
the secure account and role decision. Layout and proxy checks improve navigation
but never authorize a Route Handler or future protected data operation.

## Login and workspace routing

Story 213 connects the login form to the bounded BFF and then loads the minimal
current-account DTO before navigating. The browser cannot select or override a
role. Workspace access is derived only from validated Identity roles, with a
deterministic default order of `ADMIN`, `SPECIALIST`, then `USER`; multi-role
accounts receive navigation only to the workspaces represented by those roles.
Unknown, duplicate, or empty role sets fail closed.

The user, specialist, and admin route trees repeat the authoritative role check
in server-only data access. A forbidden route redirects to the account's primary
confirmed workspace rather than trusting the requested URL. Accounts must remain
`ACTIVE` and email-verified. Logout and logout-all call their BFF revocation
operation before the browser redirects, while the BFF always clears local
session cookies if revocation is unavailable or the session is already expired.

The initial admin shell contains navigation and integration states only. It does
not ship fabricated account, specialist, payment, audit, or health data. Future
admin operations must add their own server-side authorization checks.

Public self-registration is restricted to public backend actor types (`USER`
and `SPECIALIST` when allowed by the reviewed contract). `ADMIN` is provisioned
only through a protected backend workflow. The `/admin` UI may be developed
independently, but after Identity integration both page access and every
privileged operation require backend-confirmed authorization.

## Registration and email verification

Story 214 connects `/register` to the Identity registration contract through a
same-origin BFF. The request contains only `email`, `password`, and the reviewed
public `actorType`; profile fields and `ADMIN` are rejected at the server edge.
Passwords are validated as 12 through 128 Unicode code points and no more than
72 UTF-8 bytes, matching the committed OpenAPI contract.

Each logical browser submission receives a printable opaque idempotency key.
An unchanged retry reuses that key so a lost response cannot create a second
registration. Editing email, password, or actor type starts a new logical
submission and therefore a new key. The browser receives only
`registrationPending`, never the backend account record.

The backend email link targets `/verify-email?challenge=...`. Its page passes
the challenge to a small Client Component, which removes the query string from
browser history before calling the bounded verification BFF. The challenge is
not persisted, rendered, logged, or returned in the browser response. Invalid,
expired, and otherwise ineligible challenges intentionally share one safe UI
state because the backend exposes the single `INVALID_CHALLENGE` code.

Verification resend and password recovery remain planned contract operations.
The UI does not invent these calls: the registration result explains the
delivery limitation, login has no recovery action, and `/reset-password` states
that recovery is unavailable instead of simulating OTP behavior.

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
