# MB-648 Companion shell UX brief

## Scope

- Jira: MB-648
- Route: authenticated SupportPlan workspace, across the existing **Hôm nay**, **Kế hoạch**, **Tiến triển**, and **Điều chỉnh** tabs.
- Actor: USER reviewing or acting on their own support plan.
- Job: keep a quiet, optional companion presence available without obscuring the plan, interrupting sensitive work, or claiming authority over plan decisions.
- Authority: the companion is presentation only. It receives bounded UI events and never creates, edits, completes, skips, pauses, activates, or replaces a plan.
- Dependency note: MB-647 is not merged as of 2026-10-13. This story therefore implements only the seven animation states named in the MB-647 Jira draft and does not invent message generation, AI context, or plan policy.

## Baseline and boundaries

- Stitch project: `projects/1256373820415012052` — **MB-637 — Support Plan v3 UX Prototype**.
- Desktop full-frame baseline: `.stitch/mb-637/support-plan-today-desktop-approved.png`, verified against `SupportPlanJourney.tsx`, `SupportPlanCard.tsx`, and `support-plan.css` on `origin/dev` at `9621545`.
- Mobile full-frame baseline: `.stitch/mb-637/support-plan-today-mobile-runtime.png`, verified against the same owning components and current responsive rules.
- Locked chrome: authenticated sidebar/mobile navigation, global header, SupportPlan route heading/date/adjust control, four route tabs, content width, and document scroll ownership.
- Editable content slot: a companion dock beside the SupportPlan tab panel on desktop and an in-flow compact tray directly below the tabs on mobile.
- Conditional chrome: current plan cards, loading/error/empty states, dialogs, and existing actions remain unchanged.

## State and interaction contract

- Animation states: `idle`, `greeting`, `thinking`, `encouraging`, `celebrating-light`, `calm-empathetic`, `waiting`.
- State changes come only from explicit, bounded UI events supplied by the owning surface. They never infer mood, diagnosis, adherence, recovery, or completion.
- Expanded: show the static non-clinical helper sentence for the active tab plus controls.
- Collapsed: show character mark and an accessible expand control.
- Muted: suppress nonessential live announcements; state remains visible as text.
- Reduced motion: user preference and `prefers-reduced-motion` both remove transforms/repeated animation while preserving the same state label.
- Runtime failure: show a static character fallback and retain all controls and text.
- Preferences are local presentation preferences, with no business API or plan mutation.

## Responsive and accessibility matrix

| Mode              | Placement                         | Behavior                                                                            |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| Desktop 1280/1440 | in-flow right dock beside content | collapsed width is narrow; expanded dock reflows content and never overlays actions |
| Tablet 768        | in-flow tray below tabs           | full-width, compact by default                                                      |
| Mobile 375/390    | in-flow compact tray below tabs   | 44px controls, no fixed overlay, expanded content pushes plan downward              |
| Reduced motion    | same placement                    | static pose and text equivalent; no bob/pulse/transition                            |
| Runtime failure   | same placement                    | static leaf/face fallback with explicit accessible label                            |

Keyboard order follows the document: tabs, companion expand/collapse, mute, motion preference, then plan content. Controls expose Vietnamese screen-reader labels and visible focus. The component does not trap focus.

## Final Stitch outputs and review

- Mobile refined screen: `7c21058ed54c42628f66e0b350b25da3`.
- Desktop refined screen: `ab29e8298343457e9a8792f9fb267ca2`.
- Exported HTML and PNG files in this directory are the controlled prototype evidence.
- `node .stitch/mb-648/prototype-qa.mjs` passed desktop and 375px mobile checks for visibility, collapse/expand, 44px controls, horizontal overflow, reduced-motion static rendering, replacement glyphs, and resolved Be Vietnam Pro body/control text.
- Both final frames were visually inspected for shell preservation, in-flow placement, Vietnamese typography, and action clearance.

## Stitch prompt

Edit the existing full-frame SupportPlan Today screens only. Preserve the MentalBridge authenticated shell, route header, date/adjust controls, four tabs, current SupportPlan cards, widths, typography, and scroll ownership exactly. Add a restrained animated Companion shell inside the SupportPlan content area: on desktop, an in-flow right dock that can collapse to a narrow character rail and expand without covering any action; on mobile, an in-flow compact tray immediately below the tabs that expands by pushing content downward. Use the existing Therapeutic Sanctuary design system, Newsreader-style editorial headings and Be Vietnam Pro body/control text. The companion must feel calm, concise, adult, non-clinical, and non-gamified. Show controls for expand/collapse, mute/unmute, and motion on/reduced, all at least 44px. Include a small state label and non-motion text equivalent. Represent the seven bounded visual states (idle, greeting, thinking, encouraging, celebrating-light, calm/empathetic, waiting) without inferring mental health. No chat input, no AI-generated message, no plan mutation, no scores, streaks, confetti, diagnosis, or recovery claims. Include static fallback behavior visually. Ensure Vietnamese diacritics, font metrics, focus states, contrast, and 375px overflow are correct. Do not add or move any sidebar, header, tabs, breadcrumbs, floating navigation, or primary plan actions.
