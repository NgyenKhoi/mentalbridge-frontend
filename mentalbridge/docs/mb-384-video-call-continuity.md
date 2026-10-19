# MB-384 — dedicated Web video-call continuity

Owner-requested follow-up, updated 2026-10-19. Consultation remains the authority
for participants, eligibility, end cutoff, confirmation, completion and credit.
This UI does not add signaling, recording, transcription or AI participation.

## Root cause and continuity

The old panel cleared in-memory access on hidden `visibilitychange` and rendered
the SDK room only in the foreground. The official SDK disconnects on unmount:
switching tabs therefore intentionally tore down a healthy room in application
code. This was not a same-computer account restriction or chat Socket.IO failure.

The room now stays mounted through tab hiding, blur/focus, normal rerenders and
temporary HTTP/session-lookup outages. LiveKit retains its bounded reconnect
behavior; the app does not issue another Join merely because focus changes.
Malformed/denied authority, the server-anchored end deadline, document departure,
explicit leave or terminal SDK disconnect still stop media. Late access/preview
responses cannot resurrect a departed call. Preview eligibility revocation stops
local tracks immediately. New connections always require fresh authorization.

## Owner-approved presentation

The supplied HTML attachment `80d66da0-48fa-4a66-b726-e005210f391f` supersedes the
earlier layout. Its local brief/prototype evidence is under
`.stitch/mb-384/owner-reference-20261016/`. It was rendered in the actual User and
Specialist shells before translation; no new visual direction was generated.
The global sidebar/header and current dev appointment composition are retained.

- Dedicated role-authorized `/appointments/{id}/video` and
  `/specialist/appointments/{id}/video` routes, entered from appointment detail.
- Compact session header, dark full-size remote video, bottom-right absolute
  self-view overlay, rounded border/shadow and aspect-preserving `object-fit:cover`.
  Only local video is mirrored, including after a view swap.
- Bounded pointer/keyboard PiP movement, corner cycling and view swapping do not
  change room or participant identity, media preferences or backend state.
- Floating five-icon toolbar: microphone, camera, view swap, actual SDK device
  selection and red hangup. Controls have accessible labels and pressed states.
- Cancel-first shared leave dialog; leaving is not Specialist completion.
  Existing authorized ConsultationBrief and explicit Specialist confirmation
  remain separate, with pending-verification/HELD-credit semantics unchanged.
- Actual SDK connection quality and elapsed connected-peer time, never invented
  latency/HD/attendance. No unsupported ringing, received-ready-ping or E2EE claim.
- Self-hosted Be Vietnam Pro body and Manrope display, Vietnamese glyphs,
  responsive controls, reduced motion and feature-scoped dark-stage contrast.
  Explicit mobile preview gets sufficient vertical space to avoid covering Stop.

Sample identities/images, clinical notes, simulation switches, fake device
capabilities and automatic record-save alerts are not product behavior. The
Specialist view uses a generic participant label where no authorized display
name is available. Provider identities/tokens never become visible labels.

## Verification checkpoint

- Full Web `npm run quality`: exit 0; 267 files / 1,644 tests, format, lint,
  typecheck, contract checks, Companion budget and standalone production build.
- Targeted room/panel/workspace/PiP/shell tests: 37 passed. They cover hidden-tab
  continuity, temporary versus authoritative errors, deadlines, late responses,
  preview revocation/cleanup, track identity, swapping, device selection and
  cancel-first leave without completion.
- Specialist entry-point regressions: 9 passed. Controlled browser navigation:
  3 passed (USER/SPECIALIST entry, sanitized token failure/retry and logged-out
  rejection). The video link is placed below appointment metadata so the
  existing absolute brief action cannot cover it; the next-session card also
  enters the same authorized room instead of showing an inert placeholder.
- Mobile TypeScript: exit 0. A separate one-line literal route typing correction
  restores the newly merged dev continuation path under generated Expo types;
  its runtime URL is unchanged. Three directly affected mobile suites: 42 passed.
- Native production UI: 12 actor/viewport checks at 1440/1280/768/375/320 and
  640×400; font load, glyphs, overflow, 44px controls, help-widget clearance and
  explicit preview/Stop at desktop, 375 and 320. Controlled fixtures, not Cloud
  evidence. Prototype review also passed 12 actor/viewport checks.

CSS-only contrast/preview-overlap repairs were followed by production rebuild
and render/interaction QA, not another unrelated full unit-suite run.

## Live media evidence and limits

The historical 2026-10-16 checkpoint proved actual synthetic-camera/microphone
two-way Cloud RTP, real hidden/minimized continuity, SDK reconnect, retained
device choices, leave/rejoin and safe pending confirmation. It does not prove
the subsequently changed 2026-10-19 head. Final-head execution, when run, is
recorded separately in the PR and local sanitized manifest under
`test-results/mb384-livekit-cloud/`, including source revisions and clean flags.
Do not interpret a committed test script or prototype as executed media proof.

Build Web first, then from backend root run the opt-in fixture:

```powershell
$env:SPRINGDOTENV_ENABLED = 'false'
$env:MB384_CALL_LIFECYCLE = 'true'
mvn.cmd -q -f consultation-service/pom.xml test '-Dtest=LiveKitCloudJourneyTests' '-Dmb384.cloud=true' '-Dmb384.webhook=false' '-Duser.timezone=UTC' '-Dmb384.backend=E:/mentalbridge-repo/mentalbridge-backend' '-Dmb384.frontend=E:/mentalbridge-repo/mentalbridge-frontend/mentalbridge' '-Dmaven.test.redirectTestOutputToFile=true'
Remove-Item Env:MB384_CALL_LIFECYCLE
Remove-Item Env:SPRINGDOTENV_ENABLED
```

It uses disposable PostgreSQL, synthetic Identity/approved account fixtures and
owned Chrome profiles, never real accounts or shared dev appointments. Existing
backend-only Cloud credentials are reused without printing them. Actual visibility
is measured with owned CDP windows; arbitrary OS process freezing is not proven.
Do not rebuild `.next` during execution. No staging, protected environment,
tunnel or paid upgrade is required. Without signed webhook evidence, completion
must remain pending with credit HELD. Two physical devices and Android media
interoperability are not claimed by Web/TypeScript tests.
