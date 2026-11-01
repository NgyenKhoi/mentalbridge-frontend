# Contributing to MentalBridge frontend

The Next.js application lives in `mentalbridge/`. Read the repository
`AGENTS.md`, the application `AGENTS.md`, and `mentalbridge/docs/README.md`
before making a change.

## Jira and scope

- Start from one assigned Jira story and link its key in the branch and pull
  request.
- A sub-task is a delivery checklist for its parent story, not a separate reason
  to mix unrelated work into the branch.
- Record acceptance criteria before implementation. Update Jira only when the
  project owner has authorized that external change.
- If a discovered requirement changes security, API ownership, dependencies, or
  the story estimate, stop and raise it rather than silently expanding scope.

## Branches and commits

Recommended branch names:

- `feat/MB-123-short-description`
- `fix/MB-123-short-description`
- `docs/MB-123-short-description`
- `chore/MB-123-short-description`

Use Conventional Commits and include the Jira key when available, for example:

```text
docs(MB-210): define frontend engineering foundation
```

Do not force-push shared branches. Do not stage unrelated files. Agents and
automation must not create branches, stage, commit, push, or change Jira/PR
state unless the user explicitly authorizes that operation.

## Pull requests

Keep the pull request limited to its Jira story. Complete the repository pull
request template, including:

- acceptance-criteria coverage;
- screenshots for visible UI changes;
- API/OpenAPI changes and compatibility impact;
- tests and commands actually run;
- security, accessibility, and environment review;
- remaining risks and follow-up work.

At least one reviewer should understand the affected feature. Identity/session
changes also require a reviewer to check cookie policy, role enforcement,
contract alignment, and browser/server boundaries.

## Conflict-safe delivery (MB-706)

Jira MB-706 holds the agreed rules; this is the working summary.

**Story.** One Story is one demonstrable use case with one accountable feature
owner across backend, web and mobile. It states the UC goal, BE/FE owners,
affected paths, contract, UX handoff, authored test files, execution status,
merge order and an acceptance-states table: state | what the
screen shows | what it must not show | business rule and policy link. The
feature owner and the UI fixer agree the table before coding; it is the input
for every developer's AI agent. Subtasks: `BE/CONTRACT` only when the backend
changes, `FE-WEB` or `FE-MOBILE`, and `UX-POLISH` only after `ui-ready`.

**One writer per file.**

- While a feature PR is open, only its owner commits that feature's files.
  Others review or prototype in Stitch without committing them.
- Files in `.github/CODEOWNERS` (shell, navigation, design system, generated
  contracts, dependencies, mobile routes/theme/providers) change only in a
  narrow prerequisite PR approved by the integrator. No repo-wide formatting in
  feature PRs.
- Logic bugs (`lib/`, `app/api`, hooks, backend) go to the feature owner in a
  separate PR. Bugs in a screen under polish are fixed by the UI fixer inside
  the polish PR and reviewed by the feature owner. Safety, payment and data-loss
  bugs: the feature owner hotfixes first and the UI fixer rebases.

**Before opening and before merging a PR.**

1. Rebase on `origin/dev` at least daily; a branch lives at most three days.
2. Run `node scripts/pr-overlap.mjs` from the repository root. It lists open
   PRs into `dev` that change the same files and the shared files you touch.
   Agree the merge order with those owners. CI posts the same report as a PR
   comment; it warns and never blocks.
3. `git diff origin/dev...HEAD --stat` shows only your paths: about 30 files or
   fewer excluding generated, web and mobile in separate PRs, no `.stitch/`
   captures, no workspace snapshot PRs.
4. Never resolve a conflict in someone else's file with whole-file ours/theirs;
   resolve it with them. For `*.generated.ts` and synced OpenAPI YAML, take `dev` and re-run
   `npm run contracts:sync` from your backend branch.

**Merge order.** Backend contract and owner API, then the compatible web or
mobile consumer, then UI polish on the latest `dev` after handoff, then the
milestone E2E batch. A consumer may be built against fixtures but does not merge
before its backend contract.

**Regression checks.**

- Before merge: required CI is green on the last rebase, and the affected local
  gates were re-run after that rebase.
- After merge: the feature owner walks every acceptance-table row on the Docker
  dev stack. When all pass, add the `ui-ready` label and name the handed-off
  files in a Jira comment. A bug report cites the failing row; a behaviour
  missing from the table is a table gap, fixed in the table before the code.
- If the PR touched shared files, also smoke-test sign-in, assessment to
  Support Guide to SupportPlan, booking and chat on Docker.

## Required checks

From `mentalbridge/`, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
```

This is the fast non-browser gate for feature pull requests into `dev`.
Material changes to an existing browser journey must update its Playwright test,
but ordinary feature delivery does not run Browser E2E unless the task requires
it.

Mobile changes in pull requests into `dev` do not run mandatory mobile cloud
checks. The required gate reports `NOT_RUN (staging milestone pending)` and
review remains source-based; developers should run relevant commands locally.
Mobile formatting, lint, TypeScript, Jest, JavaScript bundle export, Android
native plus Maestro journeys, and iOS native boot are required together at an
intentional staging milestone.

Promotion pull requests from `dev` to `staging` run `npm run ci:staging` after
installing Chromium. That release gate repeats the non-browser checks and then
runs the controlled Realtime browser tests plus the full fixture Playwright
suite. It also runs `npm run quality` for mobile and the Android/iOS native boot
smokes. Live cross-stack E2E remains an explicit approved-environment command;
it is not part of either automatic gate.

## Review checklist

- No secret, token, cookie value, private URL, or personal data is exposed.
- Backend roles and payloads match the reviewed OpenAPI contract.
- Server Components remain the default and Client Components are narrowly
  scoped.
- Loading, empty, error, unauthorized, and dependency-unavailable states are
  handled where relevant.
- Keyboard use, labels, focus, contrast, and reduced motion are considered.
- The diff contains no unrelated formatting, generated output, or local files.
