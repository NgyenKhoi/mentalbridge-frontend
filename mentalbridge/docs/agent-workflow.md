# Agent workflow

This workflow applies to coding agents and human contributors using agent
assistance.

## Before implementation

1. Identify the single parent Jira story and its acceptance criteria.
2. Read the repository and application `AGENTS.md` files.
3. Read this guide, the task-relevant architecture guide, and the relevant
   installed Next.js 16 documentation under `node_modules/next/dist/docs/`.
4. Inspect `git status` and treat all pre-existing changes as user-owned.
5. For API work, inspect the versioned backend OpenAPI contract before defining
   types or behavior.
6. State material assumptions. Escalate choices that change security,
   ownership, dependencies, public URLs, or story scope.

## During implementation

- Keep route files thin and make the smallest change that completes the story.
- Preserve unrelated changes and avoid repository-wide formatting.
- Keep Server Components as the default; isolate browser behavior in leaf
  Client Components.
- Never put secrets or tokens in browser-readable state or output.
- Validate all Route Handler inputs. Treat handler URLs as public endpoints.
- Add or update evidence as behavior is implemented, not after the fact.
- Communicate progress and blockers without claiming unfinished work is done.

Agents may edit files needed by the requested story. They may not create or
switch branches, stage, commit, push, force-push, or modify external Jira/PR
state unless the user explicitly authorizes the specific operation.

## Verification and handoff

1. Run focused tests/checks for the changed behavior.
2. Run the complete current quality gate described in
   [review and testing](review-and-testing.md).
3. Inspect `git diff --check`, `git diff --stat`, and the actual diff.
4. Confirm no secret, generated output, user-owned change, or contract drift was
   introduced.
5. Report the parent Jira story, acceptance-criteria coverage, files/behavior
   changed, commands and results, skipped checks, and remaining risks.

“Done” means the story acceptance criteria are met and the handoff is
verifiable. A passing build alone is not completion.
