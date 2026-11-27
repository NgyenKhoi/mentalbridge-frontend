# MB-631 — Appointment-scoped mobile chat

## Scope and authority

USER and SPECIALIST share the native Messages destination. The owner/assigned
appointment list leads to one exact appointment UUID, which is also its
conversation UUID. Consultation owns relationship, waiting/active/closed windows,
check-in permissions and session outcomes. Realtime owns the one-use socket
credential, durable messages, idempotent acceptance and history. Mobile owns only
volatile draft/pending presentation and connection lifecycle.

Base: frontend dev `885b2fb`, including merged MB-630 PR #128. Provider contracts
inspected on backend dev `9fb48ed4`: Consultation OpenAPI v1.12.0 and Realtime
OpenAPI/WebSocket v1. No backend contract or runtime changes are required.

## UI brief

Reuse the existing MentalBridge Messages journey and native tokens, not a new
visual direction: appointment list -> fixed chat header -> scrolling message
history -> fixed composer/status strip. The primary action is sending a message
when currently authorized, or explicitly joining the waiting/active session.
Back/reconnect/older-history actions stay contextual. Body/input text is 16px;
buttons are at least 48px; keyboard avoidance, safe areas and a 560dp reading
column preserve the message artifact on phone/tablet/wide screens. On loss of
send permission, a focused composer dismisses the keyboard and transfers
accessibility focus to the status. No decorative motion or clinical inference.

| State                             | Visible behavior / recovery                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Checking/connecting               | Truthful status; no writable composer before subscribe ACK and history recovery                                                         |
| Too early/not confirmed           | Distinct status; no socket/send authority from the local clock                                                                          |
| Waiting                           | Server permits subscription/check-in but not sending                                                                                    |
| Active                            | Explicit check-in, authoritative messages, controlled composer                                                                          |
| Pending/unconfirmed/failed        | Distinguish server acceptance from missing ACK; explicit retry uses the exact immutable command/clientMessageId                         |
| Reconnecting/background           | Preserve draft in this mounted account/appointment only; release transport; fresh credentials/authorization/history before sends resume |
| Ended/cancelled/rescheduled       | Read-only history only when currently permitted; no completion/no-show/credit/payout inference                                          |
| Unauthorized/malformed/dependency | Fail closed; private display cleared on 401/403/404; bounded manual recovery                                                            |

## Contracts and security

All calls use the shared bearer-injecting Axios client and the **single**
`EXPO_PUBLIC_API_BASE_URL`. Deployment must route these existing bearer-authorized
contracts through that edge:

- `GET /api/v1/appointments` (USER),
  `GET /api/v1/specialist/appointments` (SPECIALIST).
- `GET /internal/v1/appointments/{id}/chat-eligibility?operation=...`.
- `POST /internal/v1/socket-credentials` (security-only bearer exchange).
- `GET /api/v1/conversations/{id}/messages?limit=100&cursor=...`.
- Socket.IO namespace `/realtime`, Engine.IO path `{edge-base-path}/socket.io`.

An `internal` path name grants nothing: existing services authenticate/authorize
the end-user bearer. Mobile sends no service token or chat-evidence command. This
is infrastructure routing, not Next.js read-model composition. No independent
service URLs or new public environment keys are embedded. Socket.IO client 4.8.3
was installed through Expo; it is a JavaScript dependency compatible with the
existing Socket.IO v4 provider, not a native SDK upgrade.

Strict schemas bind appointment, actor/role, participants, frames, acknowledgments
and history. Late responses/frames cannot enter another account/appointment.
Reconnect uses a fresh one-use credential with bounded backoff, subscribes, and
reads durable history; message IDs and sender/clientMessageId deduplicate and
server timestamps/IDs order messages. Missed-page recovery follows opaque cursors
to the previous message boundary (20-page cap; exhaustion fails closed). Older
initial history remains explicitly paginated. Message retries are user-triggered,
not an offline queue. No storage, analytics, notification payload or log receives
raw chat. `accepted`/`duplicate` means durable acceptance, never read/delivery.

Eligibility is polled every 10s and freshly checked before each send/check-in;
the end-boundary timer triggers a read and pauses sends, never sets a business
outcome. Server transport/REST reauthorization remains the final authority.
Account/appointment changes remount draft/pending state, abort old HTTP and
release all socket listeners/timers.

## AC/DoD evidence map

| Requirement                                        | Verification                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Assigned USER/SPECIALIST, wrong actor/appointment  | Role-specific list/API tests, ready identity and participant binding, mounted route identity regression                       |
| Authoritative early/late/revoked/closed windows    | Session tests and UI closed-composer regression; fresh send preflight and polling                                             |
| Real send/receive, no invented receipts            | Strict v1 parsers, correlated ACK/message validation, acceptance-only UI                                                      |
| Reconnect/background, reordered/duplicate messages | Transport tests, preserved volatile draft, REST reconciliation, immutable explicit retries                                    |
| Failure/dependency/stale credentials               | Fail-closed tests; no automatic mutation replay                                                                               |
| Android actual real-contract journey               | Protected exact-head job and retained manifest/screenshots described below; a committed flow alone is **not** execution proof |

Focused local verification: format, lint, TypeScript, changed chat/route/home,
appointment navigation and Mobile Delivery Contract tests. Unchanged web full
quality is verified in PR CI. iOS native execution remains a staging/macOS release
gate; this story does not claim it ran locally on Windows.

## Protected exact-head Android proof

Add `run-mobile-chat-e2e` to the same-repository PR **after the final push**.
`frontend-quality.yml` checks out that exact PR SHA, uses protected environment
`staging-mobile-e2e`, runs focused boundaries, builds/boots Android, and invokes
`npm run e2e:android:chat:evidence`. The required aggregate gate cannot turn green
if this opted-in job fails. Unlabelled dev delivery stays compile-only.

The controlled provider is real disposable Identity + Consultation + Realtime,
Postgres + Redis + encrypted MongoDB with migrations. Dedicated synthetic USER,
SPECIALIST and ADMIN fixtures are verified through Identity. Profile approval,
availability, owner booking and assigned acceptance use public commands; DEMO
entitlement setup reuses the protected fixture, credits use the real owner API.

After compilation, a CI-only fixture compresses **only the dedicated slot and
appointment scheduling/booking timestamps** to preserve 60-minute/deadline
constraints. It does not write status, attendance, outcome, credit or payout.
The real Consultation clock/eligibility/scheduler decides ACTIVE and closed.
This test seam cannot target staging/production: CI, controlled-provider marker,
feature marker, loopback ports, known disposable compose project, verified
participants and exact UUIDs are required. It does not prove actual 60-minute
attendance or a completed/settled consultation.

Journey: real eligible appointment -> explicit check-in -> native USER send and
real SPECIALIST receive/send -> same mounted app backgrounds/foregrounds ->
fresh credential/subscription/history -> stop/restart persisted history ->
Consultation closed/history-only -> absent composer. A post-flow real REST check
requires exactly two distinct persisted synthetic messages and closed permissions.

Artifact: `android-mb-631-real-contract-<full-head-sha>`, containing
`android-chat-real-contract.txt` with frontend/provider SHA and run URL, active,
reconnected and closed screenshots, and 375/768/1280/1440dp layout evidence.
Only dedicated synthetic messages are captured. Tokens/passwords, raw real chat,
raw Maestro login/UI dumps and business/provider payloads are not retained.
The PR links the successful run/artifact; this document does not substitute a
prepared script for successful execution evidence.

Rollback: revert the scoped native feature and optional chat gate. No production
migration or durable client data cleanup is introduced.
