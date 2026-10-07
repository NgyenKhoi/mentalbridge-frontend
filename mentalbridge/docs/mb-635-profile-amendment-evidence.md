# MB-635 — Reviewed amendments to approved specialist profiles

## Scope and authority

Delivery story: [MB-635](https://vunguyenkhoi47.atlassian.net/browse/MB-635).
Owner contract: `mentalbridge-backend/contracts/openapi/consultation-service-v1.yaml`
1.11.0. Business authority: backend ADR
`0033-reviewed-specialist-profile-amendment.md`
(`MB-SPECIALIST-PROFILE-AMENDMENT-001`) and consultation policy v2.

The project maintains [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) and
[`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md) instead of a root `DESIGN.md`.
They remain the design/interaction source; this feature does not establish a
second palette, token system, global UX contract or component library.
Frontend Design Premium informs separation of public/proposed content,
explicit saved-version submission, associated field errors, recovery and
keyboard/mobile behavior. Backend uses the scoped Lean workflow.

## User flow

- Initial submission remains on the existing profile endpoints.
- An approved specialist opens their public snapshot and starts/resumes a
  separate private amendment. No new amendment is started just by visiting.
- All six fields are editable. Save persists the private draft; explicit
  submit/resubmit sends the saved amendment version. Unsaved fields cannot be
  silently skipped by pressing Submit.
- Saving changes to a pending amendment withdraws it to draft, after an
  app-owned confirmation; rejection keeps the feedback visible for correction.
- Public content, existing appointments and availability remain unchanged
  before promotion. Suspension continues blocking edits/review independently.
- Admin has a distinct “Cập nhật hồ sơ” queue, bounded paging, all-six-field
  before/after comparison, and the three existing rejection reasons.
- Approve publishes atomically; reject preserves the public snapshot exactly.
  Stale or uncertain decisions block blind retry and offer authoritative reload.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | `features/specialist-profile/components/ProfileFields.tsx` | Provider six-field input contract; `ProfileFields.module.css` | Initial profile, private amendment; noValidate, inline first-error focus, native checkbox tiles and bounded experience stepper | Profile workspace, fields and amendment component tests |
| Dialog | `components/ui/Dialog.tsx` | Existing modal/focus contract | Published-profile preview and shared unsaved/pending-save confirmations | Amendment component tests; Chromium Escape/focus and native modal inspection |
| Select/Listbox | `components/LightSelect.tsx` | Existing authored control | Authored three-reason amendment review; legacy initial review keeps native platform popup | Admin amendment component test; open-popup browser inspection |
| Toast | `components/ui/FeedbackProvider.tsx` | DESIGN_SYSTEM section 3 | Success toast plus persistent inline recovery | Existing provider tests; amendment component tests |
| CRUD | Profile/amendment workspaces and BFF | Owner ADR 0033 and OpenAPI | Reviewed create/read/update/submit/approve/reject; no delete/discard API invented | BFF, validation, component and provider integration tests |
| Scrollbar | `app/globals.css` | Existing global runtime tokens | Natural document scrolling; no new fixed-height form scroller | Responsive/zoom browser inspection |

Admin queue paging and review selection remain transient within the existing
admin section-switching architecture. They are not written to browser storage
or URLs; leaving the queue revalidates on return. Private profile drafts are
server-persisted, not placed in localStorage. In-app link navigation and browser
close warn while typed changes are dirty.

## Verification

- Focused profile frontend: `npx vitest run features/specialist-profile
  --reporter=dot` — 22 tests / five files passed.
- Full frontend quality: `npm run quality` — 184 files / 869 tests passed;
  format, lint, typecheck and contract checks passed; Next.js production build
  and standalone preparation passed (111 static routes).
  The final CSS-only mobile input specificity adjustment was followed by
  another successful production build and Chromium inspection.
- Provider: consultation `mvnw.cmd package` — 159 tests passed, zero failures,
  zero errors; executable package produced. Includes fresh Liquibase startup,
  upgrade from migrations 001–017 with approved/suspended/pending/rejected
  fixtures, original approval provenance, closed reasons, true concurrent
  review/edit, and unchanged existing appointment state.
- Browser release tests maintained in `tests/e2e/profile-amendments.spec.ts`;
  the release E2E suite is not executed during ordinary dev delivery, per the
  repository workflow. Local visual/interaction inspection uses synthetic
  browser fixtures, not shared-environment accounts.
- Strict Premium static audit is feature-scoped and recorded in local reports.
  Two checks need manual resolution: its fixed `DESIGN.md` filename cannot
  resolve the maintained equivalent documents above; its literal-textarea
  scanner cannot read JSX `style={{ resize: 'none' }}`. The canonical map has
  no unresolved owners, and Chromium confirms the actual textarea is
  `resize: none`. The command exits 1 for those reported findings; it is not
  described as an all-green static audit.

## User-provided specialist profile prototype

The attached HTML is the visual/interaction reference for this profile refresh,
not an API or approval-policy source. The initial and approved-profile paths now
share `ProfilePage.module.css`, `ProfilePresentation.tsx`, `ProfileFields.tsx`,
six-field validation/payload helpers and an unsaved-draft navigation guard.
The existing project CSS tokens and font remain authoritative.

The prototype's full-width action header, lanyard identity card, grouped form,
notebook-style bio editor, choice tiles, experience stepper, live preview and
completion checklist are implemented. The bio toolbar inserts actual plain-text
paragraphs/lists and offers expansion; it does not claim rich-text support.
Zero experience is valid. Timezone is retained as the required sixth API field.
Save sends exactly the six contract fields and the authoritative version.

Public and private preview modes are explicit. The header dialog reads only the
approved public snapshot, never the unsaved draft. If an authoritative refresh
reports suspension, public labels and editing permissions change accordingly.
The initial path also blocks unsaved submission and does not replace an
unavailable existing profile with a writable blank form.

No new qualifications, ratings, session counts, avatar upload or unsupported
support areas are invented. The booking sample in the preview is labelled as
non-interactive. The checklist measures field completeness, not credentials.
Shared sidebar navigation and actual identity remain intact; profile-only shell
styling owns the full-width header and mobile menu transform behavior.

## UI inspection

Local synthetic Chromium inspection covers public/draft/pending/conflict and
admin comparison and empty queue at 1440×900, 1280×800, 768×900 and 375px.
The final 11-screenshot inspection passed. It verifies no
horizontal document overflow, keyboard opening/navigation/Escape and trigger
focus restoration for the shared rejection dropdown, matching popup width,
reduced motion, and textarea resize behavior. 640×400 exercises the reflow
width equivalent of 200% at 1280×800, not a claim of OS/browser zoom coverage.
Screenshots are kept outside Git under `D:/mentalbridge/local-reports/mb635-*.png`.

The prototype refresh is additionally inspected at 1920, 1440, 1280, 970, 768
and 375px, plus 640×400 reflow. Its local inspection script is
`D:/mentalbridge/local-reports/mb635-profile-prototype-inspection.cjs` and uses
the standalone production build with synthetic API fixtures. It covers the
completed dashboard sibling, published/draft/pending/rejected/suspended/empty
profiles, long bio, public-preview modal, failed read recovery, version conflict,
exact six-field payload/ETag, keyboard choices, mobile navigation and overflow.
The final run has 19 full-page screenshots and two mobile viewport shots,
including a delayed-read loading state with writes disabled.
No live/shared account data or database mutations are used for these screenshots.

Browser inspection also identified the legacy role shell's important control
overrides and Motion's retained mobile sidebar transform. Profile-owned variants
now retain the notebook background/28px ruling, 16px mobile inputs, an 88px
mobile identity avatar, readable invalid-field borders and a fully closed menu.
The header reaches the available main-area edge at 1920px while the body retains
a readable maximum width. Other specialist sections are not restyled.

Inspection found and corrected the existing global workspace button override
by adopting the canonical `btn-primary` class. The existing admin shell's
900px cap is relaxed only for the specialists section; other admin sections
are unchanged. The scrollbar color baseline uses existing global tokens,
without opt-in scrollbar classes or a second palette.
The enabled submit button has white foreground over the existing teal gradient;
its transparent `background-color` is not a missing background because
`background-image` supplies the canonical gradient.

## Rollout and remaining release work

Backend migration 018 is additive. It captures a baseline for existing approved
and suspended profiles and preserves available approval provenance; it cannot
reconstruct unavailable historical content. Owner tests use disposable
PostgreSQL, never shared dev/staging. Apply the migration before the updated
consultation owner starts; drain old owner instances before enabling amendment
writes because old code does not append approved-version history.

No Git publication, Jira transition, shared-database migration or Docker
deployment was performed at the original implementation checkpoint.

## Publication preparation

The owner subsequently authorized publication to `dev`, waiting for green CI,
merge and Docker rebuild. The publication worktree is based on `f588c2f`, the
latest fetched `origin/dev`, integrating the seven MB-593 analytics commits
missing from the original `a801a43` workspace. The scoped feature patch applied
cleanly; shared contract/client validation is rerun on the integrated baseline.
The Consultation snapshot exactly matches the paired owner contract (SHA256).

The original workspace's AGENTS/docs changes, deleted mentalbridge-ui skill
files and unrelated unused legacy profile stylesheet are not included or
reverted. No mentalbridge-ui skill is used. Local publication checks are
separate from GitHub CI and deployed-account verification.

Two reviewed synthetic browser screenshots are included for PR review:

- [Desktop draft, 1440px](evidence/mb-635/profile-desktop.png).
- [Mobile draft viewport, 375px](evidence/mb-635/profile-mobile.png).

They come from the production-build prototype inspection described above,
contain only synthetic actors and demonstrate the private/public distinction.
