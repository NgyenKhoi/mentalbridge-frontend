# Frontend engineering guide

This directory is the source of truth for MentalBridge frontend engineering
decisions. Product/design documents describe intent; these documents describe
how the executable Next.js application is organized and delivered.

## Reading order

1. [Agent workflow](agent-workflow.md)
2. [Frontend architecture](frontend-architecture.md)
3. [Package structure](package-structure.md)
4. [API, query, contract, and test baseline](api-query-and-testing.md)
5. [Runtime and environment](runtime-and-environment.md)
6. [Review and testing](review-and-testing.md)

Repository-wide Git, Jira, and pull-request rules are in
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md). The current design language is
documented in [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

## Decision status

| Decision                                         | Status      | Delivery story |
| ------------------------------------------------ | ----------- | -------------- |
| Next.js App Router, server-first components      | Approved    | MB-210         |
| Feature-first package boundaries                 | Approved    | MB-210         |
| Identity-owned authentication and roles          | Approved    | MB-210         |
| Same-origin BFF with HttpOnly session cookies    | Implemented | MB-212         |
| Identity login and authoritative role workspaces | Implemented | MB-213         |
| Identity registration and email verification UI  | Implemented | MB-214         |
| Axios and TanStack Query client baseline         | Implemented | MB-211         |
| Unit/component/API mocking baseline              | Implemented | MB-211         |
| Playwright browser baseline                      | Implemented | MB-211         |
| Complete Identity integration scenarios          | Planned     | MB-216         |

When implementation and a document disagree, do not silently choose one. Check
the installed Next.js documentation and the backend OpenAPI contract, then
update the relevant decision and code in the same authorized story.
