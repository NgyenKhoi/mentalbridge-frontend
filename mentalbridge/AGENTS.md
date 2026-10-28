# MentalBridge frontend rules

## Stitch-first UI workflow

### Owner-provided prototype fidelity (MB-667)

For MB-667, the owner's supplied Stitch prototype is the visual, interaction,
and static-copy specification. Do not invoke frontend-design, frontend-design-premium,
or another design skill to reinterpret this approved design. Preserve only the
existing sidebar, font families, and MentalBridge green tone. Rebuild all main
content, including desktop/mobile composition, score bars, history states,
Guide content, and Mầm An loading, to match the prototype. Prototype-only demo
state selectors are review controls, not product navigation. Populate personal
data, scores, dates, saved Guide links, and safety state from the real contracts;
do not copy fixture identities, invented phone numbers, or unsupported actions.
The owner request overrides older evidence that says to lock the entire shell.

Stitch is **optional**, not a prerequisite for substantial UI work. The
Product Owner has approved an **existing-UI fallback** for both Next.js and
Expo, including MB-664 and the currently assigned no-Stitch Jira stories.
When a story does not explicitly require fidelity to an owner-approved Stitch
reference, implement directly from the current MentalBridge screen, real
contracts, components and design tokens. Do **not** ask for another approval,
create a Stitch project, generate Stitch HTML/screenshots or require a separate
Stitch prototype. Before editing, verify the existing full-frame application
baseline (reusing a current artifact or capturing the actual route), document
the UX/state matrix and editable feature boundary, and validate navigation,
responsive layouts, accessibility, privacy and interactions in the real app.

If the owner explicitly requests an approved Stitch prototype, follow
`../.codex/skills/mentalbridge-stitch-ui/SKILL.md` for that story, including
the MB-667 fidelity rule above. On either path, preserve the existing
shell/sidebar/header/tabs unless the owner-approved story changes them; never
invent data/permissions or bypass code-owner and test gates. Small copy,
accessibility and state fixes can follow the local implementation workflow
without an external design review.

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
- For self-reported emotion data, keep the non-diagnostic interpretation note
  only in the Dashboard overview. Analytics charts, detail dialogs, and other
  secondary views must not repeat it as an alert, notification, or disclaimer
  card. Contract interpretation fields remain validated but are not rendered
  repeatedly.
- State exactly what data is used when asking for consent. Buttons and consent
  labels must name the action in terms the user can understand.

### Copy review checklist

Before completing a UI change, review headings, descriptions, buttons, labels,
empty/loading/error/success states, badges, consent text, and mobile variants.
Confirm that each message explains user value or action, uses the terminology
above, avoids unsupported claims, and contains no developer-facing notes.

## UI engineering constitution

Use `docs/README.md` as the documentation router and read the UI or motion
documents that are relevant to the task. Read `docs/PRODUCT_EXPERIENCE.md` for
route hierarchy or either priority journey. `docs/DESIGN_SYSTEM.md` is the
compact shared foundation for visual language, tokens, primitives,
accessibility, and motion decisions; it is not a mandatory standalone gateway
for every UI change.

For a page implementation or refactor, follow
`docs/UI_IMPLEMENTATION_PLAYBOOK.md`. Its brief, state matrix, responsive
matrix, local behavior tests, and visual evidence are the default review path;
an external AI review is optional and must not become an implicit dependency.

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
- All changed screens must support keyboard navigation. Review 1280px and
  1440px as the primary desktop/laptop targets; keep 375px and 768px as
  functional regression gates.
- Follow the Discover → Audit → Plan → Implement → Verify → Self-review workflow
  and do not call UI work complete based only on the happy path.
