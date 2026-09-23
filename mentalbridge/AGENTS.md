# MentalBridge frontend rules

## User-facing copy

Write UI text for the person using the product, not for developers or reviewers.
Visible copy should help the user answer, in this order when relevant:

1. What is this?
2. How does it help me?
3. What information will be used?
4. What should I do next?

Lead with the benefit or action. Prefer short, natural Vietnamese and concrete
verbs. Put architecture, contracts, persistence behavior, and implementation
notes in code or technical documentation instead of the product UI.

### Do not leak implementation language

- Do not expose internal service names such as `Care`, backend ownership,
  database objects, state codes, internal IDs, contract names, or transport
  behavior in normal UI copy.
- Do not show provider, model, schema, policy/scoring version, provenance,
  revision, slot, lifecycle, tombstone, fallback, or similar implementation
  terms by default. If audit information is genuinely useful to the intended
  user, place it in a collapsed section named `Thông tin kỹ thuật`.
- Describe errors by the failed user action, what remains safe or unchanged,
  and a useful recovery step. Do not report which internal service failed.
- Never use one unfamiliar system concept to explain another unfamiliar system
  concept.

### Use consistent product language

| Internal term       | User-facing Vietnamese                     |
| ------------------- | ------------------------------------------ |
| Care / Care service | `MentalBridge` or omit the actor           |
| assessment          | `bài sàng lọc`                             |
| SupportPlan         | `kế hoạch hỗ trợ`                          |
| Support Guide       | `gợi ý hỗ trợ` or `hướng dẫn sau sàng lọc` |
| consultation credit | `lượt tư vấn`                              |
| entitlement         | `quyền lợi gói`                            |
| disclosure          | `thông báo quyền riêng tư`                 |
| provenance          | `thông tin nguồn` or `thông tin kỹ thuật`  |
| slot / occurrence   | `mục` or `hoạt động`, according to context |
| stale               | `cần cập nhật`                             |
| lifecycle           | `trạng thái kế hoạch`                      |

Hide revision and policy/scoring versions from ordinary screens unless the user
is explicitly working in an audit or technical context.

### Stay truthful and proportionate

- Do not claim personalization, matching, verification, safety, diagnosis, or
  another capability unless the UI is backed by real product data for that
  claim.
- Preserve clinically and legally important meaning in plain language. For
  example, do not turn a non-triggered screening rule into `Bạn an toàn`.
- Show privacy, consent, screening, and safety explanations at the point where
  they affect a decision. Avoid repeating the same disclaimer across every
  card or screen; keep one clear canonical explanation where practical.
- State exactly what data is used when asking for consent. Buttons and consent
  labels must name the action in terms the user can understand.

### Copy review checklist

Before completing a UI change, review headings, descriptions, buttons, labels,
empty/loading/error/success states, badges, consent text, and mobile variants.
Confirm that each message explains user value or action, uses the terminology
above, avoids unsupported claims, and contains no developer-facing notes.

## UI engineering constitution

Read `docs/DESIGN_SYSTEM.md` before changing product UI.

- Reuse `components/ui` and `components/motion` before creating a feature-local
  dialog, disclosure, select, tooltip, tabs, toast, choice control, or skeleton.
- Abstract shared behavior, not generic appearance. Feature compositions remain
  feature-owned and should not all become identical bordered cards.
- Use the semantic tokens in `app/globals.css`; do not invent per-screen motion,
  radius, shadow, spacing, or color systems.
- Design every applicable state: default, hover, focus-visible, pressed,
  disabled, loading, selected/open, error, and empty.
- Product motion must preserve continuity, use shared tokens, prefer transform
  and opacity, and honor `prefers-reduced-motion`.
- All changed screens must support keyboard navigation and be reviewed around
  375px, 768px, 1280px, and 1440px.
- Follow the Discover → Audit → Plan → Implement → Verify → Self-review workflow
  and do not call UI work complete based only on the happy path.
