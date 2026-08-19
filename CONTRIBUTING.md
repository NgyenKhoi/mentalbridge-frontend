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
npm run test:e2e
```

Install Chromium once with `npm run test:e2e:install`; browser tests require a
current production build. A check may be skipped only when the handoff/PR states
why and what evidence replaces it. Never weaken a gate merely to make a change
pass.

## Review checklist

- No secret, token, cookie value, private URL, or personal data is exposed.
- Backend roles and payloads match the reviewed OpenAPI contract.
- Server Components remain the default and Client Components are narrowly
  scoped.
- Loading, empty, error, unauthorized, and dependency-unavailable states are
  handled where relevant.
- Keyboard use, labels, focus, contrast, and reduced motion are considered.
- The diff contains no unrelated formatting, generated output, or local files.
