---
name: mentalbridge-ui
description: Implement or review MentalBridge frontend UI, UX, responsive layout, interaction, motion, accessibility, or user-facing copy. Use for every user-visible frontend change; do not use for backend-only work or code changes with no rendered behavior.
---

# MentalBridge UI delivery

Deliver a coherent MentalBridge experience from repository contracts and local
evidence. External AI review is optional and never substitutes for these gates.

## Read before changing UI

Always read `../../../AGENTS.md` for product copy and repository constraints.
Then route the task through `../../../docs/README.md`:

- For a new page or page-level refactor, read the complete
  `../../../docs/UI_IMPLEMENTATION_PLAYBOOK.md`,
  `../../../docs/PRODUCT_EXPERIENCE.md`, and
  `../../../docs/DESIGN_SYSTEM.md` before editing.
- For a scoped component, state, layout, accessibility, or motion change, read
  the relevant sections selected by the documentation router. Do not load
  unrelated story evidence.

Current tokens and primitives in `../../../app/globals.css`,
`../../../components/ui`, `../../../components/motion`, and
`../../../lib/animations/config.ts` remain authoritative for implementation
details.

## Deliver the experience

1. State the user job, route/role, primary action, data authority, affected
   states, viewport targets, and intentionally excluded scope.
2. Audit the current route, owning feature, model/helper, tests, and a suitable
   product reference screen. Reuse principles and primitives, not copied card
   layouts.
3. Preserve API, permission, privacy, and clinical meaning. Never invent
   capability or infer authority from client time, scores, or missing data.
4. Implement hierarchy before polish: important state and action first; work
   surface next; history and technical detail last. Keep one primary action per
   state and avoid equal-weight card grids without real boundaries.
5. Design loading, data, source-empty, filter-empty, partial error, mutation,
   stale, and permission states when the existing contract can produce them.
   Independent regions fail and recover independently.
6. Verify inside the real application shell at 1440×900 and 1280×800, plus
   768px and 375px regression gates. Record real content width when sidebars
   reduce usable space; use container queries when that width owns the layout.
7. Check keyboard order, visible focus, accessible names, 44px targets,
   contrast, long Vietnamese content, 200% zoom, reduced motion, and absence of
   horizontal overflow or fixed-element collisions.

## Evidence and stopping rule

Run focused behavior tests for changed decisions and boundaries, then lint,
typecheck, production build, and the repository-required pre-merge gate in
proportion to impact. Capture sanitized visual evidence for materially changed
states.

Do not call a page complete until the Definition of Done in
`../../../docs/PRODUCT_EXPERIENCE.md` and the handoff evidence in
`../../../docs/UI_IMPLEMENTATION_PLAYBOOK.md` are satisfied. Stop and ask the
product owner when completion would require a new API, permission, medical
claim, or materially different product decision.
