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
or plan authority. Accepted ADR 0040 / `MB-SUPPORT-PLAN-COMPANION-001` is the
source of truth after backend merge `6fad2ec72de2e32d77eeb69565dc7ad931a88f64`.
The route mount emits one greeting event. A real surface change resets to idle,
except Adjust, which uses the approved sensitive-review presentation. Progress
does not manufacture `NEXT_STEP_AVAILABLE`; generic application loading does
not manufacture `WAITING_FOR_USER`; and only a successful authoritative
completion command emits `EXPLICIT_COMPLETION_ACKNOWLEDGED`. Unsupported events
remain available in the reusable reducer without being fabricated by the
current shell. Message generation, AI context, and provider calls remain out
of scope.

## UX and accessibility

The desktop shell is an in-flow right dock. At narrower widths it becomes an
in-flow tray below the tabs, so it does not cover plan actions or sensitive
inputs. Expand/collapse, mute, and motion controls are keyboard accessible and
at least 44 by 44 pixels. Mute is stored only in `sessionStorage` under
`mentalbridge_support_plan_companion_session_muted`: it survives component
remounts, SupportPlan tab navigation, and reloads within the same browser-tab
session, then ends with that session. A legacy value under
`mentalbridge_support_plan_companion_muted` in `localStorage` is ignored and is
never migrated. The explicit reduced-motion preference remains in
`localStorage`. If either Web Storage getter, read, or write is denied, the
shell keeps the affected preference in memory for the current page lifetime
and remains interactive; a new browser session does not inherit that fallback.
System `prefers-reduced-motion` takes precedence, removes repeated movement,
and keeps the same visible state text.

The static shell has no live region. Tab changes, loading, route-entry greeting
and other passive visual-state changes therefore do not create unsolicited
screen-reader announcements. All state text remains visible and readable.
MB-649 must introduce a separate polite announcement boundary only for a new
explicitly requested Companion response and must honor mute there. Mute never
changes authoritative plan status, validation, error, safety or action output.

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

The Companion adds 0 bytes of animation assets and performs no network request
during a visual-state transition. It uses existing Lucide icons and CSS, and
the state reducer performs no I/O. Reduced-motion mode has no character
animation or transition.

`mb-648-companion-performance.json` records the reproducible Chromium
fixture-browser measurement from the production standalone route. The mobile
profile uses a 375 x 667 viewport, 4x CPU throttle, 150 ms network latency,
1,600 Kbps download, and 750 Kbps upload. Desktop uses 1280 x 900 with no CPU
or network throttle. Initial load is measured through the primary heading,
transition time through destination content, and CPU from Chromium
`Performance.getMetrics`. Request-animation-frame pacing is the portable
compositor/GPU-facing measure: p95 frame interval and intervals over 34 ms.

| Profile          |    Initial load (budget) | Tab transition (budget) |                  Idle normal CPU / p95 / drops |                Idle reduced CPU / p95 / drops |
| ---------------- | -----------------------: | ----------------------: | ---------------------------------------------: | --------------------------------------------: |
| Mobile throttled | 5,173.537 ms (10,000 ms) |    89.931 ms (1,500 ms) | 313.784 ms / 16.7 ms / 0 (450 ms / 80 ms / 12) | 79.716 ms / 16.7 ms / 0 (450 ms / 80 ms / 12) |
| Desktop          |    261.290 ms (5,000 ms) |     443.609 ms (750 ms) |   65.978 ms / 16.7 ms / 0 (250 ms / 50 ms / 8) |  19.360 ms / 16.7 ms / 0 (250 ms / 50 ms / 8) |

Reproduce and overwrite the evidence artifact with:

```powershell
$env:MB648_WRITE_PERFORMANCE_EVIDENCE="true"
node scripts/run-e2e.mjs tests/e2e/support-plan.spec.ts --workers=1 --reporter=line
```

The Playwright assertions enforce the same budgets on every execution. The
idle window is 1,200 ms for each normal and reduced-motion sample.

## Verification

- `npx vitest run features/support-plan/components/SupportPlanCompanionShell.test.tsx features/support-plan/components/SupportPlanJourney.test.tsx lib/animations/use-reduced-motion.test.tsx --reporter=dot`: 50 tests, including session lifetime/remount/navigation, legacy mute isolation, storage-denial getter/read/write, passive announcement, event-semantic, reduced-motion and authoritative plan-control regressions.
- `node scripts/run-e2e.mjs tests/e2e/support-plan.spec.ts --workers=1 --reporter=line`: SupportPlan fixture-browser journeys and controlled screenshots.
- `npm run quality`: 231 test files and 1,267 tests, plus formatting,
  lint, generated route types, TypeScript, contract checks, and production
  build after synchronizing `origin/dev` at `ff163e0`.

All browser identities and plan data are synthetic. These artifacts are
fixture-browser evidence, not live cross-stack evidence.
