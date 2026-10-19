# MB-652 adaptive SupportPlan review Companion evidence

## Delivered behavior

The bounded SupportPlan Companion can now explain an authoritative adaptive
replacement review after Care has returned it in the normal Adjust journey.
The response:

- keeps PHQ-9 and GAD-7 trends separate and never calculates a combined
  wellbeing, recovery, adherence, or treatment score;
- presents screening, aggregate Journal context, plan engagement,
  self-report, and activity reflection as separate dimensions;
- identifies contradictory signals without resolving them into a diagnosis or
  recommendation;
- describes repeated Care-coded barriers such as `NOT_ENOUGH_TIME` and only
  aggregate helpfulness facts, never raw Journal text or private reflection;
- exposes only the keep/change options admitted by Care's replacement-review
  outcome; and
- links back to the existing Adjust confirmation flow without applying or
  confirming a plan mutation.

The explanation is a deterministic presentation of the existing
`NativeSupportPlanReplacementReview`. MB-652 adds no provider request, backend
policy, persistence, REST route, or OpenAPI change. This keeps the authoritative
Adjust review usable when the optional AI dependency is unavailable and stays
inside the frontend-only lane recorded on the Jira story.

## Acceptance and regression coverage

| Scenario                                        | Evidence                                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contradictory screening and self-report signals | Mapper and panel tests preserve each source, show the contradiction notice, and reject combined-score language.                                                            |
| Sparse or unavailable evidence                  | Mapper tests render explicit insufficient/unavailable copy without inventing missing facts.                                                                                |
| Repeated barrier and helpful activity patterns  | Mapper tests cover repeated `NOT_ENOUGH_TIME` and aggregate helpfulness counts.                                                                                            |
| No better alternative                           | Mapper tests expose only the keep-current option.                                                                                                                          |
| Current plan no longer admissible               | Mapper tests remove the keep option and preserve the admitted proposed-plan/professional-support fact.                                                                     |
| Normal alternative review                       | Workspace integration passes the exact Care review into the Companion after the existing proposal and comparison flow.                                                     |
| AI/provider failure                             | Review explanation has no provider dependency; tests prove selecting it sends no contextual AI request.                                                                    |
| No autonomous mutation                          | Component and Playwright tests prove explanation/navigation sends no replace or status command. Confirmation remains in Adjust.                                            |
| Desktop and mobile accessibility                | Production browser evidence covers the dialog, no textbox, 375px no-overflow, and the inherited MB-653 focus/sheet behavior. The new navigation target has a 44px minimum. |

## UX and Stitch evidence

The written brief, generated full-frame references, exported interactive HTML,
PNG captures, and prototype QA are in `.stitch/MB-652/`.

- Stitch project: `1256373820415012052`
- Desktop screen: `9e45f9025c194ce095b4df9bc1ace155`
- Mobile screen: `2299f01ccfa84537988822c3e088fcad`

`node .stitch/MB-652/prototype-qa.mjs` passed desktop and mobile checks for
independent screening signals, contradiction and confirmation copy, absence of
raw-text inputs, 44px navigation contract, Adjust navigation, Vietnamese
replacement glyphs, and horizontal overflow. The generated references and the
production Playwright desktop/mobile captures were inspected at original
resolution. Production uses repository-native React and CSS rather than copied
Stitch markup.

## Verification

Verified on 2026-10-19 against the MB-652 worktree:

- Focused Vitest: 4 files / 88 tests passed.
- Full Vitest: 268 files / 1,651 tests passed.
- Formatting, ESLint, TypeScript, all generated/OpenAPI contract checks,
  realtime contract checks, and the Companion source budget passed.
- Companion budget: 60,491 raw bytes and 12,647 gzip bytes, below the existing
  100,000 / 20,000 byte limits, with no external animation runtime.
- Next.js 16.3.0 production build passed after allowing the existing Google
  Font downloads required by the application.
- Focused Playwright journey: 1 test passed in Chromium, covering the real
  proposal/review/Companion path plus desktop and 375px mobile states.

The test data and screenshots use synthetic identities and health-plan facts.
No bearer token, raw assessment answer, raw Journal entry, consultation content,
or external-provider payload is committed.

## Scope boundary

Care remains the sole authority for evidence composition, review outcome,
admissible plans, validation, and plan mutation. The Companion only explains
the returned review and navigates. MB-652 does not implement recovery scoring,
treatment advice, diagnosis, proactive coaching, or autonomous adaptation.
