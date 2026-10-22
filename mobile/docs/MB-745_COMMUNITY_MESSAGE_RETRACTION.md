# MB-745 — Community message retraction on mobile

Mobile consumes the additive Community owner contract and Realtime
`community.message.updated` event. The action is visible only for an active
message whose Community profile ID matches the current profile.

## State and authority

| State          | Mobile behavior                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmation   | Inline disclosure describes the all-viewer replacement and offers “Giữ lại”.                                                                       |
| Pending        | The original message remains visible while repeated retraction is disabled.                                                                        |
| Success        | The REST tombstone replaces the same message ID in place.                                                                                          |
| Realtime       | A loaded message is replaced by ID; an unknown/unloaded target triggers authoritative REST repair and is never appended from socket arrival order. |
| Failure        | Original content remains and an inline retry uses the same conversation/message pair.                                                              |
| Revoked access | Existing fail-closed behavior clears the transcript for 401/403/404.                                                                               |

`RETRACTED` requires `retractedAt` and rejects `content`. The rendered fallback
is “Tin nhắn đã được gỡ” when Community identity is unavailable. Retraction does
not change unread state, send state or the read cursor.

Stitch project `13180159114465807745` supplied the shared responsive interaction
exploration. Production keeps the existing native tokens and inline disclosure
pattern; no Stitch artifact is committed.

## Verification

Run from `mobile/`:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:ci`
- `npm run build:bundle`

Focused adapter, session and component tests cover content-free tombstones,
exact DELETE binding, REST and socket replacement without append, confirmation
and removal of the original content.
