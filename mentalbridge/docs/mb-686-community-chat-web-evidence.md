# MB-686 Community direct-chat web evidence

MB-686 consumes the implemented MB-685 direct-chat handoff without changing the
canonical Community schemas. The browser cannot select an owner identity: the
BFF resolves the authenticated current `USER`, validates every identifier,
query, body and concurrency header, and forwards only the ten active
`/api/v1/community/chat` operations.

## Acceptance states

| State                            | Web behavior                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPROVAL_REQUIRED` recipient    | Starting from a non-anonymous Community post/comment creates one text-free request. The sender sees a pending explanation and cannot open history or send content.                                                                                                                                                      |
| `ANYONE` recipient               | The active/reused conversation opens through `/community/messages/{conversationId}`.                                                                                                                                                                                                                                    |
| Incoming request                 | The inbox shows no message preview and offers explicit accept, decline and block commands using the returned quoted version. Only an accepted result opens a thread.                                                                                                                                                    |
| Active conversation              | History renders in provider order, duplicate message IDs are removed, and the last visible message advances the opaque read cursor. Unread state comes from the provider response.                                                                                                                                      |
| Send succeeds                    | The UI renders the returned saved message and explicitly avoids delivery, online or read claims.                                                                                                                                                                                                                        |
| Send outcome is uncertain        | The draft remains visible with an explicit retry. Retry reuses the exact `clientMessageId` and `Idempotency-Key`.                                                                                                                                                                                                       |
| Read-only, empty or inaccessible | The composer is disabled for read-only state; empty lists have recovery guidance; uniform 404/dependency failures show safe retry/back paths without target or infrastructure detail.                                                                                                                                   |
| Privacy changes                  | All five provider preferences are editable, and save uses the exact quoted preference revision.                                                                                                                                                                                                                         |
| Safety                           | A real Community profile block remains available in the thread. The thread also links to the established safety directory; source post/comment reporting remains available. MB-685 deliberately exposes no chat-message report operation, so the web client does not fabricate report submission or moderation success. |

## Design and interaction evidence

- Accepted Stitch project: `9946598625924497023`.
- Accepted screens: desktop `7cfcb7807f7d4ea58468245c5be5c0bd`, mobile
  list `2a607656944340b3bc6411fc3f3f07ea`, mobile thread
  `8978751894514c77bf214a2f2a00401a`.
- The local interaction prototype was exercised with headless Chromium for
  list/thread navigation, send failure and retry, request decision and privacy
  save. Prototype files remain local under `.stitch/MB-686` and are not part of
  the commit.
- Production desktop evidence:
  [mb-686-community-chat-desktop.png](evidence/mb-686-community-chat-desktop.png)
- Production mobile evidence:
  [mb-686-community-chat-mobile.png](evidence/mb-686-community-chat-mobile.png)

## Verification

Run on Windows with Node dependencies restored from `package-lock.json`:

| Command                                                                                                      | Result                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .stitch/MB-686/prototype-check.mjs`                                                                    | Passed local prototype interactions in headless Chromium.                                                                                                                                                               |
| Focused Vitest: chat workspace, chat BFF, Community shell and safety actions                                 | 12 passed; 0 failed.                                                                                                                                                                                                    |
| `npm run quality` through the unit phase                                                                     | Format, lint, typecheck, contract checks and companion budget passed; 270 files / 1,667 tests passed. Its first build attempt alone hit `EBUSY` because the local E2E standalone process still held `.next/standalone`. |
| `npm run build` after stopping that exact local process                                                      | Passed; production routes include `/community/messages`, `/community/messages/[conversationId]` and `/api/community/chat/[...path]`.                                                                                    |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/e2e/community-chat.spec.ts --workers=1` | 2 passed; desktop covers privacy, text-free request and same-key retry; mobile covers list-first navigation, deep link and overflow.                                                                                    |

The screenshots use synthetic fixture identities and message content only. No
production, staging, paid-provider or personal data was used.
