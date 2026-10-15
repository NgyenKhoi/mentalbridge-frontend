# MB-630 — USER appointment requests and management

## Experience brief

- USER job: request an exact discovery selection, see authoritative consultation
  credits and reservation capacity, manage own upcoming/history/detail, and
  confirm cancellation or linked replacement without local credit settlement.
- Entry: USER home → appointments; approved discovery selection → booking review.
  Existing native Screen/PrimaryButton/tokens, one reading column, 48px controls.
- Authority: Consultation public OpenAPI v1.12.0, owner-scoped appointment list,
  service-credit read, bookable slots, request and cancellation commands.
  No individual public appointment GET exists: detail re-reads the owner list.
- Actions: list/detail → fresh review → explicit confirmation → authoritative
  result. Server list timestamps/status suggest change candidates, never client
  time. The command remains the final eligibility authority.
- States: initial loading, empty/filter-empty, independent credit/list failures,
  unavailable selection, pending command, ambiguous outcome/same-key replay,
  stale version, authorization, lifecycle/session outcome and linked replacement.
- No payment, ledger mutation, package-derived limits, clinical inference,
  reminder scheduling or chat/video simulation. Session/chat destinations are
  separate stories; obsolete records never expose an actionable session link.
- Viewport evidence: actual Android 375/768/1280/1440dp; long Vietnamese wraps.

## Verification map

Strict parsers and owner/response identity checks; supported request bodies and
quoted If-Match; server balance/cap fields; explicit stable idempotency and
ambiguous replay; cancellation/replacement race checks; account-change and
background refresh; authoritative outcome/history and fail-closed video.

Android DoD must execute real discovery → request → app restart → owner list
and persisted detail against protected disposable real Identity/Consultation.
Execution status/head/provider/artifact evidence is recorded on the PR, not
in a subsequent documentation commit that would invalidate the proven head.
Ordinary dev mobile gate remains compile-only; native proof is explicitly opt-in.
