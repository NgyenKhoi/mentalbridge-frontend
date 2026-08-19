# MentalBridge frontend agent rules

These rules apply to the whole frontend repository. The more specific
`mentalbridge/AGENTS.md` adds the Next.js-generated rules for the application.

## Required reading order

Before changing application code, read:

1. This file.
2. `mentalbridge/AGENTS.md`.
3. `mentalbridge/docs/README.md` and the task-relevant documents it links.
4. The relevant installed Next.js 16 guide under
   `mentalbridge/node_modules/next/dist/docs/`.
5. The backend OpenAPI contract for every API boundary being changed.

Do not rely on remembered Next.js behavior when the installed documentation is
available. If dependencies are not installed, state that the local guide could
not be checked before making a version-sensitive change.

## Ownership and boundaries

- The backend owns credentials, account state, roles, token issuance,
  verification, and authorization decisions.
- The frontend owns presentation, navigation, form state, same-origin BFF
  endpoints, and browser-safe session behavior.
- Treat backend OpenAPI as the source of truth. Do not invent request fields,
  response fields, roles, or endpoint behavior in UI code.
- Never add a frontend database, Prisma, NextAuth, or a second identity store.
- Never expose access tokens, refresh tokens, service URLs, or secrets through
  `NEXT_PUBLIC_*`, client props, browser storage, logs, or error messages.
- Public registration may create only backend-approved public account types.
  `ADMIN` is privileged and must be provisioned through a protected backend
  workflow. An admin UI route does not grant an admin role.

The approved Identity integration is documented in
`mentalbridge/docs/frontend-architecture.md`.

## Next.js and code rules

- Pages and layouts are Server Components by default. Add `"use client"` only
  to the smallest interactive boundary that needs it.
- Keep route files thin. Put feature behavior in `features/<feature>` and
  reusable visual primitives in `components/ui`.
- Mark modules that contain secrets or privileged server calls with
  `server-only` once that dependency is introduced.
- Route Handlers are public API surfaces. Validate input and authorization at
  the handler and again close to protected data operations.
- Proxy checks are optimistic navigation checks, never the only authorization
  control.
- Use strict TypeScript. Avoid `any`, unchecked type assertions, silent catches,
  and duplicated backend contract types.
- Preserve the existing CSS-variable design system. Do not introduce a second
  styling framework without an approved architecture change.

## Safe collaboration

- Inspect `git status` before and after work. Existing changes belong to the
  user; do not overwrite, revert, reformat, stage, or include them by accident.
- Do not create/switch branches, stage, commit, push, force-push, rewrite
  history, or open/modify Jira or pull requests without explicit user
  authorization for that action.
- Never commit `.env*` files other than the reviewed `.env.example`, credentials,
  tokens, private keys, generated build output, or local caches.
- Keep changes scoped to one Jira story. Call out unavoidable cross-story work
  before doing it.
- Use Conventional Commits and the branch/PR conventions in `CONTRIBUTING.md`
  when the user authorizes Git writes.

## Verification and delivery

- Run the smallest relevant checks while developing and the story's complete
  quality gate before handoff. At minimum, documentation-only changes require
  link/content review plus `npm run lint` and a non-emitting TypeScript check.
- Do not claim a check passed unless it was run in the current worktree. Report
  skipped or blocked checks with the reason.
- Review the final diff for secrets, unrelated files, generated output,
  accessibility regressions, contract drift, and accidental browser exposure.
- A handoff must name the Jira story, summarize changed behavior/files, list
  verification results, and identify remaining risks or follow-up stories.
