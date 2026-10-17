# MB-619 appointment dispute UI evidence

MB-619 adds a bounded appointment-dispute journey to the existing Consultation
workspace without exposing raw session, chat, journal, assessment, or health
content.

- USER and assigned SPECIALIST see the same role-specific review control inside
  an eligible settled appointment. A failed ambiguous submission keeps one
  payload signature and idempotency key for a safe retry.
- Existing open and resolved disputes remain visible after the 24-hour creation
  window. The UI displays operational state and the credit outcome, not raw
  evidence or hidden participant identity.
- ADMIN receives a dedicated `Xem xét phiên tư vấn` queue. Resolution is limited
  to keeping the recorded outcome or returning the consultation credit, with
  closed matching reasons and no free-text or clinical conclusion field.
- Every browser operation uses a same-origin BFF route. The BFF revalidates the
  authenticated USER, SPECIALIST, or ADMIN role and forwards only the frozen
  Consultation OpenAPI fields.

Focused evidence covers strict contract parsing, sensitive-field rejection,
role-specific BFF forwarding, ambiguous retry key reuse, participant resolved
state, and bounded admin resolution controls.
