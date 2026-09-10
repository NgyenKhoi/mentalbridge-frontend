# ADR: browser Realtime authentication boundary

- Status: **fail-closed pending architecture approval**
- Scope: frontend Realtime transport foundation, schema version 1
- Date: 2026-09-08

## Context

The current Realtime Socket.IO handshake requires `accessToken`. Identity authentication in the frontend is intended to remain server-owned through an HttpOnly session. Copying the general Identity bearer token into JavaScript-readable storage, a public environment variable, query string, telemetry, or browser logs would weaken that boundary.

The current deployment and contracts do not define either an audience-limited socket credential exchange or a same-origin WebSocket termination layer. Consultation also has not published the appointment/conversation eligibility contract.

## Decision

Production Realtime connection remains fail-closed. `currentProductionRealtimeBoundary` cannot construct a socket, and the Next.js diagnostics route always renders the fail-closed notice. The only working credential seam is injected by unit tests and the test-owned synthetic Browser E2E harness served directly by Vite; no `NEXT_PUBLIC_` credential or activation switch exists.

No token is persisted in `localStorage`, `sessionStorage`, IndexedDB, cookies owned by client code, URLs, UI state, or logs. The adapter keeps an injected credential only long enough to construct Socket.IO auth state and never reports its value.

## Options evaluated

### Audience-limited, short-lived socket credential

Identity or a same-origin backend-for-frontend could exchange the HttpOnly session for a one-use or very short-lived credential whose audience is only Realtime. It should bind account, origin/session, expiry, nonce, and permitted socket scope. Reconnect obtains a new credential; it does not reuse an expired token.

- Expiry: short lifetime bounds exposure and maps to `authentication-expired` without automatic retry storms.
- Replay: one-use nonce/JTI and server-side replay rejection are required.
- Origin: the exchange endpoint validates same-origin requests and CSRF protections; Realtime keeps a strict origin allowlist.
- Logging: credential values and handshake auth must be redacted at proxies, application logs, traces, and browser diagnostics.
- Reconnect: each bounded reconnect requests a fresh credential; rate limits must cover both exchange and socket connect.
- Revocation: session revocation must prevent new exchanges; immediate active-socket revocation needs a separately defined signal.

### Same-origin termination

A trusted same-origin gateway could authenticate the HttpOnly session server-side and terminate or proxy the socket without exposing a bearer token to JavaScript. It must preserve schema versioning, correlation IDs, backpressure, origin enforcement, expiry/disconnect semantics, and safe log redaction. Sticky routing and proxy timeout behavior must be designed before approval.

## Required follow-ups before production enablement

1. Approve and version one authentication contract, including expiry, audience, replay, origin, reconnect, revocation, and redaction behavior.
2. Publish Consultation appointment/conversation eligibility and integrate it without an allow-all fallback.
3. Mark Realtime history available only after its REST operation and eligibility dependency cease returning planned/unavailable.
4. Complete security review and replace the fail-closed decision with its architecture decision ID.

This decision does not approve appointment chat, production conversations, delivery receipts, fan-out, or access-token exposure.
