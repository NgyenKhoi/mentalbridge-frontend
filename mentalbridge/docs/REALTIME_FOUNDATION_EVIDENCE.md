# Realtime frontend foundation evidence

## Delivered boundary

The frontend consumes checked-in copies of the provider's WebSocket v1 JSON Schemas and generates TypeScript contract types from them. Ajv 2020 validates handshake, command, acknowledgement, safe-error, and server-event frames at runtime. The parser rejects unknown properties/versions, invalid UUIDs and timestamps, malformed JSON, content beyond the schema limit, and frames above 16 KiB.

Transport construction is presentation-independent. Socket.IO uses namespace `/realtime`, disables its internal reconnection, and delegates lifecycle control to a deterministic adapter. Command and `clientMessageId` values are stable when the same command is retried. Identical acknowledgements and events are applied once; reuse with conflicting content is surfaced as a non-retryable conflict.

Lifecycle states are `connecting`, `ready`, `degraded`, `authentication-expired`, `disconnected`, `reconnecting`, `resubscribing`, and `stopped`. Reconnect is capped exponential backoff with bounded jitter and a maximum attempt count. Offline state pauses attempts; explicit `resume()` is required after connectivity returns. Expiry stops the socket and reconnect timer. Deliberate stop removes all socket listeners and timers.

Recovery stores the last accepted event boundary per conversation, resends the original stable subscription command, and calls the explicit history adapter. Planned/unavailable history remains `history-unavailable`; it is never reported as recovered. The production eligibility adapter returns unavailable, never allow-all.

`liveDelivery: not_applicable` maps to `unconfirmed`, not delivered. This foundation makes no receipt or recipient-delivery claim.

## Production availability

- Browser authentication: **unavailable / fail-closed** pending an approved short-lived socket credential or same-origin termination contract.
- Consultation eligibility: **unavailable / fail-closed** pending its versioned contract.
- Conversation history: **planned / unavailable** according to the Realtime provider contract.
- Production appointment chat: **not delivered by this Story**.

The test-owned `/tests/browser-harness/` UI is a bounded synthetic Browser E2E fixture served by an isolated Vite server. The Next.js `/realtime-diagnostics` route always renders only the fail-closed notice and does not import the fixture. Fixtures contain no real conversation data or production credentials.

## Reproducible checks

From `frontend/mentalbridge-frontend/mentalbridge`:

```powershell
npm ci
npm run contract:generate
npm run contract:check
npm run contract:provider-check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

From `backend/mentalbridge-backend/realtime-service`:

```powershell
npm run contract:check
npm test
npm run test:integration
```

The integration suite requires its disposable MongoDB/Redis test environment. Results should be attached to the pull request without tokens, fixture credentials, or raw real-user messages.

## Verification result — 2026-09-09

- Frontend provider-schema comparison: passed; all five WebSocket v1 schemas match.
- Frontend format, lint, typecheck, and production build: passed.
- Frontend realtime unit tests: passed (13 tests across 2 files).
- Chromium Browser E2E: passed (4 tests).
- Realtime provider contract validation: passed.
- Realtime provider unit/contract tests: passed (32 tests across 7 files).
- Realtime provider MongoDB/Redis/Socket.IO integration: passed (15 tests).
- Production dependency audit: the rebased `origin/dev` baseline contains known
  findings in Next.js 16.3.0 and its existing Sharp dependency. None of the
  Realtime dependencies added by this foundation is identified in the audit.

The complete frontend unit command has 10 pre-existing failures in the Care
client and legacy ResourcesList suites on this Windows checkout. Running those
same failing files directly on unmodified `origin/dev` reproduces all 10
failures. The two Realtime suites pass independently and the production build
remains green.

The browser dev server used fallback fonts when Google Fonts was temporarily unavailable during E2E; this did not affect transport assertions. The separate production build fetched its configured fonts and completed successfully.

## Explicitly deferred

Consultation/appointment activation, specialist matching, entitlement, production conversation UI, cross-instance fan-out, receipts, moderation, attachments, and production history eligibility remain outside this foundation.
