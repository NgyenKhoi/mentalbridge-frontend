# MB-648 SupportPlan Companion shell evidence

MB-648 adds one presentation-only Companion shell to the existing SupportPlan
Today, Plan, Progress, and Adjust surfaces. The owner supplies only a bounded UI
event and surface name; the component cannot read private plan content or issue
Care commands.

## State contract

| Bounded UI event                   | Visual state        |
| ---------------------------------- | ------------------- |
| `CONTENT_READY`                    | `idle`              |
| `SURFACE_ENTERED`                  | `greeting`          |
| `REQUEST_STARTED`                  | `thinking`          |
| `NEXT_STEP_AVAILABLE`              | `encouraging`       |
| `EXPLICIT_COMPLETION_ACKNOWLEDGED` | `celebrating-light` |
| `SENSITIVE_CONTEXT_ENTERED`        | `calm-empathetic`   |
| `WAITING_FOR_USER`                 | `waiting`           |

Every state has a short Vietnamese text equivalent. The reducer is deterministic
and accepts no inferred mood, diagnosis, adherence, recovery, assessment answer,
or plan authority. MB-647 is still a Jira draft as of 2026-10-13, so this change
implements only its seven named visual states. Message generation, AI context,
and policy remain out of scope.

## UX and accessibility

The desktop shell is an in-flow right dock. At narrower widths it becomes an
in-flow tray below the tabs, so it does not cover plan actions or sensitive
inputs. Expand/collapse, mute, and motion controls are keyboard accessible and
at least 44 by 44 pixels. Mute and explicit reduced-motion preferences persist
locally as presentation settings. System `prefers-reduced-motion` takes
precedence, removes repeated movement, and keeps the same visible state text.

The default character is an inline decorative SVG/CSS mark. A renderer adapter
allows a later approved animation runtime. A local error boundary replaces a
failed renderer with a static leaf while retaining the state text and controls.
No error payload or private context is logged.

The focused browser journey checks Be Vietnam Pro body text, Fraunces headings,
375px overflow, control size, collapse/reopen behavior, the reduced-motion
attribute, and that Companion interaction does not issue a plan activation
command. Controlled captures are:

- `mb-648-companion-desktop.png`
- `mb-648-companion-mobile.png`
- `mb-648-companion-reduced-motion.png`

## Design and performance evidence

The Stitch source is `../../.stitch/mb-648`. Final Stitch screens are
`7c21058ed54c42628f66e0b350b25da3` for mobile and
`ab29e8298343457e9a8792f9fb267ca2` for desktop. The exported prototype passed
font, diacritic, 44px target, overflow, collapse, and reduced-motion browser
checks through `node .stitch/mb-648/prototype-qa.mjs`.

The Companion performance budget is at most 150 KB of additional animation
assets and no network request during a visual-state transition. Measured result:
0 bytes of animation assets because the implementation uses existing Lucide
icons and CSS, and the state reducer performs no I/O. Reduced-motion mode has no
character animation or transition. The production build and focused Playwright
journey provide the runtime check.

## Verification

- `npx vitest run features/support-plan/components/SupportPlanCompanionShell.test.tsx features/support-plan/components/SupportPlanJourney.test.tsx lib/animations/use-reduced-motion.test.tsx --reporter=dot`: 39 tests.
- `node scripts/run-e2e.mjs tests/e2e/support-plan.spec.ts --workers=1 --reporter=line`: SupportPlan fixture-browser journeys and controlled screenshots.
- `npm run quality`: formatting, lint, generated route types, TypeScript, contract checks, unit/component tests, and production build.

All browser identities and plan data are synthetic. These artifacts are
fixture-browser evidence, not live cross-stack evidence.
