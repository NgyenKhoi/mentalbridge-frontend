# MB-384: appointment video consultation

## Authority and journey

USER appointment detail and assigned SPECIALIST appointment detail expose a
collapsible video panel inside the existing native Screen/navigation. Web uses
the equivalent panel below existing appointment/ConsultationBrief context.
Owner session state controls local preview and join availability; each explicit
join rereads current authority and obtains an in-memory, appointment-scoped
LiveKit Cloud token. No actor, room name, score, clinical content or provider key
is supplied by the client.

The waiting interval starts five minutes before the appointment, with **local
device preview only**. Cloud connection starts no earlier than startsAt. New
access stops at endsAt; reconnect never extends the appointment. A local deadline
can stop media, never grant access or prove attendance. Backend provider closure
remains authoritative.

The approved local/dev DEMO exception is backend-only and opt-in via
`CONSULTATION_DEMO_IMMEDIATE_VIDEO_ENABLED=true`. Effective DEMO entitlement and
held DEMO credit allow future video booking without four-hour lead time and
server-authoritative ACTIVE access immediately after Specialist confirmation.
Clients trust returned join flags, not their own clock or a client demo flag.
Booked timestamps/end cutoff stay unchanged; early demo ending remains pending
verification with HELD credit, without completion facts or earning. PAID/FREE,
chat, staging/production and the disabled baseline retain normal timing.

Camera and microphone start off on join and reflect SDK track state when enabled.
The Android adapter requests runtime permission, uses communication audio and
offers available speaker/earpiece/headset/Bluetooth routes. Backgrounding,
navigation blur, panel closure and unmount stop preview tracks, disconnect the
room, clear access and stop audio. Foreground return requires an explicit new
join. iOS uses localized permission-purpose strings; no background camera/PiP,
screen share, recording, transcription or AI participation is enabled.

Specialist confirmation is a separate review action that ends both connections.
Its revision/idempotency key stays stable after an ambiguous response. A pending
or evidence-review response keeps the credit HELD and is never rendered as
clinical completion. Only the owner VERIFIED response exposes completed state;
existing summaries and MB-516 earning semantics are unchanged. No automatic
24-hour refund/release/earning policy is approved.

## Public contract

- `GET /api/v1/appointments/{id}/video-session`
- `POST /api/v1/appointments/{id}/video-access`, **no request body**
- `POST /api/v1/specialist/appointments/{id}/video-completion`, exact
  `{ "confirmation": "CONSULTATION_FINISHED" }`, strong quoted `If-Match` and
  stable `Idempotency-Key`.

Strict parser validation binds session/access/completion identity to the requested
appointment and rejects unknown shapes and invalid authority. Tokens never enter
TanStack Query, navigation URLs, SecureStore, logs or UI error text. SDK logging
is disabled. Subject/appointment-keyed boundaries prevent state carry-over.
The approved MB-384 login amendment accepts a single ACTIVE, email-verified USER
or SPECIALIST from Identity; registration remains USER-only and ADMIN is rejected.

Appointment history preserves terminal `COMPLETED` video records settled under
the earlier `chat-session-completion-v1` policy. Web and mobile accept that exact
historical policy only with `EVIDENCE_REQUIREMENTS_MET`, persisted completion fact,
end/settlement timestamps and `CONSUMED` or subsequently released `AVAILABLE`
credit. Neither the policy nor historical settlement data is rewritten. Current
pending video verification still requires `livekit-video-completion-v1`; this
read compatibility does not grant joining or invoke completion/settlement.

## Backend configuration and webhook

Keep LiveKit keys exclusively in backend process configuration/root `.env`.
See backend `docs/runbooks/mb-384-livekit-video.md` and ADR 0039. Clients use the
existing backend/BFF base URL; do not add LiveKit secrets to Expo or Next.js env.

During the approved local E2E, a temporary free Cloudflare/ngrok tunnel may point
only to the path-filtered webhook proxy, not a whole service or fixture server.
The public callback URL is operator configuration in LiveKit Cloud, never a
business-logic constant. The backend route remains
`POST /internal/v1/video/livekit/webhook`; signed authorization and the raw body
are forwarded unchanged and verified by the official receiver. Remove the
temporary Cloud webhook and stop the tunnel when testing finishes.

Production transition requires a reviewed HTTPS domain/reverse-proxy route and
injected production credentials, then updating the Cloud webhook URL/signing key;
the handler needs no reimplementation. Separate development and production
LiveKit projects/credentials are recommended before production. This task neither
creates another project nor deploys staging/production.

## Native setup and feasible checks

Expo SDK 57/RN 0.86 uses CNG config plugins. `index.js` loads native LiveKit globals
before Expo Router. A development/release native build is required; Expo Go is
not supported for this added native SDK. Generated android/ios directories remain
ignored and are not edited by hand.

```powershell
npm run lint
npm run typecheck
npm run test:ci -- src/video src/auth/identity-session-service.test.ts src/config/mobile-delivery-contract.test.ts src/appointments/AppointmentsScreen.test.tsx src/specialist-appointments/SpecialistAppointmentDetailScreen.test.tsx
node scripts/verify-video-native-config.mjs
npm run build:bundle
npm run android
```

Bundle export/config introspection is not native compile or Android E2E evidence.
Record actual build/runtime results and exact head in the PR, including any JDK,
Windows path or emulator limitations. Ordinary dev CI remains compile-only for
mobile; no staging-mobile-e2e or LiveKit secret is added to untrusted PR jobs.

## Reproducible live Web journey

The opt-in backend `LiveKitCloudJourneyTests` starts real Consultation HTTP and
disposable PostgreSQL, with synthetic prerequisite entitlement/approved profile
and a controlled Identity JWT/current-account fixture. It launches the actual
standalone Next.js BFF/UI. Booking, acceptance, room access and confirmation use
public contracts. The test clock only skips booking lead time; media overlap is
measured in real wall time. No attendance row or signed webhook is fabricated.

Two browser contexts use synthetic camera/microphone input but connect to **real
LiveKit Cloud**, verify incoming RTP audio bytes/video frames in both directions,
exercise toggles/leave/rejoin, wait at least 65 seconds common connection, then
explicitly confirm as Specialist. With a configured signed webhook, the owner
must return VERIFIED, COMPLETED and CONSUMED; database assertions verify exactly
one credit consumption and existing earning. Sanitized screenshots/manifest live
in ignored `mentalbridge/test-results/mb384-livekit-cloud/`, not credential logs.
This does not prove a human consultation, Identity login E2E or an Android call.

Build web first; run from backend root with operator config present:

```powershell
mvn -f consultation-service/pom.xml test '-Dtest=LiveKitCloudJourneyTests' '-Dmb384.cloud=true' '-Dmb384.webhook=true' '-Duser.timezone=UTC' '-Dmb384.backend=E:/mentalbridge-repo/mentalbridge-backend' '-Dmb384.frontend=E:/mentalbridge-repo/mentalbridge-frontend/mentalbridge'
```

The test proxy binds loopback port 3188; the owned standalone app uses 3189. Point
only an approved temporary tunnel to 3188 and configure its HTTPS webhook before
joining. Cloud checks are opt-in and never run automatically with secrets in CI.
Missing/late/invalid webhooks must keep pending verification/credit HELD, not fake
successful completion. Participation metadata retention is 90 days subject to
dispute/legal hold; no Appointment/Brief/Summary/completion/financial history is
deleted by that retention job.
