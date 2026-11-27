# MB-641 evidence manifest

Read [brief.md](brief.md), [production-mapping.md](production-mapping.md) and
[reference-qa/README.md](reference-qa/README.md) together. The final Stitch frame
was **not** accepted; the user explicitly approved the tested local interaction
prototype while preserving the existing source shell. Native device execution
remains **NOT_RUN — MB-666**. Synthetic browser/source fixtures are not live APIs.

## Curated PR set

- This manifest, `brief.md`, `production-mapping.md`, `final-stitch-prompt.md`.
- Prototype authoring: `prototype.js`, `prototype.css`, `prototype-qa.mjs`,
  `build-prototype.mjs`, `support-plan-prototype.html`,
  `dashboard-prototype.html`.
- Final retrieved reference pairs: `stitch-desktop-final.html/.png`,
  `stitch-mobile-final.html/.png`. They document the failed frame gate and must
  not be presented as approved production chrome.
- Reports: `qa/report.json`, `baseline/report.json`,
  `reference-qa/README.md`, `reference-qa/report.json`,
  `reference-qa/rn-static-audit.json`.
- Representative full frames: `qa/plan-desktop.png`, `qa/plan-mobile.png`,
  `qa/dashboard-desktop-context-viewport.png`,
  `qa/dashboard-mobile-context-viewport.png`, `qa/returned-before-check.png`,
  `qa/accepted.png`, `qa/history-source-missing.png`.
- Current RN source captures: `reference-qa/native-baseline-native-plan.png`,
  `reference-qa/native-baseline-native-plan-tablet.png`.
- Optional source-render tooling: `native-baseline.tsx`,
  `build-native-baseline.mjs`, `native-baseline.html`, `render-references.mjs`.

Report capture inventories may also name locally retained images not selected
for the PR. Every report keeps its original result and evidence limitations.
The RN static audit `projectRoot` is repo-relative (`mobile`) for portability.

## Replaying the interaction prototype

The captured prototype HTML needs `support-plan-baseline.css`,
`dashboard-baseline.css`, `support-plan-baseline.html`,
`dashboard-baseline.html` and the referenced `fonts/` files. These are local
replay dependencies (about 1.8 MB), not application assets. Include them if the
PR is intended to support offline replay; do not claim a self-contained replay
from HTML/scripts alone after excluding those dependencies.

`build-prototype.mjs` additionally reads captured `baseline/*-desktop.html` and
the matching local `.next` build. Regeneration against a different build must
recapture the baseline; filenames are not a stable production contract.
The historical `capture-baseline.mjs` uses a workspace-private fixture helper
and is not a portable PR entry point. Current Playwright journey tests are the
repository-owned production verification entry points.

Exclude generated `native-baseline.js` (already ignored), the debug
`reference-qa/native-return-failed.png`, intermediate initial/corrected Stitch
duplicates, caches and unrelated demo SQL. No artifacts are deleted by this
manifest. A source-render bundle can be regenerated locally; it is not commit
material, device execution or deployment evidence.
