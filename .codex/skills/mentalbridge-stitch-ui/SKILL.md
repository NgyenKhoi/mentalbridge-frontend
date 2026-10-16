---
name: mentalbridge-stitch-ui
description: Design and implement new or materially changed MentalBridge web or mobile UI with a mandatory Stitch reference, render/font QA, a local interaction prototype, and repository-native production code. Use when a task creates or changes a user journey, screen composition, controls, responsive behavior, or motion; skip code-only refactors and tiny copy-only fixes.
---

# MentalBridge Stitch-first UI delivery

## Owner-supplied approved prototype

When the owner supplies an approved Stitch prototype and requests exact fidelity,
use it as the specification for layout, interactions, responsive states and static
copy. Do not introduce a new visual direction through another frontend-design
skill. The owner's explicit preservation boundary overrides the default chrome
lock below. For MB-667 that boundary is sidebar, fonts and the existing green
brand tone only; all main content follows the approved prototype. Retain real
contract data and authorization, and adapt fixture-only controls or unsupported
medical claims/actions to the existing authoritative behavior.

Use this workflow before production implementation whenever the task starts UI
design or materially changes a user-facing journey. Stitch is design evidence,
not production runtime or product authority.

## 1. Establish a full-frame baseline

Before prompting Stitch, select an approved full-frame reference for every
materially different viewport. Reuse an existing repository artifact when it
contains the complete application frame and still matches the current route.
Otherwise capture the real route with controlled fixtures. Do not require a
new screenshot when a current, complete artifact already exists.

The baseline must show the actual application shell, including global sidebar
or mobile navigation, global top bar/header, route title/context, existing
route tabs, content bounds and scroll ownership. A component-only harness or
content crop cannot be the full-frame source of truth.

Verify reused artifacts against the current owning components. Reject them as
stale when they omit, replace or relocate locked chrome. Record the artifact
path, capture viewport and verification evidence in `brief.md`.

Classify the baseline into:

- **locked chrome**: shell, sidebar, global header/top bar, route header,
  breadcrumbs, existing route tabs and their responsive behavior;
- **editable content slot**: the smallest tab panel or feature subtree owned by
  the story;
- **conditional chrome**: existing controls that may appear by state but whose
  ownership and placement must stay unchanged.

Unless the Jira story explicitly changes navigation or shell architecture,
locked chrome must not be redesigned, duplicated, removed or moved.

## 2. Ground the prompt

Read the task, owning `AGENTS.md`, product-experience/design-system documents,
current screen and tests, and the authoritative API contract. Write a compact
brief covering:

- Jira key, route, actor and the job the user must complete;
- real data and permission authority, including fields that may be absent;
- loading, empty, partial, error, success, stale and forbidden states that can
  actually occur;
- one primary action per decision region, responsive priorities and accessible
  keyboard/touch behavior;
- desired interaction and motion: entry, selection, validation, save, success,
  stale recovery and reduced-motion equivalents.
- the baseline artifact paths, locked-chrome inventory, editable content-slot
  boundary, and production components that own those boundaries.

Do not ask Stitch to invent APIs, permissions, clinical meaning, diagnosis,
user data or capabilities.

## 3. Edit from the baseline in the established Stitch project

List available Stitch projects and reuse the closest maintained MentalBridge
project. Prefer a feature-adjacent project and design system; otherwise use
`MentalBridge UI Redesign`. For SupportPlan work, prefer
`MB-637 — Support Plan v3 UX Prototype` and its `Therapeutic Sanctuary` design
system. Create a new Stitch project only when no maintained project can keep the
work understandable.

Use the verified full-frame artifact as the visual baseline. When Stitch can
accept an image reference, provide the full frame and identify only the target
content slot as editable. Otherwise edit the closest existing Stitch screen
that already reproduces the verified frame and compare it side-by-side with the
baseline. Do not generate a free-standing page from text and infer the shell
later.

The prompt must explicitly preserve locked chrome and modify only the named tab
panel/content slot. Stitch must not add a second page header, sidebar, tab bar,
breadcrumb, mobile app bar or floating navigation. Surrounding chrome in
generated HTML is reference-only and must never be copied into production.
Request purposeful UX behavior and animation inside the editable content slot.

Generate every materially different viewport needed by the story (normally
desktop and mobile) and reuse the same project design system for consistency.

## 4. Inspect the generated result before coding

Retrieve both the screenshot and HTML for each generated screen. Check:

- Vietnamese diacritics render correctly; declared fonts load and have safe
  fallbacks; no glyph, line-height or clipping defects;
- every control, icon, label, selected state, dialog/disclosure and responsive
  region renders; no placeholder or broken component remains;
- hierarchy, copy, long text, overflow, contrast and touch targets fit the real
  journey;
- motion describes state change or feedback, is interruptible, and has a
  reduced-motion equivalent.
- side-by-side comparison shows that sidebar, top bar, route header and route
  tabs were neither removed nor duplicated;
- the proposed content fits the real panel bounds without changing shell width,
  header height, tab placement or page scroll ownership.

If a defect is visible, edit/regenerate the Stitch screen and repeat this gate.
Do not silently repair a materially wrong design only after production coding.
Any new or missing shell/header/navigation is a failed gate even when the
content panel itself looks good.

## 5. Build a local UX prototype

Store story evidence under the owning app's `.stitch/<jira-key>/` directory:

- `brief.md` with the final prompt, project/screen identifiers and state map;
- the retrieved Stitch HTML and screenshots;
- a repository-local HTML/CSS/JS prototype when Stitch output is not already
  interactive enough to exercise the primary journey.

The prototype must demonstrate the important transitions and recovery paths,
including keyboard focus and reduced motion where relevant. Mount or composite
it inside the verified shell so reviewers can see exact page integration; a
content-only prototype is not sufficient by itself. Validate it for font
loading, console/render errors, desktop/mobile overflow and component states.
This is a prototype gate; do not wire real credentials or production service
calls into it.

## 6. Translate the accepted direction

Only after the Stitch and prototype gates pass, implement the UI with existing
repository components, semantic tokens, contracts and state-management
patterns. Do not paste Stitch's standalone runtime, CDN dependencies, mock
business logic or generated utility framework into production code. Preserve
the approved hierarchy, interaction behavior and motion intent while adapting
it to the real application architecture.

Implement only inside the recorded editable component/panel boundary. Reuse the
existing shell, route header and route tab components. Never copy Stitch's
sidebar/header/tab markup into the feature, and never delete or bypass the
production shell merely because the generated artifact is a full HTML page.

Verify targeted behavior tests, lint, typecheck, build, responsive states,
keyboard/focus and reduced motion. Report the Stitch project/screens, local
prototype path, checks run and any evidence that could not be executed.

## External-tool failure

If Stitch is unavailable or generation cannot be retrieved, report the exact
failure and pause new visual-direction implementation. Continue only from an
existing approved Stitch reference or after the user explicitly chooses a
fallback; never claim a local mockup was Stitch-generated.
