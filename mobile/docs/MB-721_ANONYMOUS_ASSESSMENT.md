# MB-721 anonymous mobile assessment

## Delivered scope

- Public Expo Router destination `/assessment/anonymous`, reachable from the
  unauthenticated welcome screen without sign-in.
- Guest selection between the current published PHQ-9 and GAD-7 definitions,
  the current Care-owned privacy disclosure, and explicit acknowledgement before
  a server session is created.
- One-question-at-a-time answers retained only in React component memory. The
  client sends the published definition ID and raw answers only after the guest
  explicitly submits; it never calculates a score or diagnosis.
- Frozen Care endpoints only:
  - `POST /api/v1/anonymous-assessment-sessions`
  - `POST /api/v1/anonymous-assessment-sessions/{sessionId}/assessments`
  - `GET /api/v1/anonymous-assessment-sessions/{sessionId}/assessments/{assessmentId}`
  - current questionnaire and privacy-disclosure reads
- `X-Anonymous-Session-Token` remains volatile and is sent only to the two
  session-owned assessment operations. It is never stored, logged, substituted
  for a bearer token, or silently attached to an account.
- The result comes from the follow-up server read and stays bounded to the
  anonymous session. An invalid, missing, or expired session clears the token,
  raw answers, assessment ID, and displayed result before offering a fresh start.
- The result explains the non-diagnostic boundary, no history/specialist sharing
  or automatic account import, and shows an independent urgent-support boundary
  when the server reports `POSITIVE_SAFETY_SCREEN`.

## Design evidence

- A Stitch-first brief, generated-reference audit, local interactive prototype,
  three full-frame visual captures, and prototype QA were completed before the
  production implementation. Per the repository overlap rule, these `.stitch/`
  working artifacts are retained locally and excluded from the PR.
- Generated Stitch reference:
  `projects/10509806209320093143/screens/50a306b9f188412b8034acf395f3abdc`.
  Its screenshot and HTML were retrieved and visually inspected.
- Production retains the reference hierarchy, selector, full-width response
  controls, tonal result cards, and explicit expiry recovery. It intentionally
  rejects generated public chrome, cookie/browser-close promises, 15-minute
  expiry, client-side scoring language, and generic advice presented as a
  server-derived result.

## Automated verification

Run from `mobile/` on 2026-10-23. Final full-suite results are recorded before
the implementation commit is pushed.

| Command                                                        | Result                         |
| -------------------------------------------------------------- | ------------------------------ |
| Local Stitch prototype state/boundary QA                       | PASS                           |
| Focused anonymous API, component, and welcome navigation tests | PASS — 3 suites, 7 tests       |
| `npm run typecheck`                                            | PASS                           |
| `npm run lint`                                                 | PASS                           |
| Prettier check for every MB-721 changed text file              | PASS                           |
| `npm run test:ci`                                              | BASELINE FAILURE¹              |
| `npm run build:bundle`                                         | PASS — Android and iOS exports |

¹ The complete run passed 95/96 suites and 827/828 tests. The sole failure is
`src/support-plan-companion/SupportPlanCompanion.test.tsx` → “invalidates a
pending request during dirty or confirmation interruption and ignores a late
error”. It fails identically when run alone, and MB-721 has no diff in the
companion implementation or test. The focused MB-721 suites, lint, typecheck,
and both platform bundles remain green; this unrelated baseline is not modified
or claimed as passing by this ticket.

## Deferred evidence

- `mobile/.maestro/mb-721-anonymous-assessment.yaml` is authored and marked
  `NOT_RUN`. Android device/staging execution remains gated by MB-666 as required
  by Jira; no device result is claimed.
- Docker walkthrough, merge commit, `ui-ready` label, and post-merge acceptance
  belong to the feature owner after integration. This implementation PR remains
  unmerged for review.
