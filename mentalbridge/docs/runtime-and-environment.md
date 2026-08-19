# Runtime and environment

## Executable baseline

The installed application is the authority for exact package versions:

- Next.js `16.3.0` (App Router)
- React and React DOM `19.2.8`
- TypeScript `5.x`, strict mode
- Framer Motion `13.1.x`
- Axios `1.x` and TanStack Query `5.x`
- Vitest `3.x`, MSW `2.x`, and Playwright `1.x`
- npm with the committed `package-lock.json`
- Node.js `20.9.0` or newer, matching Next.js 16.3's engine requirement

Axios and TanStack Query provide the browser API/query baseline. NextAuth,
Prisma, Tailwind, and a frontend database are not part of the approved
architecture.

## Environment files

Copy `.env.example` to `.env.local` for local development:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` and every real `.env*` file stay untracked. Only `.env.example`,
with non-secret development placeholders, is committed.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `IDENTITY_API_BASE_URL` | Server only | Base URL used by the future Identity server client/BFF |

`IDENTITY_API_BASE_URL` must not be renamed to `NEXT_PUBLIC_*`. Browser requests
use same-origin `/api/identity/*`; they do not need the upstream service address.
Every new variable requires an `.env.example` entry, visibility/owner
documentation, startup validation when first consumed, and deployment setup.

`NEXT_PUBLIC_*` values are compiled into browser JavaScript at build time. Use
that prefix only for reviewed, intentionally public, non-secret configuration.

## Local commands

Run from this `mentalbridge/` directory:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The current UI can run without Identity while it
contains mock flows; integrated Identity behavior will require the server-only
URL to be reachable.

Quality and production commands:

```powershell
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run build
npm run start
```

Use `npm ci` in CI and clean validation environments. Do not edit
`package-lock.json` by hand. Dependency changes belong in their assigned story
and must update `package.json` and the lockfile together.
