# MB-650 contextual Companion UX brief

## Scope and authority

- Jira: MB-650.
- Surface: eligible SupportPlan action cards on **Hôm nay** and **Kế hoạch**.
- User job: explicitly ask for a short explanation of an already approved Resource, Journal, Emotion Check-in, or Professional Support action without losing access to the original action.
- Authority: Care resolves the exact owned plan/action and creates the minimized MB-647 `ACTION` context. Frontend supplies only plan identity, action identity, and the approved surface. Journal/AI may phrase that context and owns the deterministic template fallback.
- Exclusions: no prompt input, chat panel, automatic model request, inferred emotion/wellbeing, plan mutation, clinical advice, persistence, or arbitrary client context. Expanded conversation belongs to MB-651.

## Design decision

- Desktop: a compact 44px **Giải thích** control sits beside the source action; its non-modal bubble is anchored below that source and never covers the primary CTA or dialog.
- Tablet/mobile: the same explicit control requests the response, while the response appears in the existing in-flow Companion tray. The tray expands by reflowing content.
- Loading retains the action identity and leaves the original CTA usable. Duplicate requests for the same active control are disabled until completion.
- Dismiss returns keyboard focus to the trigger. Moving tabs dismisses the contextual response; no response reopens automatically.
- Failure displays a neutral availability message. A Care/Journal deterministic template is labeled by state, not presented as a successful provider generation.
- Mute suppresses only the new Companion live announcement. Requested text remains visible; authoritative plan feedback, validation, safety information, and plan actions are unaffected.
- Unsaved schedule/personalization edits disable Companion requests so the surface does not interrupt sensitive input.

## Typography, component, and motion contract

- Production uses the existing SupportPlan type tokens: Be Vietnam Pro for body/control text and the established editorial heading family.
- Vietnamese diacritics must render without replacement glyphs, clipped accents, or forced single-line truncation.
- Controls use native buttons, a visible focus ring, Vietnamese accessible names, 44px targets, and no focus trap.
- Response width wraps long approved copy up to the 480-character contract limit; 320px reflow must not create page-level horizontal scrolling.
- Reduced motion removes spinner rotation and Companion character motion while leaving explicit loading text visible.

## Stitch evidence

- Project: `projects/1256373820415012052` — **MB-637 — Support Plan v3 UX Prototype**.
- Desktop screen: `3ce7442c03c54dc6be56bc0a842241ce`.
- Mobile screen: `438607cef71a4f7aa2fd62b7a07f2b5a`.
- Exported HTML/PNG files in this directory are layout and interaction evidence. Their sample AI sentence is illustrative only; production renders only the Care response bound to the exact requested action.

## Verification matrix

| State | Desktop | Mobile/tablet | Accessibility |
| --- | --- | --- | --- |
| Eligible | source-adjacent trigger | source trigger + in-flow tray | explicit button; focus alone makes no request |
| Loading | anchored loading copy | tray loading copy | text equivalent; source CTA stays usable |
| Ready/template | anchored bubble | tray response | polite announcement only for the requested response and only when unmuted |
| Failure | anchored neutral recovery copy | tray neutral recovery copy | no fabricated explanation; original action remains |
| Dismissed | bubble removed | tray response removed | focus restored to trigger |
| Reduced motion | static state | static state | no rotating/pulsing dependency |
