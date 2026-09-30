# Realtime frontend foundation evidence

## Delivered boundary

The frontend consumes checked-in copies of the provider's WebSocket v1 JSON Schemas and generates TypeScript contract types from them. Ajv 2020 validates handshake, command, acknowledgement, safe-error, and server-event frames at runtime. The parser rejects unknown properties/versions, invalid UUIDs and timestamps, malformed JSON, content beyond the schema limit, and frames above 16 KiB.

Transport construction is presentation-independent. Socket.IO uses namespace `/realtime`, disables its internal reconnection, and delegates lifecycle control to a deterministic adapter. Command and `clientMessageId` values are stable when the same command is retried. A retry is accepted only for the exact previously authorized command and rechecks current Consultation eligibility before dispatch. Identical acknowledgements and events are applied once; reuse with conflicting content is surfaced as a non-retryable conflict.

Lifecycle states are `connecting`, `ready`, `degraded`, `authentication-expired`, `disconnected`, `reconnecting`, `resubscribing`, and `stopped`. Reconnect is capped exponential backoff with bounded jitter and a maximum attempt count. Offline state pauses attempts; explicit `resume()` is required after connectivity returns. Expiry stops the socket and reconnect timer. Deliberate stop removes all socket listeners and timers. Recovery captures its connection generation and verifies it after every asynchronous eligibility/history boundary, so stale work cannot replace the terminal `stopped` state.

Recovery stores the last accepted event boundary per conversation, resends the original stable subscription command, and calls the explicit history adapter. Unavailable history remains `history-unavailable`; it is never reported as recovered. MB-382 adds the production Consultation eligibility adapter, which fails closed and never falls back to allow-all.

`liveDelivery: not_applicable` maps to `unconfirmed`, not delivered. This foundation makes no receipt or recipient-delivery claim.

## Production availability

- Browser authentication: **implemented** through an authenticated same-origin
  BFF exchange for a one-use Realtime ticket with a maximum 30-second lifetime.
- Consultation eligibility: **implemented** for participant-bound subscribe,
  send, and history authorization using server time.
- Conversation history: **implemented** with bounded cursor pagination.
- Production appointment chat: **implemented by MB-382** for waiting, active,
  reconnect/resync, and retained read-only terminal states.

The test-owned `/tests/browser-harness/` UI remains a bounded synthetic Browser E2E fixture served by an isolated Vite server. The Next.js `/realtime-diagnostics` route reports the approved MB-382 boundary and does not expose credentials. Fixtures contain no real conversation data or production credentials.

The required frontend CI workflow runs the generated-contract check, provider-schema comparison, unit suite, controlled Chromium transport suite, and production build.

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
- Frontend realtime unit tests: passed (15 tests across 2 files), including unavailable/denied retry eligibility and stop-during-deferred-recovery regressions.
- Chromium Browser E2E: passed (4 tests).
- Realtime provider contract validation: passed.
- Realtime provider unit/contract tests: passed (32 tests across 7 files).
- Realtime provider MongoDB/Redis/Socket.IO integration: an earlier controlled run passed 15 tests. The review run completed 14/15 with a presence-TTL failure and cleanup timeout; a local follow-up could not start because Testcontainers found no container runtime. A reproducible post-review green run remains an external verification gate and is not represented as green here.
- Production dependency audit: the rebased `origin/dev` baseline contains known
  findings in Next.js 16.3.0 and its existing Sharp dependency. None of the
  Realtime dependencies added by this foundation is identified in the audit.

## Verification result — 2026-09-29 (MB-382 review)

- The complete frontend quality gate passed, including 555 tests across 117
  files and the production build.
- Appointment-chat UI coverage passed all 6 waiting, active, terminal,
  reconnecting, and exhausted-reconnect cases.
- Realtime provider lint, typecheck, contract validation, 42 tests across 8
  files, and build passed.
- Docker-backed provider and Consultation integration tests remain an external
  gate because no Docker daemon was available during this review.

The browser dev server used fallback fonts when Google Fonts was temporarily unavailable during E2E; this did not affect transport assertions. The separate production build fetched its configured fonts and completed successfully.

## Explicitly deferred

Specialist matching, cross-instance fan-out, receipts, moderation, attachments,
and video remain outside this appointment-chat slice.
