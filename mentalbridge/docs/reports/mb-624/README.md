# MB-624 UC traceability rebaseline v1

This report rebaselines the project use-case catalogue against the backend and
frontend `dev` branches. It records current executable evidence and does not
treat the workbook status column, Jira status, a merged pull request, or a file
existence check as closure proof.

## Frozen inputs

| Input             | Frozen revision                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project catalogue | `Report3_Project Tracking.xlsx`, Git blob `3e88f90877d5453b82bef8cbf3e0dcb314c549c1`, SHA-256 `c3352511cc4d307cc8ed1832d36f3af00faa758d15073003ea1b17fe36d1c6b9` |
| Backend `dev`     | [`a1ddbfc6c33521a06fb277b0782a8205825752e5`](https://github.com/NgyenKhoi/mentalbridge-backend/tree/a1ddbfc6c33521a06fb277b0782a8205825752e5)                    |
| Frontend `dev`    | [`c4dfb6f88759576611896865c72b6182020ce5b0`](https://github.com/NgyenKhoi/mentalbridge-frontend/tree/c4dfb6f88759576611896865c72b6182020ce5b0)                   |
| Audit date        | 2026-10-16                                                                                                                                                       |

The catalogue workbook is the project source for the 162 WBS functions. The
accepted ADRs, policies, versioned contracts and code on the pinned revisions
govern current semantics when the old workbook wording conflicts with them.

## Denominator and result

The only denominator is the **162 atomic WBS rows** numbered 1 through 162.
The seven delivery rows `UC-01` through `UC-07` are aggregates and are reported
separately below. They are never added to the denominator.

An atomic row is `CLOSED` only when the pinned revisions contain:

1. an accepted authoritative contract or policy for the current semantics;
2. executable owner behavior evidence, normally service integration coverage;
3. web and mobile evidence for every applicable delivery channel, or a current
   explicit reason why that channel is not applicable.

`PARTIAL`, `GAP` and `SCOPE_RESOLVED` do not enter the numerator. Scope removal
must be supported by an accepted decision; it is not silently relabelled as a
passing test.

```text
closed percentage = count(closure_state == CLOSED) / 162 * 100
                  = 101 / 162 * 100
                  = 62.35%
```

| State            | Count | Meaning                                                                                                                 |
| ---------------- | ----: | ----------------------------------------------------------------------------------------------------------------------- |
| `CLOSED`         |   101 | Current contract, owner evidence and applicable channel evidence are present.                                           |
| `PARTIAL`        |    30 | Some authoritative behavior exists, but a required channel, surface, contract or approved environment proof is missing. |
| `GAP`            |    14 | No complete authoritative runtime/contract evidence exists on the pinned `dev` revisions.                               |
| `SCOPE_RESOLVED` |    17 | An accepted decision replaced or removed the old source behavior; these rows are explained but are not counted closed.  |

The row-level source is [`uc-traceability-v1.csv`](uc-traceability-v1.csv). The
machine-readable revisions, formula inputs and counts are in
[`manifest-v1.json`](manifest-v1.json). The repository test verifies the row
set, formula, status counts, evidence vocabulary and channel rules; that test
protects report integrity and is not product-behavior evidence.

## Aggregate catalogue rows

| Aggregate row                                | Atomic coverage                    | Rebaseline result                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 Authentication & User Management       | WBS 1–14, 111, 113–116             | Partial: current auth/profile/consent/admin-account flows exist; cross-owner personal deletion remains a gap.                                                                   |
| UC-02 Mental Health Assessment & AI Analysis | WBS 15–30, 98–101, 150–156         | Partial: screening, journal and exact-revision analysis are delivered; assessment deletion and general dataset/admin benchmark lifecycle remain open.                           |
| UC-03 Intervention & Support                 | WBS 31–35, 89–97, 130–139          | Partial: Support Guide, SupportPlan, resources and notifications are delivered; reviewed safety-directory administration lacks a web surface.                                   |
| UC-04 Specialist Discovery & Appointment     | WBS 36–73, 83–88, 117–129, 148–149 | Partial: discovery, appointment, evidence-backed completion and bounded rating are delivered; commercial/admin and mobile channel gaps remain.                                  |
| UC-05 Communication & Follow-up              | WBS 74–101, 145–147                | Partial: appointment chat and follow-up journeys exist; message deletion/reporting and admin moderation remain open.                                                            |
| UC-06 Specialist Portal                      | WBS 52–61, 102–110                 | Partial: profile, availability, dashboard, continuity and earnings exist on web; several specialist mobile surfaces are absent.                                                 |
| UC-07 Administration                         | WBS 111–162                        | Partial: account/specialist/content/appointment/reporting operations exist; audit search, retention administration, dataset administration and several admin views remain open. |

## Evidence classification

| Classification        | What this audit accepts                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `fixture`             | Unit, component, BFF or contract behavior executed with controlled data.                                                |
| `fixture-browser`     | Browser behavior through the production web build and a synthetic fixture service.                                      |
| `service-integration` | Owning service behavior executed across its real application and persistence boundary or migrated integration database. |
| `sandbox`             | Explicit fake or provider sandbox evidence; never represented as production settlement or live delivery.                |
| `live-cross-stack`    | Approved deployed client-to-owner stack with controlled accounts and retained exact-head evidence.                      |
| `none`                | No executable evidence qualifying for this row on the pinned revisions.                                                 |

This audit claims **no `live-cross-stack` evidence**. Protected Android jobs
that were skipped or not authorized remain unverified and do not increase the
numerator.

## Corrected stale N/A and source descriptions

- WBS 12–13 no longer mean generic access to assessment, trend or raw journal
  data. Current scope uses an owner-approved, appointment-purpose
  ConsultationBrief and separate reuse consent.
- WBS 30 cannot be closed as a global clinical risk classification. Current
  behavior is domain-specific screening meaning plus an independent safety
  flag.
- WBS 31 maps to an all-tier Support Guide and an eligible paid SupportPlan,
  rather than an undefined generated intervention plan.
- WBS 49 remains a gap: the accepted billing ADR defines cancellation, while
  the pinned Consultation OpenAPI has no cancellation command.
- WBS 54 is removed by the accepted specialist policy. MentalBridge does not
  collect or verify specialist credential files.
- WBS 72 requires authoritative chat/video evidence. A timer-only
  `SESSION_ENDED` state is not completion.
- WBS 83–88 and 140–144 are narrowed to one editable 1–5 rating. Free-form
  review comments, public review lists/details and comment moderation are not
  current product behavior.
- WBS 105–107 do not authorize raw assessment history, emotion trends or
  journals for a Specialist. Only the approved appointment-purpose brief is
  available.
- WBS 129 is specialist-initiated and provider-settled. Admin observation does
  not grant an arbitrary settlement command.
- WBS 135–139 refer to reviewed safety-directory entries, not an ungoverned
  hotline CRUD catalogue. The owner API exists; the required admin web surface
  does not.

## Open gaps and recommendation order

Issue-ready descriptions are versioned in
[`jira-gap-issue-drafts-v1.json`](jira-gap-issue-drafts-v1.json). Their proposed
links are deliberately not presented as real Jira keys. They must be created
and linked to MB-624 before this audit can be marked complete.

1. **P0 privacy lifecycle:** WBS 14 and 24 need accepted deletion contracts,
   owner coordination and executable replay/retention evidence. WBS 159–162
   need bounded audit search/filter and owner-specific retention administration.
2. **P0 communication safety:** WBS 80, 82 and 145–147 need message tombstone,
   scoped report and audited moderation contracts plus web/admin coverage.
3. **P1 commercial consistency:** WBS 49 and 123–124 need cancellation and
   admin subscription authority; WBS 42–51 need the applicable mobile channel.
4. **P1 reviewed safety operations:** WBS 135–139 need an authorized admin web
   workflow over the existing reviewed safety-directory owner API.
5. **P2 governed evaluation:** WBS 28–29 and 150–156 need licensed dataset
   governance, admin contracts/UI and an explicitly approved benchmark run.
6. **P2 specialist/mobile parity:** WBS 98, 102 and 108–110 need the applicable
   mobile dashboard and financial-history surfaces or an accepted channel-scope
   amendment.

## Jira handling

Jira links in the matrix are traceability references only. A Jira `Done` state
never closes a row without current contract and executable evidence. Live Jira
status was not available to the repository audit, so the matrix explicitly
marks it for confirmation instead of inventing a state. MB-624 itself was
reported as `In Progress` by the review on 2026-10-16.
