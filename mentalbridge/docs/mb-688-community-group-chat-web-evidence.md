# MB-688 private Community groups — web evidence

MB-688 extends the existing Community messages workspace with private,
invite-only groups. It consumes the implemented MB-687 contract through the
authenticated BFF. The browser cannot choose an owner identity or create an owner
role, and it never treats a pending invitation as permission to read group data.

## Acceptance states

| State                    | Web behavior                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group inbox              | Direct and group conversations remain in one private inbox. Group rows show only group name, viewer role, member count, unread count and archived state.                          |
| Create group             | The name is required and limited to 80 Unicode characters. The exact idempotency key is retained for the authoritative create request; no optimistic group is inserted.           |
| Incoming invitation      | The invitation shows group name, inviter and expiry but no history/member list. Accept and decline use the invitation revision, which is never reused as a group revision.        |
| Active group             | Authorized members use the existing bounded message history, durable send/retry and read-cursor flow. No delivery, online or read claim is added.                                 |
| Members                  | The member list is loaded only after the selected conversation is authorized as a group. Pagination retains the current list and retries the opaque cursor.                       |
| Invite a peer            | Owners/admins select an eligible peer from their active private conversations. Raw profile IDs and a public Community directory are never exposed. Existing members are excluded. |
| Roles                    | Owners can promote/demote non-owner members. Ownership can transfer only to a current admin. Admin/member controls are hidden unless the viewer role permits them.                |
| Leave/remove             | A non-owner can leave; an owner must transfer ownership or archive first. A successful leave/removal is 204 and the stale revision is never incremented locally.                  |
| Archive                  | Owner-only archive requires confirmation. The inbox is reloaded after success; retained authorized members see the provider's read-only archived state.                           |
| Stale/conflict           | A 409 shows a reload-first message. Commands use the latest authoritative group ETag/version; invitation versions remain isolated.                                                |
| Forbidden/not found      | The UI fails closed with one uniform unavailable message and does not reveal group name, members, history, presence or target existence.                                          |
| Responsive/accessibility | Desktop keeps the accepted split workspace. Mobile remains list-first with a dedicated thread, 44px controls, labelled dialogs, visible focus and no horizontal overflow.         |

## Integration map

The catch-all route validates exact request bodies, UUID path values,
idempotency keys, quoted `If-Match` headers and bounded cursors before forwarding:

- `POST /groups`
- `DELETE /groups/{conversationId}`
- `GET /groups/{conversationId}/members`
- `POST /groups/{conversationId}/invitations`
- `GET /invitations`
- `POST /invitations/{invitationId}/decision`
- `PUT /groups/{conversationId}/members/{communityProfileId}/role`
- `DELETE /groups/{conversationId}/members/{communityProfileId}`
- `POST /groups/{conversationId}/ownership`

Provider response DTOs are parsed with exact-key validation. Extra authority fields
such as client-authored `ownerId` or invite role are rejected locally.

## Design and interaction evidence

- Stitch project: `9946598625924497023`.
- Design system: `assets/cb851bc87d2b4607a0dc07d64e962251`
  (`MentalBridge Companion Room`).
- Accepted MB-688 screens:
  - desktop `785f9ad8e6834c79ba9effd99344ee9a`
  - mobile inbox `f4a7f3fbc0764c8781553773c5b0ad9e`
- Local brief and interaction prototype remain under `.stitch/MB-688` and are not
  committed. The prototype covers create, invitation consent, role change,
  destructive confirmation and 390px overflow.
- Production desktop evidence:
  [mb-688-community-group-desktop.png](evidence/mb-688-community-group-desktop.png)
- Production mobile evidence:
  [mb-688-community-group-mobile.png](evidence/mb-688-community-group-mobile.png)

## Verification

Run from `mentalbridge/`:

| Command                                                                                                                                                                                        | Coverage                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `node ../.stitch/MB-688/prototype-check.mjs`                                                                                                                                                   | Local interaction prototype and mobile overflow.                                                                                 |
| `npx vitest run features/community-chat/api/community-chat-contract.test.ts app/api/community/chat/[...path]/route.test.ts features/community-chat/components/CommunityChatWorkspace.test.tsx` | Strict DTO/input parsing, BFF validation/forwarding, group create/invitation/member/role/archive UI and direct-chat regression.  |
| `npm run quality`                                                                                                                                                                              | Formatting, lint, type generation, TypeScript, contract checks, unit suite and production build.                                 |
| `npx playwright test tests/e2e/community-chat.spec.ts --grep "invite-only group" --workers=1`                                                                                                  | Production private-chat invitee selection, revision propagation, archive confirmation, mobile list-first layout and screenshots. |

All fixtures use synthetic Community identities and messages. No production,
staging, paid-provider or personal data is used.

Verified on 2026-10-21: the focused Vitest suite passed 34/34 tests, the full
quality gate passed 273 test files and 1,766 tests including the production
build, and the focused Playwright production journey passed 1/1 test on both
desktop and mobile viewports.
