# MB-667 design evidence

## Approved direction

- Native Stitch prototype supplied by the product owner:
  `https://stitch.withgoogle.com/projects/11301498810357736343?node-id=2f451bb2a1844a23993d1dda63ce101b`
- Owner correction: preserve only sidebar, font families and the web's green
  brand tone. All main content follows the owner's Stitch prototype for layout,
  static copy, desktop/mobile composition and interactions. Do not reinterpret
  this direction through frontend-design skills. Contract data and safety
  authority remain real. Prototype fixture selectors are not product controls.
- The supplied `prototype-mb-642.html` and the two identical pasted HTML files
  contain the PHQ-9 question screen; the six exports below hold the MB-667 states.
- Current and historical results share one Combined Meaning composition.
- Each historical row represents one exact saved PHQ-9/GAD-7 screening episode.
- Historical results and Support Guides are read-only. Missing or incompatible
  evidence is shown as unavailable and is never reconstructed from newer data.
- The removed “Lưu bản tóm tắt” action is intentionally not implemented.

## Reference set

| Artifact                        | Stitch screen ID                   | Intended state                             |
| ------------------------------- | ---------------------------------- | ------------------------------------------ |
| `01-history-desktop.*`          | `f338398d70564b5faa105964b3cb5617` | Assessment History, desktop                |
| `02-history-mobile.*`           | `f5681eceb5994094b014196c4917e057` | Assessment History, mobile                 |
| `03-result-meaning-desktop.*`   | `73ae2cd6b5cb4d39a5a70075ee226d46` | Shared Combined Meaning, desktop           |
| `04-result-meaning-mobile.*`    | `2ac007d72b1e45bd9e3d1a0b40502b22` | Shared Combined Meaning, mobile            |
| `05-historical-guide-desktop.*` | `f0c3b1ed5b3743f797016e978a7b92fc` | Persisted historical SupportGuide, desktop |
| `06-historical-guide-mobile.*`  | `e60df94a305c46ceb407239a0a01636d` | Persisted historical SupportGuide, mobile  |

The exported HTML is retained only for comparison. Production code uses the
repository design tokens, Vietnamese font stack, accessible controls, BFF
authentication and Care-owned contracts.

## Verification status

- Corrective parity checkpoint: 2026-10-15. Six owner exports were inspected,
  including their embedded current/history/missing/safety/loading transitions.
  `node .stitch/mb-667/inspect-reference.mjs` renders those local references.
  Native Stitch play has not been independently automated; export inspection
  and application browser tests are distinct evidence.
- Main content now uses paired desktop score cards above a full-width Meaning
  surface, separate mobile stacking, segmented score bars, history-first tabs,
  and the exported Mầm An SVG/loading compositions. Guide resources auto-fit
  their row rather than reserving an empty fourth column.
- Removed old result-heading CSS and opted this scoped content out of generic
  `!important` theme overrides that flattened card surfaces and stepper colors.
  Existing sidebar, fonts and green brand tokens remain unchanged.
- `npm run quality`: passed format, lint, typecheck, contracts, 245 unit-test
  files / 1,423 tests and production build at this checkpoint. Subsequent
  parity refinements passed the affected seven component files / forty tests,
  scoped ESLint/format checks and a fresh production build.
- `npx playwright test tests/e2e/mb-667-history.spec.ts --workers=1 --reporter=line`:
  five passed on the final production standalone build with synthetic fixtures.
  Covers 1440/1280 desktop grid geometry, 375 mobile overflow, actual heading
  size/stepper contrast, Mầm An loading and cue dismissal, exact historical
  pair/Guide/back links, incomplete history, safety and separate severe state.
- Selected final runtime images: `qa-parity/`. Broader local screenshots:
  `D:/mentalbridge/.artifacts/mb-667-parity/`. These contain synthetic fixtures,
  not a real user's health records or a native Stitch play capture.
- Docker: rebuilt and recreated only `mentalbridge-review1-frontend-1`;
  healthy. Image `sha256:2f080abde765c969ef07f2f00bb125671ca7d430c26d94882b8653f6df3a1868`,
  build ID `4Ok3aZMyPFPmwyipVXRHP`. Root/login returned 200 and assessments
  returned its expected unauthenticated 307. No database/volume reset, fixture
  auth or real-user mutation was performed on the shared stack. Authenticated
  live-user rehearsal remains separate from fixture browser verification.
- Backend and mobile were unchanged in this corrective checkpoint. Their prior
  readiness evidence is not counted as a new execution here; no Android UI
  implementation or native-device verification is claimed.
- The twenty Vietnamese combined-meaning variants remain `draft.2` pending
  explicit Care/content-owner approval. Design approval does not approve health
  copy for production. Invented prototype hotline numbers and unsupported
  safety-plan actions are intentionally replaced by the real safety directory.
