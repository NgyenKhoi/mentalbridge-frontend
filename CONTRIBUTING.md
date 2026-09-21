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

Promotion pull requests from `dev` to `staging` run `npm run ci:staging` after
installing Chromium. That release gate repeats the non-browser checks and then
runs the controlled Realtime browser tests plus the full fixture Playwright
suite. Live cross-stack E2E remains an explicit approved-environment command;
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
