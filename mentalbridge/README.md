# MentalBridge web application

MentalBridge is a Next.js App Router frontend for mental-health support
experiences. The repository contains implemented UI screens, a same-origin
Identity BFF, and role-based login/workspace access. The remaining Identity
registration and delivery scenarios continue in Sprint 1 Stories 214–216.

## Runtime

- Next.js 16.3.0
- React / React DOM 19.2.8
- TypeScript 5 in strict mode
- Framer Motion 13.1.x
- CSS variables and route CSS today; new component styles use CSS Modules
- Node.js 20.9.0 or newer
- npm and the committed lockfile

Axios and TanStack Query provide the API/query layer. Vitest, React Testing
Library, MSW, and Playwright provide the automated test baseline. This frontend
does not use NextAuth, Prisma, or its own database; the backend Identity service
owns accounts, roles, authentication, and sessions.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Available commands:

```powershell
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
npm run test:e2e
npm run start
```

The only documented environment variable is server-only:

```text
IDENTITY_API_BASE_URL=http://localhost:8080
```

It is reserved for the Identity BFF/server client implemented in Story 212. Do
not expose the upstream URL or session material with `NEXT_PUBLIC_*`.

## Current routes

| Area | Routes |
| --- | --- |
| Public | `/`, `/login`, `/register`, `/reset-password`, `/privacy`, `/terms` |
| Assessment | `/assessment/anonymous`, `/assessment/[type]` |
| User dashboard | `/dashboard`, `/journal`, `/assessments`, `/specialists`, `/appointments`, `/messages`, `/resources`, `/analytics`, `/subscription`, `/profile`, `/notifications` |
| Role workspaces | `/specialist/*`, `/admin/*` |

Identity login and these protected route trees now use the backend current
account as the role source of truth. A visible link or manually entered URL does
not grant a role; privileged operations must repeat backend-confirmed
authorization close to the operation.

## Project guidance

- [`docs/README.md`](docs/README.md): engineering documentation index
- [`docs/frontend-architecture.md`](docs/frontend-architecture.md): server,
  browser, BFF, and Identity ownership
- [`docs/package-structure.md`](docs/package-structure.md): target package layout
  and incremental migration
- [`docs/api-query-and-testing.md`](docs/api-query-and-testing.md): Axios,
  TanStack Query, OpenAPI generation, and automated tests
- [`docs/runtime-and-environment.md`](docs/runtime-and-environment.md): versions,
  commands, and environment policy
- [`docs/review-and-testing.md`](docs/review-and-testing.md): delivery gates
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md): current visual language
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md): Git, Jira, PR, and review workflow

Read [`../AGENTS.md`](../AGENTS.md) and [`AGENTS.md`](AGENTS.md) before using a
coding agent in this repository. Next.js behavior must be checked against the
installed guides in `node_modules/next/dist/docs/`.

## Styling and migration

The existing screens use global route CSS and design tokens. New feature or
component styling should use colocated CSS Modules, while `app/globals.css`
remains limited to tokens/base/global rules. Existing pages migrate
incrementally when their Jira story touches them; do not rewrite completed UI or
change URLs solely to match the target folder diagram.

## Security status

The approved session design uses same-origin Next.js Route Handlers and
server-set HttpOnly cookies; tokens must never enter localStorage, sessionStorage,
client state, or browser-readable responses. Public registration must not create
`ADMIN`. See the architecture guide for the complete boundary and the Sprint 1
Jira stories for implementation status.

## Additional project artifacts

`BUILD_SUCCESS.md`, `IMPLEMENTATION_SUMMARY.md`, `MIGRATION_NOTES.md`,
`NEXT_STEPS.md`, `QUICKSTART.md`, and `SUMMARY.md` are historical UI delivery
notes. When they conflict with this README or `docs/`, the current executable
configuration and engineering guide take precedence.
