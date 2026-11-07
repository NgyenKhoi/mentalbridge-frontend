# Community groups and identity dialog

Owner request 2026-11-07. Existing MentalBridge UI fallback; supplied full-frame
screenshots are the baseline. Preserve the shell, shared font and green tokens.

## Editable boundaries

- Chat creation: choose accepted friends, group name, selected chips, explicit
  pending invitations. Existing consent/roles/reporting/clear-history remain.
- Chat group details: right-aligned shared dialog; transcript keeps its space.
- Sharing groups: separate `/community/groups` member-only text feed. Provider
  authority: backend Community circles v1 and ADR 0052, migration 0025.
- Identity editing: shared native dialog/top layer, keyboard focus/escape and
  full-screen backdrop; existing editable identity fields are preserved.

## UX and state matrix

| Surface | Loading/empty | Success | Error/permission |
| --- | --- | --- | --- |
| Friend chooser | Local skeleton copy, empty link to friends, cursor load | Selected list and invite count | Retry without losing selection |
| Chat create | Name + at least one selected friend | Navigate after invitation calls | Stable creation/invite retry keys; retain progress and input |
| Sharing group list | Group context + create CTA | Active memberships and pending invitations | Independent list retry |
| Member feed | Context while loading, first-post prompt | Real text entries and lazy comments | Uniform inaccessible result; retry at current group |
| Sharing mutations | Disable active command | Refresh authoritative membership and list | Retain input, show error; no optimistic permission grant |
| Identity dialog | Current values | Existing owner save flow | Top-layer viewport scroll, focus restoration and Escape |

Desktop uses a narrow group index and bounded readable feed. At 768/375px they
stack; pickers/dialogs constrain scrolling to the viewport. Keyboard controls
remain semantic buttons, labels and native checkboxes. CSS uses existing tokens.
No fixture identities/counts, health claims, inferred online state or private
content is added to URLs/storage. New circle text is not browser-persisted.

User's earlier no-test preference is preserved. Verification for this task uses
targeted lint/type/contract checks, compilation, owner migration and operational
health; authenticated publication/member mutations are not performed on accounts.
