# MentalBridge web application

MentalBridge is a Next.js App Router frontend for mental-health support
experiences. The repository contains implemented UI screens, a same-origin
Identity BFF, role-based login/workspace access, public registration, email
verification, and controlled Identity delivery evidence through Story 216.

## Review 1 container

The production image uses Next.js standalone output and keeps every upstream service URL server-only. Build it directly from this directory:

```powershell
docker build --tag mentalbridge/frontend:review1 .
```

The backend repository owns the Review 1 Compose topology. With both repositories checked out as sibling directories, run `docker compose --profile demo up --build -d` from the backend repository to start Frontend together with Identity, Care, Content/Notification, and explicit migrations against the shared dev/staging cloud databases. The `full-test` profile adds the Realtime foundation, shared cloud MongoDB, and local ephemeral Redis.

Only port `3000` needs to be user-facing. `IDENTITY_API_BASE_URL`, `CARE_API_BASE_URL`, and `CONTENT_SERVICE_URL` are read by the Next.js server at runtime and must point to Compose service names inside the stack; they must never use a `NEXT_PUBLIC_` prefix.

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

### Sprint 2 Playwright journeys

The E2E command starts a deterministic local Identity/Care/Content fixture and a
production-mode Next.js server automatically. Install Chromium once, then run
all journeys or the focused Care journeys:

```powershell
npm run test:e2e:install
npm run test:e2e
npm run test:e2e -- tests/e2e/care-assessment.spec.ts
```

The fixture uses synthetic identities, profiles, consent decisions, PHQ-9
answers, and reviewed resources only. It never connects to production services.
On a failed E2E test, the Playwright result retains a
`correlation-evidence.json` attachment containing only bounded
`X-Correlation-Id` values; cookies, bearer tokens, request bodies, and response
content are not attached.

The only documented environment variable is server-only:

```text
IDENTITY_API_BASE_URL=http://localhost:8080
```

It is reserved for the Identity BFF/server client implemented in Story 212. Do
not expose the upstream URL or session material with `NEXT_PUBLIC_*`.

## Current routes

| Area            | Routes                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public          | `/`, `/login`, `/register`, `/verify-email`, `/reset-password`, `/privacy`, `/terms`                                                                              |
| Assessment      | `/assessment/anonymous`, `/assessment/[type]`                                                                                                                     |
| User dashboard  | `/dashboard`, `/journal`, `/assessments`, `/specialists`, `/appointments`, `/messages`, `/resources`, `/analytics`, `/subscription`, `/profile`, `/notifications` |
| Role workspaces | `/specialist/*`, `/admin/*`                                                                                                                                       |

Identity login and these protected route trees now use the backend current
account as the role source of truth. A visible link or manually entered URL does
not grant a role; privileged operations must repeat backend-confirmed
authorization close to the operation.

Registration accepts only `USER` and `SPECIALIST`, uses a per-submission
idempotency key, and enters a verification-pending state after Identity accepts
the request. `/verify-email` consumes the one-time challenge through the BFF and
removes it from browser history. Resend and password recovery are explicitly
unavailable until their backend contracts are implemented.

`/resources` is public so an anonymous PHQ-9 journey can continue to reviewed
self-help material. It loads only published, reviewed entries through the
same-origin Content BFF and shows a neutral unavailable state instead of local
or production mock content when Content cannot confirm the catalogue.

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
- [`docs/identity-delivery-evidence.md`](docs/identity-delivery-evidence.md):
  MB-139 acceptance and verification evidence
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
