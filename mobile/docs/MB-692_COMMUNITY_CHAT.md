# MB-692 — Community conversations on mobile

Owner: Thảo Nguyên / `Thaonguyen0507`. Scope: USER Community direct/group
conversations. Appointment chat is a separate journey. This is implementation
evidence, not a claim that the Android acceptance gate or `ui-ready` has passed.

## Contracts and integration order

Community owns content, membership, privacy, revision and visibility. Realtime
only invalidates/repairs those projections. Content owns notification delivery,
preferences and quiet hours. The consumer uses these active backend contracts:

- [Community chat v1.2.0](https://github.com/NgyenKhoi/mentalbridge-backend/blob/dev/contracts/openapi/community-chat-v1.json).
- [Native credentials / MB-749 PR #215](https://github.com/NgyenKhoi/mentalbridge-backend/pull/215),
  `community-realtime-v1.json` v1.1 and ADR 0043.
- [Community policy](https://github.com/NgyenKhoi/mentalbridge-backend/blob/dev/docs/policies/community-chat-policy-v1.md)
  and ADR 0042, `MB-COMMUNITY-CHAT-001`.
- [Notification](https://github.com/NgyenKhoi/mentalbridge-backend/blob/dev/contracts/openapi/content-notification-service.yaml).
- [Mobile Delivery Contract v1](MB-611_MOBILE_DELIVERY_CONTRACT_V1.md).

Merge MB-749 first, then the mobile feature, then its narrow route/Community
entry/notification integration PR. The shared navigation seam is deliberately
separate as required by MB-692's lane annotation and MB-706. The integrator
must review that seam before merging it. Do not mark this Story Done before
the actual MB-666 Android batch and post-merge Docker acceptance walkthrough.

Deployment must route the exact `POST /api/v1/community/socket-credentials` to
Realtime before the general Community prefix. The app still receives only one
public edge URL; no signing key or second service URL is introduced. A fresh
single-use credential is obtained for each foreground/reconnect attempt.

## Acceptance states

The owner selected a separate native prerequisite and an entry inside the
existing Community screen, then approved a local prototype grounded in the
verified Android baseline on 2026-10-21. The table applies those decisions and
the frozen policy to the implemented states.

| State                                     | Screen behavior                                                                              | Must not show/do                                                   | Authority / verification                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Loading, empty, dependency failure        | Current owner read, empty guidance, explicit retry                                           | Invented conversations or people directory                         | Community API; adapter/component tests                |
| Incoming request                          | Available requester, expiry, accept/decline/block with request revision                      | History, presence or composer before acceptance                    | Policy direct consent; inbox tests                    |
| Start direct, approval mode               | Confirmed PENDING acknowledgement, wait for acceptance                                       | Treat request ID as conversation ID                                | Direct result union; inbox tests                      |
| Start direct, open mode                   | Open only returned ACTIVE conversation                                                       | Assume ANYONE converts old pending requests                        | Community decision; inbox tests                       |
| Private invitation                        | Name, inviter, expiry, recipient decision with invitation revision                           | Members/history before acceptance                                  | Group policy; inbox tests                             |
| Active conversation                       | Plain text, ascending owner history, explicit pagination/send/read cursor                    | HTML rendering, invented sequence/delivery/read receipts           | Message contract; adapter/session/UI tests            |
| Owner/admin/member                        | Current role controls; owner transfer to admin, archive; eligible self-leave                 | Client grant of permissions or predicted management revision       | Group contract; group tests                           |
| Archived/read-only                        | Authorized history, read-only notice                                                         | Composer or new invites                                            | Group/direct state; component tests                   |
| Block, removal, restriction, stale target | Immediately clear invalidated view, reauthorize, safe unavailable state                      | Stale messages, badges, presence, private reason                   | Policy visibility; in-flight invalidation regression  |
| Offline/uncertain write                   | Hide unauthenticated view; keep volatile draft and original send identity for explicit retry | Disk cache, background queue or automatic re-send                  | Mobile v1; session retry/lifecycle tests              |
| Foreground/reconnect                      | Fresh ticket, subscribe, REST repair, absolute unread                                        | Additive unread counting or arrival-time message order             | Realtime contract; session/UI tests                   |
| Background/logout/account switch          | Disconnect/stop heartbeat; hide content; unmount clears runtime; query keys use subject      | Presence lease from cached state, cross-account transcript         | Mobile v1; lifecycle tests + existing session cleanup |
| Notification link                         | Exact closed type/href/UUID tuple, followed by current recipient/owner read                  | Arbitrary URL or a link treated as permission                      | Notification contract; integration PR tests           |
| Privacy                                   | Presence opt-out, invisible overrides; preserve other server preferences                     | Last-seen, typing or shared read receipts without runtime support  | Presence policy; privacy tests                        |
| Report                                    | Exact visible message ID and reason, received acknowledgement                                | Message text in report request, automatic contact/monitoring claim | Report contract; adapter/UI coverage                  |

## Important behavior

GET privacy/conversation currently supplies a decimal-string revision in its
body without an ETag header. The adapter derives the quoted If-Match value from
that exact string and rejects contradictory headers. Management writes require
their published ETag. A message/read update does not increment group management
revision. After a management write, reload current group/members before another
write; never substitute an invitation revision for the group's revision.

A first history page is the earliest authorized page, not an invented latest
tail. "Xem tiếp tin nhắn" loads subsequent pages. Live repair refreshes the
loaded window in REST order, deduplicates message IDs, and exposes continuation.
The explicit read action marks only the last loaded message. "Đã lưu" means
durable save, without claiming delivery or a peer's read acknowledgement.

Sensitive text/drafts and socket credentials stay in volatile memory. Identity
subject and Community profile ID are separate values. Only available public
authors can offer the direct handoff; anonymous/deleted authors never expose
it. Group invitations select available peers in accepted direct conversations,
with explicit pagination; there is no public discovery or identifier input.
412/conflict responses do not cause automatic overwrites. Pending send retries
reuse both original IDs; reconnect alone never sends a message.

## Design and screenshots

The canonical mobile visual owners remain `src/theme/tokens.ts`,
`src/components/Screen.tsx`, `src/community/community-ui.tsx`, and the maintained
[UI foundation](../../mentalbridge/docs/DESIGN_SYSTEM.md) / mobile contract.
No token, shell, global font or provider redesign is introduced. Native system
fonts retain Vietnamese glyph coverage. Controls reuse 48-point targets and
semantic selected/disabled states. Confirmation regions are inline disclosures,
as in MB-628; they do not claim modal semantics or focus trapping. Transitions
are immediate and require no motion to understand them. Dates use Vietnamese
formatting and the device's current local timezone.

Verified baseline: MB-628 real Android artifact `11665634689`, run `38041548241`,
frontend head `00421318cc40a68166dd55c03760902027408e57`; shell-owning components
were compared against base `fa5545c`. Stitch project `9946598625924497023`, screen
`2b7879a8ad2646a18b9e8a39f5907d79` supplies content reference only: the tool could
not import the Android frame. The owner approved a local prototype fallback.
Its font/interaction/360–390–768px overflow checks passed before production UI.
Local `.stitch/MB-692` material is excluded from Git.

The committed [inbox](evidence/MB-692/inbox-390.png),
[request](evidence/MB-692/request-390.png),
[chat](evidence/MB-692/chat-390.png),
[privacy](evidence/MB-692/privacy-390.png),
[archive](evidence/MB-692/archived-390.png), and
[group](evidence/MB-692/group-390.png) captures render the actual production
React Native components through React Native Web with synthetic API/socket
fixtures inside the existing Screen/SafeAreaProvider. The harness supplies a
web UUID generator and no-op Android BackHandler; no credentials are used.
These are component-render evidence, not Android screenshots or a real-route
integration claim. Browser QA checked fonts, console errors, no horizontal
overflow at 360/390/768px, privacy selection, request composer exclusion,
block/archive cancellation, draft guard and reduced motion.

## Verification and release handoff

Local clean `npm ci --no-audit --no-fund` passed without lockfile changes.
Development verification uses non-emitting TypeScript, lint and focused
Jest/RNTL checks; the PR records the final counts/head and required CI status.
Local Node 22.16/npm 11.4 differ from the pinned CI Node 22.13/npm 10.9.2;
CI remains the pinned-environment evidence. No dependency upgrade is included.

The premium static audit of the whole mobile app reports two existing
`affordance.actionless-button` findings in `src/auth/session-context.test.tsx`
(test-only HTML fixtures). No matching violations occur in the changed feature.
Those unrelated fixtures are preserved. The audit is static evidence only.

Maestro sources (not executed in this delivery):

- `.maestro/mb-692-community-direct.yaml`: approval, direct send, unread cursor,
  privacy/open recipient mode.
- `.maestro/mb-692-community-group.yaml`: invite accept, membership boundary,
  role controls, self-leave and revoked conversation link.
- `.maestro/mb-692-community-reconnect.yaml`: notification navigation,
  background/foreground draft, offline hiding and explicit reconnect.

At MB-666 use dedicated synthetic USER accounts with active Community profiles.
The runner must prepare a fresh pending request to the test recipient, seed the
peer message only after acceptance (or provide the peer action at that phase),
and provide an available public `ANYONE` peer that has no pending request with
the sender. Supply `MAESTRO_MB_USER_EMAIL/PASSWORD`,
`MAESTRO_MB_COMMUNITY_REQUEST_ID`, `MAESTRO_MB_COMMUNITY_OPEN_PEER_ID`,
`MAESTRO_MB_COMMUNITY_INVITATION_ID`, `MAESTRO_MB_COMMUNITY_GROUP_ID`, and a
unique generic `MAESTRO_MB_COMMUNITY_NOTIFICATION_TITLE` from Content. Group
fixtures contain a pre-membership synthetic message that must remain hidden.
Do not seed real mental-health content or use production credentials.

Run the three scenario flows against the same approved edge/provider versions,
with route integration merged. The runner must verify airplane mode actually
disconnects its emulator edge and restore network even on failed assertions.
Capture final head/provider versions, commands, sanitized results and screenshots
once in that batch; source presence is not execution evidence. Production App
Links/Universal Links and actual PUSH infrastructure remain separate release
work. MB-745/746 message retraction/personal deletion is outside this Story.
