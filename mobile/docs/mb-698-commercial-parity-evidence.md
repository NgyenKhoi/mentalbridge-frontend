# MB-698 mobile commercial parity evidence

Contract provider: Consultation OpenAPI v1 on backend `dev` at `1c6247d4`.

## Acceptance-state table

| Slice                     | Loading                             | Empty / not eligible                                                                                                    | Denied                                   | Stale / conflict                                                         | Failure / retry                                                           | Authoritative success                                                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| MB-709 rating             | Rating skeleton copy                | Rating control mounts only for an evidence-completed appointment; missing current rating is an empty first-rating state | 401/403/404 copy with no mutation        | 409/412/428 reloads current version before another edit                  | Explicit retry; no local optimistic aggregate                             | Receipt identity, selected score, version, and specialist aggregate must match the provider response |
| MB-711 plans/payments     | Catalogue and history loading copy  | Empty payment history is explicit; disabled checkout remains read-only                                                  | 401/403 clears mutation access           | Entitlement/idempotency conflicts require a fresh catalogue/history read | One logical checkout retains one command key and reconciles by payment ID | Only provider `SUCCEEDED` is confirmed; booking remains gated by a fresh service-credit read         |
| MB-712 specialist metrics | Analytics and earnings loading copy | `EMPTY` rating is distinct from zero; nullable metrics are not calculated                                               | 401/403 hides retry/mutation affordances | Reads are always refetched from owner endpoints                          | Retry reloads both owner projections; no cached arithmetic                | Rating aggregate and each balance bucket are displayed exactly as returned                           |

## Focused automated evidence

- Rating API identity/If-Match tests and rating UI unchanged/stale-edit tests.
- Subscription API idempotency/payment identity tests and pending-to-expired
  reconciliation test.
- Specialist owner-endpoint test and exact rating/financial-balance render test.
- Authored Maestro flows:
  - `.maestro/mb-698-user-rating.yaml`
  - `.maestro/mb-698-commercial-state.yaml`
  - `.maestro/mb-698-specialist-commercial.yaml`

## Native milestone status

`TEST_AUTHORED_NOT_RUN`. Jira assigns Android staging execution, screenshots,
video, and device provenance to the protected MB-666 milestone. This feature PR
does not claim emulator or physical-device acceptance.
