# MB-651 expanded guided Companion UX brief

## Scope and authority

- Jira: MB-651.
- Surface: the existing SupportPlan Companion shell on Today, Plan, Progress,
  and Adjust.
- User job: explicitly open a bounded panel, select an approved starter, read
  a short explanation or navigation hint, and return to an authoritative
  SupportPlan surface without losing page state.
- Authority: Care remains the source for plan/action facts and owns the
  existing action-explanation request. The frontend may present facts already
  on the loaded plan and route to an existing SupportPlan surface. Companion
  never saves, activates, completes, pauses, replaces, or edits a plan.
- Exclusions: no free-text prompt, hidden model call, raw assessment answers,
  Journal text, Emotion detail, Consultation data, clinical inference, or
  persisted conversation history.

## Interaction and retention

- Opening and closing are explicit. Close restores focus to the opener.
- The panel exposes fixed starter buttons only. An AI request starts only from
  the eligible action-explanation starter; navigation and current-plan facts
  are deterministic local responses.
- Follow-up actions close the mobile sheet/panel, select the destination tab,
  and focus its tab control. The destination re-applies its existing dirty-form
  and confirmation rules.
- Guided turns live only in React memory. Closing/remounting, refreshing, or
  leaving SupportPlan clears them. Nothing is written to Web Storage or sent
  to a history API.
- Session mute suppresses the polite live announcement while keeping requested
  text readable. Passive open/close and loading changes are not announced as
  new AI content.

## Responsive and accessibility decision

- Desktop keeps the panel in the Companion column at 390px so authoritative
  content and top-level navigation remain visible.
- Below 1100px the same panel becomes a scrollable bottom/full-height sheet.
  It uses modal sheet semantics: background content is inert, body scrolling is
  locked, Tab/Shift+Tab stay inside, Escape closes, and focus returns to the
  opener. It closes before navigation and then focuses the exact action when it
  is still present.
- Controls use native buttons, visible focus rings, and at least 44px targets.
  There is no textbox, send control, microphone, or unsolicited prompt.
- Production typography uses the existing Be Vietnam Pro body/control tokens
  and Fraunces heading token. Vietnamese accents wrap with generous line-height.

## Stitch evidence

- Project: `projects/1256373820415012052` — **MB-637 — Support Plan v3 UX Prototype**.
- Desktop result: `323a0b2322764c5ba256e298703eeff2`.
- `desktop.html` is the interactive full-frame prototype; `desktop.png` is its
  exported frame.
- `mobile.png` is the dedicated 375px mobile sheet result from the MB-650 mobile
  baseline. Stitch rendered Be Vietnam Pro/Fraunces with the Vietnamese subset,
  complete starter controls, clear boundary copy, no text clipping, and no
  broken component.
- Illustrative Stitch response copy is layout evidence only. Production renders
  the bound Care response or explicit deterministic navigation/plan facts.
