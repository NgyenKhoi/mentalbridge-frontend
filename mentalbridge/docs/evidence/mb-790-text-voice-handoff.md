# MB-790 opt-in Text-to-Voice continuation

Owner: Web AI Companion, following the Journal/AI and Care MB-790 contract.
Route/role: `/ai-companion`, authenticated USER. The existing shell, Text
history/composer, Voice dialog, tokens and safety entry remain the reference.
The full-frame [desktop](mb-761-voice-desktop.png) and
[mobile](mb-761-voice-mobile.png) baseline captures remain applicable; this slice
adds a choice inside the existing dialog rather than redesigning the route.

## UI brief and delivery slices

The user can optionally continue the selected Text conversation during Voice.
The choice starts unchecked and names the selected conversation. The browser
supplies only its opaque conversation selector, never messages, summaries,
Journal context, owner IDs or model instructions. Journal/AI checks ownership,
consent and eligible message provenance and creates the bounded ticket. The
dialog says context is attached only after an authoritative session response.

1. Consume the additive provider contracts and extend the closed same-origin
   BFF/client schemas; reject raw content and preserve unknown command outcome.
2. Add transient controller handoff state and opt-in dialog/entry behavior;
   preserve permission-before-admission and no automatic fallback/retry.
3. Cover contract/BFF/controller/component states and update the browser journey;
   run the affected checks and required frontend gate before delivery.

## State and authority matrix

| State | Screen/action | Must not imply | Authority |
| --- | --- | --- | --- |
| No selected Text chat or handoff flag absent/OFF | Existing voice-only start | Any Text continuity | Journal capability, absence means OFF |
| Selected chat and feature enabled | Unchecked choice to use at most two recent eligible exchanges; start without context remains available | All history or private sources will be read | Explicit user choice plus server selection |
| New Voice notice required | Current Care notice and separate acceptance | Previous Voice v1 consent covers new processing | Care Voice v2 grant |
| Preparing handoff | Loading state, controls disabled | Microphone or admission has started | Journal handoff command |
| Ticket prepared | Start continues with the same transient token | Context is already attached to a session | Ticket expiry/binding; session admission still decides |
| Handoff definitely denied/expired | Clear explanation and explicit start-without-context action | Hidden fallback or successful continuity | Safe published error code |
| Admission outcome unknown | Reconfirm the same command/token | A new context-free attempt is safe | Original idempotency intent |
| Session confirms Text handoff | Context-attached label | The AI has already spoken or every past topic is available | Session `contextMode` |
| Voice-only session | Label and notice that Text context is not used | Selected chat content was silently included | Session attachment absence |
| End/close/unmount | Stop microphone, end same session and clear transient ticket | Text conversation itself is deleted | Journal terminal/cleanup acknowledgment |
| Reconnect | Existing session binding only | A new ticket/call or time extension | Existing Voice lifecycle |
| Voice actions | Phone entry and circular mic/end/audio icons with Vietnamese accessible names, focus states and tooltips | Icon alone communicates permission or admission | Existing controller state; 44px entry and 52px in-call targets |
| Before/during call | Short notice that the call ends after 60 seconds without recognized speech | Audio energy or heartbeat counts as recognized activity | Existing backend idle policy, unchanged |

The ticket, command intent and selected conversation are held only in component
and controller memory, cleared at end/disposal. No browser storage, content
telemetry, recording or transcript persistence is introduced. The existing
deterministic Help Now link remains visible. Context failure never starts a
replacement call automatically, especially after an uncertain admission.

## Verification status

Provider contracts are synchronized from backend MB-790 PR248, commit
`9d06b22bae3312028ea57ab5bd1c9126cb46c5b7`. Backend MB-789 PR247 merges first,
then MB-790 backend, then this Web consumer; regenerate snapshots from the
merged owner contract before Web merge.

| Executed check | Result |
| --- | --- |
| `npm run quality` through unit tests | Format, lint, typecheck, contract generation checks and Companion budget PASS;330 files/2,651 tests PASS |
| Production build | Initial sandbox font downloads blocked; `npm run build` rerun with network access PASS, without changing fonts or design |
| Voice controller/BFF/dialog focused regression |56 tests PASS as part of the full suite; unchecked opt-in, owner selector only, preparation before mic/admission, confirmed attachment and unknown-intent replay |
| Playwright journey | Updated for selected Text opt-in and microphone denial using synthetic routes; not executed at the normal dev gate |

The full suite exposed a platform-only traceability assertion comparing CRLF
source to LF snippets. A separate test-only commit normalizes line endings on
both sides while retaining exact assertion checks; all traceability tests pass.
No live provider, microphone, Cloud deployment or campaign was executed. Backend
capability remains OFF by default; these fixture/component results do not claim
real model continuity or live E2E acceptance.

## Compact Voice controls follow-up

The phone entry now uses an icon instead of a persistent text label. In-call
microphone, end and audio-recovery controls follow the same compact pattern;
consent choices, start confirmation and state explanations remain text. Buttons
retain Vietnamese accessible names and tooltips, mute exposes its pressed state,
and the narrow/mobile layout keeps the existing shell. Component regressions
cover entry, microphone toggle, audio recovery, end and the idle-policy notice.

Follow-up verification: formatting, lint, typecheck and contract/budget checks
passed. The full unit run had four asynchronous UI wait failures (2,650 tests
passed); all four affected files and both Voice component files then passed
sequentially, 167/167. No assertions or unrelated production files were changed
to obtain that result. Exact-head CI remains the delivery gate.
