# MB-719 consultation notes demo removal

Task: [MB-719](https://vunguyenkhoi47.atlassian.net/browse/MB-719).
Branch: `chore/MB-719-remove-consultation-notes-demo`.
Frontend baseline: `53732d7`, fetched from `origin/dev` before implementation;
refreshed to `4bc3851` immediately before publication. That refresh changes only
nine mobile files; the web application and delivery tooling are identical.
Backend `dev` was also updated to `3cdbbd15`, including merged MB-718 PR #224.

## Design decision

The unused `/consultation-notes-demo` page saved fabricated notes only in React
state and made no API calls. No navigation, tests or other route depended on
its URL. Remove the filesystem page and its exclusive dependencies. A redirect
or replacement screen would preserve an unnecessary product entry point.

This is removal of an orphan demo, with no new screen composition, controls,
motion, backend contract or product workflow. The existing specialist summary
and user agreed-next-steps behavior remain the supported implementation.

## Affected paths

Deleted files, relative to `mentalbridge/`:

- `app/(dashboard)/consultation-notes-demo/page.tsx`
- `app/(dashboard)/consultation-notes-demo/page.css`
- `components/ConsultationNotesViewer.tsx`
- `components/ConsultationNotesViewer.css`

The four source files contain 777 deleted lines. The Viewer was imported only
by the removed demo; both CSS files were exclusive to that page/Viewer. The
removed components used inline SVGs and no separate image/public assets.

`ConsultationNotesModal.tsx` and its CSS remain because
`SpecialistAppointmentsManager.tsx` still uses them. The real
`features/appointments/components/SessionSummaryPanel.tsx`, its clients and
validation, and all consultation BFF routes remain unchanged, including:

- `app/api/consultation/specialist/appointments/[appointmentId]/session-summaries/route.ts`
- `app/api/consultation/appointments/[appointmentId]/session-summaries/route.ts`
- `app/api/consultation/agreed-next-steps/[nextStepId]/route.ts`
- `app/api/consultation/session-summaries/[summaryId]/reuse-consent/route.ts`

## Acceptance evidence

| Acceptance criterion                                 | Evidence                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Remove the demo and only exclusive assets/references | Four-file deletion; exact import/reference audit; no public assets to remove.                                                           |
| Preserve real summaries and agreed next steps        | No diff in appointment features, consultation BFF routes, shared Modal or specialist manager; existing summary/validation tests passed. |
| No navigation/tests depend on the demo URL           | Source search across app, components, features, lib, tests and scripts returns no demo URL or Viewer references.                        |

## Verification

Commands run from `mentalbridge/` unless specified otherwise:

The full web gate below ran on `53732d7`. After the mobile-only refresh to
`4bc3851`, lint, typecheck and the focused two-file summary suite were repeated
and passed (12 tests). The unchanged web application and delivery tooling were
verified with a Git tree diff; the full suite was not repeated for mobile-only
baseline changes.

| Command                                                                                                                                                                    | Result                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd ci --prefer-offline --cache D:/SEP490/mentalbridge-repo/.task-tools/npm-cache-mb692 --no-audit --no-fund`                                                         | Passed; 762 packages installed from the existing lockfile.                                                                          |
| `npm.cmd run test:unit -- --maxWorkers=2 --minWorkers=1 features/appointments/components/SessionSummaryPanel.test.tsx lib/consultation/session-summary-validation.test.ts` | Passed: 2 files, 12 tests covering summary publication/amendment, cancellation, validation, user next-step state and reuse consent. |
| `npm.cmd run format:check`                                                                                                                                                 | Passed.                                                                                                                             |
| `npm.cmd run lint`                                                                                                                                                         | Passed with zero warnings.                                                                                                          |
| `npm.cmd run typecheck`                                                                                                                                                    | Passed, including Next route type generation and non-emitting TypeScript compilation.                                               |
| `npm.cmd run contracts:check`                                                                                                                                              | Passed for Identity, Care, Content, Journal and Consultation.                                                                       |
| `npm.cmd run contract:check`                                                                                                                                               | Passed.                                                                                                                             |
| `npm.cmd run contract:provider-check`                                                                                                                                      | Passed against refreshed backend `dev` Realtime schemas.                                                                            |
| `npm.cmd run companion:budget`                                                                                                                                             | Passed.                                                                                                                             |
| `npm.cmd run test:unit -- --maxWorkers=2 --minWorkers=1`                                                                                                                   | Passed: 296 files, 2,087 tests; exit code 0.                                                                                        |
| `npm.cmd run build`                                                                                                                                                        | Failed in unchanged Plus Jakarta Sans font generation; see the build limitation below.                                              |
| `node node_modules/next/dist/bin/next build --webpack`, then `node scripts/prepare-standalone.mjs`                                                                         | Passed: production compile, TypeScript, prerendering and standalone packaging.                                                      |
| Production `.next/server/app-paths-manifest.json` audit                                                                                                                    | Passed: no demo route; all four retained summary/next-step handlers listed above are registered.                                    |
| `git diff --check` from repository root                                                                                                                                    | Passed.                                                                                                                             |

Installed Next.js 16.3.0 layouts/pages and route-group guides were checked before
implementation. The `(dashboard)` folder does not form part of the public URL;
removing its filesystem page removes that product route.

The first offline dependency-install attempt stopped because `zod@4.4.3` was
not cached. Retrying with normal network access and the same lockfile succeeded.
No dependency, lockfile, configuration or credential file was changed.

### Default build limitation

The default Next.js 16.3.0 Turbopack build failed with 20 errors in generated
Plus Jakarta Sans CSS: `next/font/google queries have exactly one entry`.
Google's returned font URLs contain query parameters separated by `&`;
Turbopack incorrectly splits the enclosing font import query. This matches the
[upstream Next.js font-parser fix](https://github.com/vercel/next.js/pull/100158).
`app/layout.tsx`, `next.config.ts`, `package.json` and `package-lock.json` all
exactly match baseline `53732d7`. No font or bundler configuration was changed
for this cleanup.

The successful Webpack production build is supplemental verification. It does
not make the default Turbopack build pass or establish a green default `dev`
gate. CI still needs to confirm that build, or the font-parser dependency needs
a separate correction. No mock fonts or skipped TypeScript checks were used.

The first full-suite wrapper stopped on Vitest's existing deprecated
`environmentMatchGlobs` warning because PowerShell treated stderr as a terminating
error. The suite was restarted with normal stderr handling and its actual exit
code used for the result above.

Browser E2E belongs to the staging gate and was not run for this orphan-route
removal. No new test asserts a deleted file's existence; existing real-flow
regressions, type checking and the production route inventory provide evidence.
Delivery uses `chore/MB-719-remove-consultation-notes-demo` with `dev` as the PR
base. The default build limitation above remains a pre-merge concern.
