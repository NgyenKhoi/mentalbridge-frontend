# MentalBridge frontend next steps

The original static-HTML migration plan is complete and has been superseded by
the Sprint 1 frontend Identity epic. Jira is the delivery tracker; this file is
only a repository-level sequence overview.

## Sprint 1 sequence

1. **Story 210 — Define frontend engineering foundation**
   Architecture, agent workflow, package structure, runtime/environment policy,
   and collaboration rules.
2. **Story 211 — Establish frontend API, query, and test baseline — complete**
   Axios, TanStack Query, typed API/error boundaries, automated tests, and CI.
3. **Story 212 — Implement secure Identity BFF session foundation**
   Server-only Identity client, HttpOnly cookies, refresh coordination, BFF
   handlers, and protected-route checks.
4. **Story 213 — Integrate login and role-based frontend access**
   Replace mock login, load the current account, protect role workspaces, and
   implement logout/logout-all.
5. **Story 214 — Integrate registration and email verification UI**
   Align the form with the backend contract, verification delivery, retries,
   and public-role restrictions.
6. **Story 215 — Close Identity blockers for frontend integration**
   Reconcile the forward contract, development email delivery, public privileged
   registration protection, and readiness regression tests.
7. **Story 216 — Verify frontend Identity integration and delivery gates**
   Component, BFF integration, browser-flow, and final delivery review.

## Architectural constraints

- The backend Identity service owns accounts, roles, authentication, and session
  validity. Do not add NextAuth, Prisma, or a frontend database.
- The browser uses same-origin BFF routes; tokens stay in server-set HttpOnly
  cookies and never enter browser storage.
- Axios and TanStack Query are introduced by Story 211, not ad hoc by feature
  pages.
- `ADMIN` is not a public self-registration role. The admin workspace UI is
  implemented independently but must be protected by backend-confirmed role
  authorization before production use.

See [`docs/README.md`](docs/README.md) for the approved engineering decisions and
the imported Jira CSV for detailed acceptance criteria.
