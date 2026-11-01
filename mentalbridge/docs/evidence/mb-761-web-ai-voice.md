# MB-761 Web AI Voice

Jira: [MB-761](https://vunguyenkhoi47.atlassian.net/browse/MB-761).
Owner: Thảo Nguyên Trần. Backend prerequisite:
[MB-782 PR #237](https://github.com/NgyenKhoi/mentalbridge-backend/pull/237),
head `2ae7c5e6`, quality-gate PASS. The user subsequently requested push/PR only,
without merging; this consumer therefore declares #237 as an open dependency.
No merge or live feature activation is part of delivery.

## Approved brainstorm and commit slices

Use a small Voice entry and modal inside the existing AI Companion feature.
The user explicitly approved the local prototype fallback after inspection of
the real desktop/mobile frame; no artifact is claimed to be Stitch-generated.
Local `.stitch/MB-761/brief.md` and `prototype.html` record that evidence.
Keep the global shell, styles, route, providers and appointment flows unchanged.

1. Regenerate exact Care/Journal contracts from the published provider head;
   add the closed public Voice schema subset and same-origin authenticated
   BFF/client boundary. Verify malformed/denied/expired/timeout/idempotency and
   no credential leakage with focused contract/BFF tests before committing.
2. Add the Voice lifecycle controller and pure LiveKit media adapter. Admission,
   consent, entitlement, quota, usage and deadlines remain server-owned.
   Verify stale responses, cleanup, mic denial, reconnect and agent filtering.
3. Implement the approved accessible modal/entry with semantic feature-local
   CSS, status, finite preview, disclosure, mute/end and persistent safety
   continuation. Verify component/browser/responsive/reduced-motion behavior;
   run the full frontend gate, refresh dev, push and create the dependent PR.

No new registration, secret, provider permission or paid usage is needed.
Provider enablement and real spoken demonstration remain MB-760/MB-762 gates.

## Acceptance states and authority

| State                                         | What the user sees                                     | Must not imply                              | Authority                                       |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------- |
| FREE / expired entitlement                    | Honest locked preview, upgrade and text continuation   | Live call or positive allowance             | Journal eligibility                             |
| PLUS / PREMIUM                                | Finite session/day balance and cap from response       | Hardcoded allocation or reserved slot       | MB-782 + Voice policy v1                        |
| Partial daily allowance                       | Available duration bounded by remaining daily seconds  | Full policy cap is usable                   | Journal snapshot; POST decides admission        |
| AI consent absent                             | Current Care AI disclosure and explicit acceptance     | Voice consent already granted               | Existing AI_PROCESSING                          |
| Voice consent absent                          | Separate Care Voice disclosure and explicit acceptance | Text consent reset or automatic call        | AI_VOICE_PROCESSING                             |
| Mic denied / unsupported                      | Safe retry and text continuation                       | Reserved quota or a connected agent         | Browser permission before admission             |
| Connecting / agent not ready                  | Waiting/unavailable status and end action              | Successful AI response or ACTIVE accounting | Server session + media transport                |
| Listening / thinking / speaking               | Exact admitted agent's official attribute hint         | Access, playback proof or usage settlement  | MB-782 display-only contract                    |
| Stale / unknown / foreign hint                | Unavailable; reset on room/attempt/disconnect          | Indefinite thinking                         | 30-second observation bound                     |
| Reconnecting                                  | Paused audio; current server checks before mic resumes | Client-issued duration extension            | Journal session/connection                      |
| Capacity / other device / quota exhausted     | Specific unavailable copy and recheck                  | New reservation or hidden retry             | Server denial code                              |
| Revoked consent / entitlement lost / deadline | Local audio stops; authoritative terminal reason       | Billing from UI timer                       | Journal lifecycle and worker cutoff             |
| User ends / closes / navigates                | Stop mic and detach output; confirm end                | Backend settlement before acknowledgement   | Idempotent end; best-effort keepalive on unload |
| Ambiguous admission                           | Reconfirm original UUID command intent                 | A second call allocated on retry            | Server idempotency                              |

The BFF exposes only declared public routes and rejects owner/model/token
selectors, internal worker operations, foreign-origin mutations and invalid
UUID commands. Current USER credentials remain server-only. All responses are
no-store; raw upstream error bodies are replaced by safe copy and allowlisted
codes. Browser connection tokens stay in the active media adapter's RAM and are
cleared during cleanup. No recording, transcript/audio persistence, browser
storage or content logging is added. Text context is never passed to Voice.
The client countdown is informational and does not settle usage.

The controller polls session state without overlapping reads, fences stale
responses and ends late admission results after unmount. A reconnect checks
current session/connection authorization before unmuting; failure closes media.
Hint expiry only changes presentation. Captions are not advertised because the
current worker publishes no transcription stream. Accessible textual status and
reduced motion are provided without inventing a content channel.

## Design and browser evidence

The approved local fallback retained the actual shell and route headers. The
maintained Stitch project inventory was inspected, but no existing screen
reproduced this route and the MCP exposed no image import. No standalone
generated shell or external runtime was copied into production. Only three
integration lines changed in AiCompanionChat; Voice controls remain feature-local.

Production Chromium screenshots use synthetic data:
[desktop 1440](mb-761-voice-desktop.png) and [mobile viewport 375](mb-761-voice-mobile.png).
Fraunces/Be Vietnam Pro and Vietnamese glyphs render, horizontal bounds fit,
the safety footer stays visible and Escape returns focus. This is responsive
browser evidence, not Android hardware or speech benchmarking. Active/reconnect/
stop/agent identity/staleness use deterministic controller/media/component tests;
no real SFU or spoken E2E claim is made.

## Executed verification

| Command                                                                                         | Result                                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run format:check`, `npm run lint`, `npm run typecheck`                                     | PASS                                                             |
| `npm run contracts:check`, `npm run contract:check`, `npm run companion:budget`                 | PASS                                                             |
| `npm run test:unit -- --maxWorkers=2`                                                           | PASS after rebase, 316 files / 2,411 tests                       |
| `npx vitest run features/ai-companion/voice lib/companion/voice-bff.test.ts`                    | PASS, 27 focused tests after final recovery/timeout review       |
| `npm run build`                                                                                 | PASS, production standalone                                      |
| `npm run test:e2e -- tests/e2e/ai-voice.spec.ts tests/e2e/ai-companion.spec.ts --reporter=line` | PASS, 7 production-browser tests: 5 Voice + 2 AI Text regression |

Initial `npm run quality` passed format/lint/type/contracts/budget, then failed
five existing MamSummon timing assertions under full Windows parallel load.
No Mầm source/assertion changed. Its isolated 12 tests passed; the complete suite
passed with two workers. Required PR CI must still pass on the final head.

The unpublished feature branch was rebased onto frontend dev `3c718b2` (MB-772).
Both evidence-index additions were preserved; the full gate reran, including
2,411 tests on that refreshed base. The earlier complete run had 2,333 tests.

Snapshots come from published backend #237 head `2ae7c5e6`, based on backend
dev `3a054a9d`. Care/Journal regeneration retains already delivered provider
schemas; it introduces no runtime work for another story. No generated file is
manually merged. Deploy/integrate backend #237 before this consumer and
refresh/regenerate if the provider base changes. The user requested both PRs
remain open, so no merge or branch-protection bypass is part of this delivery.
