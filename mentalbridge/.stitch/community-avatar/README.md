# Community avatar evidence

This directory contains design/fixture evidence, not application runtime assets.
Use [brief.md](brief.md) and [prototype-qa.md](prototype-qa.md) for scope,
acceptance and the distinction between prototype, production-source browser
checks and real owner/provider integration. All captured identities are synthetic.

## Curated PR set

- `brief.md`, `prototype-qa.md`, this manifest.
- `interactive-prototype.html`, `prototype.js`, `prototype.css`,
  `build-prototype.mjs`, `prototype-qa.mjs`, `production-qa.mjs`,
  `stitch-render-qa.mjs`.
- Final retrieved references: `stitch-desktop-approved.html/.png`,
  `stitch-mobile-approved.html/.png`, `stitch-avatar-reference.png`.
- `prototype-qa/report.json`, `production-qa/report.json`,
  `stitch-render-qa/report.json`.
- Final visual references: `stitch-render-qa/desktop-1440x900.png`,
  `stitch-render-qa/mobile-375x812.png`.
- Representative source/interaction captures:
  `prototype-qa/photo-staged-desktop.png`,
  `prototype-qa/photo-staged-mobile-reduced-motion.png`,
  `prototype-qa/remove-error-dialog.png`,
  `production-qa/initial-1440x900.png`,
  `production-qa/initial-375x812.png`,
  `production-qa/staged-mobile-reduced-motion.png`,
  `production-qa/remove-error.png`.

Other captures can remain local; a report's complete capture list is the run's
historical output inventory, not a promise that every binary is included in a PR.
Capture paths are relative to their report directory. Replay generates its own
captures with portable paths.

## Replay and exclusions

The prototype reuses already tracked `../community-social/baseline-desktop.html`
and `../community-social/captured-baseline.css`; keep their existing assets and
font paths. It does not require workspace-private production baseline captures.
The production-source check needs a built local Next app and isolated fixture
responses as implemented in `production-qa.mjs`; it must not point at shared DB
or upload-provider credentials.

Initial/corrected/stale `stitch-*-final` artifacts and historical broken-portrait
captures are not the accepted final direction. Preserve them locally for audit,
but omit duplicates from the curated PR. Retrieved HTML is unchanged and may
reference external design CDNs; never copy those dependencies into production.
The cached portrait is the exact original synthetic reference, not a replacement.

No account credentials, SQL/demo data or build caches belong in this evidence set.
