# MB-382 appointment chat frontend evidence

The appointment chat route uses Consultation's server-time decision for all UI
states and uses the Realtime transport only when subscription is allowed.

| Acceptance area             | Evidence                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Waiting and active states   | `AppointmentChatPanel` renders the authoritative phase and enables the composer only when `sendAllowed` is true.                                 |
| Reconnect and resync        | `RealtimeTransport` obtains a fresh one-use credential, resubscribes, recovers REST history and deduplicates by message ID.                      |
| Read-only terminal history  | Ended, cancelled and rescheduled phases retain history while stopping the socket and disabling send.                                             |
| Browser credential boundary | Same-origin BFF routes keep the Identity bearer server-side and return only the short-lived Realtime ticket plus its non-secret public endpoint. |
| Entry points                | User and specialist appointment cards link eligible `IN_APP_CHAT` appointments to `/appointments/{appointmentId}/chat`.                          |

Verification on 2026-09-29:

- `npm run quality` — passed: format, lint, typecheck, Consultation and
  Realtime contract checks, 538/538 tests across 113 files, and the production
  build.
- `AppointmentChatPanel` passed all 6 waiting, active, terminal, reconnecting,
  and exhausted-reconnect cases.
- The production build includes the appointment chat page plus the eligibility,
  history, and one-use credential BFF routes.
- Contract generation/checks cover the Consultation eligibility snapshot and
  the one-use WebSocket handshake schema with its minimum credential length.
