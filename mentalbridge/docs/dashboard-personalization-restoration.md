# Dashboard and onboarding restoration

Owner-requested changes, based on the supplied full-frame `/dashboard` screenshot.
The editable boundary is the USER account identity, restored tour, and the weekly
emotion panel. Existing navigation, layout, authentication and backend contracts
remain authoritative.

## Behavior and states

| Area    | State                                 | Behavior                                                                           |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Account | Loading                               | Loading label, no invented name or initials                                        |
| Account | Profile available                     | Care profile display name and initials in sidebar and header                       |
| Account | Profile missing                       | Invite the user to complete their profile through `/profile`                       |
| Account | Read unavailable                      | Explain the missing information; reload on window focus                            |
| Account | Profile saved                         | Immediately reflect the saved name; ignore older in-flight reads                   |
| Tour    | First dashboard visit on this browser | Restore the original six-step local tour                                           |
| Tour    | Completed or skipped                  | Remember only the UI outcome per account in local storage                          |
| Tour    | Replay                                | Account menu → Xem lại hướng dẫn; Next, Back and Skip remain available             |
| Tour    | Mobile or reduced motion              | Prepare the real sidebar, keep controls visible, restore sidebar and focus on exit |
| Week    | No check-in today                     | Show an invitation to record how the user feels                                    |
| Week    | Check-in saved or updated             | Show supportive copy for the saved emotion and factual seven-day counts            |
| Week    | Check-in deleted                      | Remove the earlier message and return to the invitation                            |
| Week    | Loading or unavailable                | Retain the existing loading and local retry behavior                               |

The tour was recovered from the pre-existing local worktree's onboarding feature
and uses its original Driver.js 1.10.2 dependency. The USER and SPECIALIST shells
mount separate six-step definitions and remember outcomes separately per account.
No tokens, journal text or health records are stored by the tour. The daily
message uses the saved emotion only, never the private note or a clinical
classification. The Journal link remains an optional next step.

## Verification scope

Focused component tests cover identity, empty/error states, a late-read race,
account-menu replay, check-in updates/deletion, and each emotion's message.
Restored tour tests cover storage isolation, keyboard navigation, focus and
background cleanup. Browser scenarios cover tour auto-start/replay/mobile and
the emotion-save journey, with screenshots at 1440, 1280, 768 and 375 pixels.
The shared account shell also warrants one full non-browser quality-gate run.

## Local results — 2026-11-02

- Focused Vitest: 5 files, 41 tests passed, covering the shell, account actions,
  weekly emotion messages, tour runtime and storage.
- Browser: all 3 restored tour scenarios passed; both dashboard-save scenarios
  passed after explicitly seeding a contract-valid profile and onboarding
  preferences for the existing synthetic fixture actors. Screenshots reviewed
  at 1440, 1280, 768 and 375 pixels; no horizontal overflow in those checks.
- Repository formatting, ESLint, `npm run typecheck`, API/realtime contract
  checks and Companion source budget passed. An initial typecheck encountered
  stale ignored `.next/dev/types` entries for a removed demo route; those were
  moved to an evidence backup, and typecheck then passed.
- Full unit suite: 329 files passed, 2 failed; 2603 tests passed, 2 failed. The
  unchanged AdminCredentialReviewSection test timed out during the suite and
  passed unchanged when rerun alone. The remaining unchanged MB-624 traceability
  test rejects WBS-090's outdated literal assertion binding to
  SupportPlanWorkspace.test.tsx. The complete quality gate is therefore not green.
- Production Webpack builds passed on Windows and in Docker. The default
  Turbopack Docker build failed in the Google font resolver; the ignored local
  Compose override builds the frontend using `next build --webpack`. Application
  build scripts and font definitions were preserved.
- The updated frontend container is healthy on port 3000. `/` and `/login`
  returned HTTP 200. Existing backend containers remain healthy.

Safe fixture screenshots and command logs are retained locally under
`D:/ĐỒ ÁN/code/data/dashboard-restoration-20261102/`.

## Subsequent UI delivery — 2026-11-03

- Widened the journal detail dialog with separate reading and AI-reflection areas.
- Reduced the saved-screening safety panel's visual size while preserving its text.
- Shared resource artwork between the dashboard and Resources, including three
  new WebP illustrations in `public/images` and reduced-motion-aware hover effects.
- Removed the duplicate Community sidebar entry; the header link remains.
- Moved availability creation into a responsive dialog so saved slots use the
  full content width. Publishing, validation and withdrawal retain their handlers.
- Connected the specialist tour to first dashboard entry and account-menu replay;
  it restores sidebar state and stores only the completed/skipped UI outcome.

Each UI update was built and served through the local Docker Webpack override.
Tests were not rerun for these later changes, following the owner's instruction.
The earlier results above are historical evidence, not a green gate for this PR.
