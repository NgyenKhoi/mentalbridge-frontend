# MB-745 Community message retraction — web evidence

The Community message workspace consumes the additive MB-745 provider contract.
Only the current sender sees the retraction action. The browser sends no actor,
message content or authority field with the `DELETE` request.

## Acceptance states

| State              | Web behavior                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Active own message | Shows an explicit “Gỡ tin nhắn” action. Peer messages retain only the report action.                                                  |
| Confirmation       | Explains that content will be replaced for everyone; cancel is available and no optimistic mutation occurs.                           |
| Pending            | Keeps the original cell and disables repeated confirmation while the provider request is in flight.                                   |
| Retracted          | Replaces the same keyed cell with an author-labelled tombstone and original timestamp; content and report/retract actions are absent. |
| Failure            | Keeps the original content and shows an inline retry bound to the same conversation/message pair.                                     |
| Reconnect/history  | Strict `ACTIVE`/`RETRACTED` parsing rejects a tombstone that still contains content. Provider history remains authoritative.          |

The authenticated catch-all BFF validates both UUID path values and forwards
`DELETE /conversations/{conversationId}/messages/{messageId}` to Community.
The response must be the exact structured tombstone.

## Design gate

Stitch project `13180159114465807745` explored desktop and narrow-mobile
confirmation, pending, tombstone and retry states. Production uses the existing
MentalBridge tokens and Dialog component; no Stitch artifact or generated code
is committed.

## Verification

Run from `mentalbridge/`:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Focused contract, BFF and workspace tests cover strict tombstone parsing,
body-free DELETE forwarding, confirmation, in-place replacement and content
removal.
