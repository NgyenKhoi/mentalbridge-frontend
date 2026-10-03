# Frontend engineering guide

This directory is the source of truth for MentalBridge frontend engineering
decisions. Product/design documents describe intent; these documents describe
how the executable Next.js application is organized and delivered.

All user-visible frontend work starts by loading the repository skill at
`.agents/skills/mentalbridge-ui/SKILL.md`; the tables below let that skill select
the smallest relevant contract set.

## Reading order

1. [Agent workflow](agent-workflow.md)
2. [Frontend architecture](frontend-architecture.md)
3. [Package structure](package-structure.md)
4. [API, query, contract, and test baseline](api-query-and-testing.md)
5. [Runtime and environment](runtime-and-environment.md)
6. [Review and testing](review-and-testing.md)
7. [Product experience contract](PRODUCT_EXPERIENCE.md) for UI/UX work
8. [MentalBridge UI Foundation](DESIGN_SYSTEM.md) for visual or motion work

## UI and motion routing

Do not read every UI document for every task. Start here, then choose the
smallest relevant set:

| Task                                                                              | Read                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implement or refactor a product page end to end                                   | [UI implementation playbook](UI_IMPLEMENTATION_PLAYBOOK.md), then [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md) and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)     |
| Product journey, page hierarchy, data visualization, or route-level UX            | [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md), then the owning page/component and tests                                                                      |
| Shared visual language, tokens, primitives, accessibility, or responsive behavior | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                                                                                                                          |
| Product-page loading, empty, error, list, dialog, or page-state motion            | [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md) and the motion contract in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                                                |
| Landing-page choreography, scroll sequences, parallax, or smooth scrolling        | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), current code in `components/motion`, `components/ScrollReveal.tsx`, `hooks/useLenis.ts`, and `lib/animations/config.ts` |
| Visual QA, screenshots, journey review, or delivery gates                         | [Review and testing](review-and-testing.md)                                                                                                                   |

`CLAUDE.md` is only a compatibility pointer to the applicable `AGENTS.md`; it
does not define a separate UI system. Current source code and shared tokens are
authoritative for implementation details. Story evidence records what a Jira
story delivered, but it does not override the current product-experience or
design-system contract.

Các prompt, changelog và báo cáo animation/UI cũ đã được gỡ khỏi working tree để
tránh tạo nguồn sự thật thứ hai. Khi cần điều tra lịch sử, dùng Git history;
không khôi phục chúng như coding standard hiện hành.

Story-specific delivery evidence:

- [MB-139 Identity integration and delivery gates](identity-delivery-evidence.md)
- [MB-177/MB-178/MB-205 Care-backed screening, profile, consent, history, and progress integration](care-assessment-integration.md)
- [MB-273 initial-check release evidence](initial-check-release-evidence.md)
- [Story 6201 Journal authoring and draft protection](journal-authoring-story-6201.md)
- [MB-368 exact-revision Journal AI reflection](mb-368-journal-ai-reflection.md)
- [MB-362 online specialist availability evidence](mb-362-specialist-availability-evidence.md)
- [MB-379 appointment decisions and expiry evidence](mb-379-appointment-decisions-evidence.md)
- [MB-380 appointment cancellation and reschedule evidence](mb-380-appointment-changes-evidence.md)
- [MB-609 standalone Community peer-support experience](mb-609-community-standalone-evidence.md)
- [MB-577 Community comments and one-level replies](mb-577-community-comments-evidence.md)
- [MB-578 Community reports, blocks, and moderation](mb-578-community-moderation-evidence.md)
- [MB-579 Community reactions and private bookmarks](mb-579-community-interactions-evidence.md)
- [MB-549 appointment reminder consumer evidence](evidence/mb-549-appointment-reminder-consumer.md)
- [Sprint 2 backend runbook and traceability](../../../mentalbridge-backend/docs/sprints/sprint-2-runbook-traceability.md)

Repository-wide Git, Jira, and pull-request rules are in
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md). Shared UI foundations are
summarized in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); use the routing table above
to select any additional task-specific material.

## Decision status

| Decision                                             | Status      | Delivery story |
| ---------------------------------------------------- | ----------- | -------------- |
| Next.js App Router, server-first components          | Approved    | MB-210         |
| Feature-first package boundaries                     | Approved    | MB-210         |
| Identity-owned authentication and roles              | Approved    | MB-210         |
| Same-origin BFF with HttpOnly session cookies        | Implemented | MB-212         |
| Identity login and authoritative role workspaces     | Implemented | MB-213         |
| Identity registration and email verification UI      | Implemented | MB-214         |
| Axios and TanStack Query client baseline             | Implemented | MB-211         |
| Unit/component/API mocking baseline                  | Implemented | MB-211         |
| Playwright browser baseline                          | Implemented | MB-211         |
| Complete Identity integration scenarios              | Implemented | MB-216/MB-139  |
| Care-backed anonymous and USER PHQ-9 screening       | Implemented | MB-177         |
| Care profile, privacy consent, history, reassessment | Implemented | MB-178         |
| Authenticated descriptive assessment progress        | Implemented | MB-205         |
| Reviewed resource retrieval and safe fallback        | Implemented | Sprint 2       |
| GAD-7 runtime and immutable questionnaire history    | Implemented | Story 1102     |
| Guided initial check and unified support result      | Implemented | MB-272         |
| Mood-aware Journal authoring and draft protection    | Implemented | Story 6201     |
| Explicit-consent, exact-revision Journal reflection  | Implemented | MB-368         |
| Exact 60-minute online specialist availability       | Implemented | MB-362         |
| Specialist appointment decisions and expiry          | Implemented | MB-379         |
| Approved online specialist discovery consumer        | Implemented | MB-363         |
| Appointment cancellation and linked reschedule       | Implemented | MB-380         |
| Owner-scoped factual personal analytics overview     | Implemented | MB-570         |
| Owner-scoped cross-feature activity dashboard        | Implemented | MB-571, MB-610 |
| Standalone pseudonymous peer-support Community       | Implemented | MB-609         |
| Community reports, blocks, and auditable moderation  | Implemented | MB-578         |
| Supportive Community reactions and private bookmarks | Implemented | MB-579         |

When implementation and a document disagree, do not silently choose one. Check
the installed Next.js documentation and the backend OpenAPI contract, then
update the relevant decision and code in the same authorized story.
