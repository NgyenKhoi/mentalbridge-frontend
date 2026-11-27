# MB-722 — Persistent mobile crisis support

## Delivered behavior

The mobile root renders one reusable crisis-support action above every public,
USER and SPECIALIST route. The same action remains available while the app is
restoring a session or when account restoration is unavailable.

Opening the action shows the reviewed, bundled
`mb-crisis-support-vi-vn-v1` release without an API, authentication, package,
location or network dependency:

- `112` — `Tổng đài khẩn cấp quốc gia`, with `24/7` applying only to this
  government service;
- `115` — `Cấp cứu y tế`, with no availability claim.

Each native phone handoff requires a deliberate press. A rejected or unavailable
dialer leaves the number visible with a recoverable message. Closing the sheet
invalidates an outstanding handoff result so an old error cannot appear after a
later reopen. The screen does not claim that MentalBridge provides emergency
response.

## Ownership and contract boundary

- UI owner: `mobile/src/crisis-support/`.
- Global placement: `mobile/src/app/_layout.tsx`.
- Content authority: backend ADR 0024, reviewed release
  `mb-crisis-support-vi-vn-v1`, reviewed 2026-09-25.
- No backend, OpenAPI, persistence, account, entitlement or location contract is
  changed.
- No new dependency is introduced; the existing Expo Linking API opens only the
  selected `tel:` URI.

## State coverage

| State                                    | Evidence                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Public, USER and SPECIALIST route stacks | Root integration test verifies the trigger stays outside the protected stacks.                                                 |
| Session restoration                      | Root integration test renders the restoring screen and global trigger together.                                                |
| Account/backend unavailable              | Root integration test renders retry state and global trigger together.                                                         |
| Sheet open                               | Component test verifies approved copy, ordering and 112-only `24/7`.                                                           |
| Deliberate call                          | Parameterized component test verifies only `tel:112` or `tel:115` is handed to the OS after pressing the corresponding action. |
| Dialer unavailable                       | Component test verifies a recoverable error while the selected number remains visible.                                         |
| Dismiss/reopen and late failure          | Component tests verify error reset and invalidation of a late failure.                                                         |

## Design evidence

- Stitch project: `10509806209320093143` (`MentalBridge UI Redesign`).
- Design system: `8a18e52ae11e456889c382c58acd21d0`
  (`Clinical Calm & Precision`).
- Screen: `00b81adcfcfb4d6dacc1a327e82d49a2`.
- Story evidence is retained locally at
  `E:\mentalbridge-repo\.tmp\MB-722-stitch-local\mobile\.stitch\MB-722` and
  excluded from the pull request because repository PR policy prohibits
  `.stitch/` captures.
- The local full-frame prototype was rendered at 390 × 844 for the open and
  dialer-error states. Both captures were visually checked for Vietnamese
  rendering, hierarchy, touch sizing and horizontal overflow.
- Stitch HTML remains design evidence only. Production uses repository-owned
  React Native primitives, tokens and accessibility behavior.

## Verification record

Commands were run from `mobile/` unless otherwise stated.

| Command                                                                                                  | Result                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .stitch/MB-722/prototype-qa.mjs` (before local evidence exclusion)                                 | PASS — required content, interaction hooks, reduced motion and prohibited claims checked.                                                                                                                                                                                          |
| Edge headless render of `prototype.html#open` and `#error` at 390 × 844                                  | PASS — `prototype-open.png` and `prototype-error.png` reviewed.                                                                                                                                                                                                                    |
| `npm exec prettier -- --check <MB-722 files>`                                                            | PASS — all changed text files use the configured style.                                                                                                                                                                                                                            |
| `npm run lint`                                                                                           | PASS — zero warnings.                                                                                                                                                                                                                                                              |
| `npm run typecheck`                                                                                      | PASS.                                                                                                                                                                                                                                                                              |
| `npm test -- --runInBand src/crisis-support/CrisisSupportWidget.test.tsx src/app/RootNavigator.test.tsx` | PASS — 2 suites, 10 tests.                                                                                                                                                                                                                                                         |
| `npm run test:ci`                                                                                        | PASS — 98 suites, 839 tests. Existing non-failing React `act()` console warnings remain outside MB-722.                                                                                                                                                                            |
| `npm run build:bundle`                                                                                   | PASS — Android and iOS Expo exports completed.                                                                                                                                                                                                                                     |
| `node scripts/pr-overlap.mjs` (repository root)                                                          | PASS — no file overlaps another open PR into `dev`; root layout and its integration test are CODEOWNERS-controlled and require owner review.                                                                                                                                       |
| `npm run quality`                                                                                        | BASELINE BLOCKED before lint at full-tree `format:check`: 393 existing files from `origin/dev` are reported by Prettier. No unrelated baseline file was reformatted; all MB-722 files pass the focused check above. The remaining quality steps were run independently and passed. |

`mobile/.maestro/mb-722-global-crisis-support.yaml` is authored. Device
execution is `NOT_RUN` until the MB-666 staging/device milestone. Post-merge
runtime walkthrough and Docker evidence are also `NOT_RUN`; the feature owner
must execute them after integration before adding `ui-ready` or handing off to
MB-707.

## Merge order and remaining gate

This is one FE-MOBILE pull request with no backend dependency. It can merge into
`dev` after required CODEOWNERS review and CI pass. No automatic merge is
authorized.
