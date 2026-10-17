# MB-374 SupportPlan lifecycle evidence

## Implemented journey

The SupportPlan page exposes only transitions valid for the Care-returned
state. Pause, resume, complete, and discard each require a confirmation dialog;
cancel returns focus without issuing a request. Completion optionally accepts
one bounded, non-clinical reason code.

After an accepted command the page reloads the authoritative current/draft
plan and terminal history. Optimistic conflicts and dependency failures retain
the last complete plan while explaining that no local state was applied.
Completed, superseded, and discarded plans remain visible in a paginated
history, with detail loaded from Care rather than reconstructed in the browser.

## Boundaries

- The browser uses authenticated same-origin BFF routes only; provider bearer
  credentials remain server-side.
- Runtime validators fail closed on malformed lifecycle timestamps, reason
  codes, status combinations, history cursors, and detail payloads.
- The UI never infers a transition from assessment, SupportEvaluation, or AI
  output and does not describe completion as recovery.
- Mobile layout keeps all lifecycle actions, confirmation controls, and history
  available without horizontal overflow.

## Verification

```text
npm run quality
PASS: format, lint, typecheck, all contract checks, 72 test files / 354 tests,
and the 60-route production build

npx playwright test tests/e2e/support-plan.spec.ts --workers=1
PASS: 3 fixture browser scenarios, including the 390x844 MB-374 lifecycle,
reload, immutable history, cancellation, and valid-action journey
```

The pull-request Browser E2E job remains the authoritative full-suite Linux
result. No live deployed cross-stack claim is made by this document.
