# MB-667 design evidence

## Approved direction

- Native Stitch prototype supplied by the product owner:
  `https://stitch.withgoogle.com/projects/11301498810357736343?node-id=ff46a47310a743d4a5b8a4a59c6913da`
- The current MentalBridge authenticated shell is preserved. Stitch exports are
  visual and interaction references, not production markup or domain authority.
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

- Stitch project and screen set were inspected from the supplied project.
- Native prototype play transitions were supplied by the owner; they have not
  been independently automated from this workspace.
- Backend focused tests: 70 passed, covering all twenty catalogue variants,
  source ownership, safety precedence, exact-episode history and OpenAPI.
  Seventeen PostgreSQL/Testcontainers integration tests also passed for the
  assessment flow, episode history and Combined Meaning query/controller.
- Web focused tests: 91 passed across thirteen MB-667 contract, BFF, component,
  shared-shell and journey files.
- Web typecheck, ESLint, OpenAPI snapshot checks and production build passed.
  The build contains both new BFF routes and
  `/assessments/results/[supportEvaluationId]`.
- Mobile strict contract/API readiness: 33 Jest tests and typecheck passed. No
  Android MB-667 screen is claimed by this responsive-web delivery.
- The strict premium audit reports seven existing findings only in unchanged
  Journal, Notifications, Profile, dashboard-shell and Resources files; it
  reports no MB-667 file finding. See `premium-audit.json`.
- Three Playwright journeys passed against the production standalone build.
  They cover the exact historical pair and saved Guide, Mầm An loading,
  incomplete history without an invented score, authoritative safety override,
  and a separate severe/professional-support state. Runtime screenshots were
  inspected on desktop and 375 px mobile; all checked mobile variants had no
  horizontal overflow. Docker deployment and native prototype-play automation
  have not been run; static exports are not counted as runtime evidence.
- The twenty Vietnamese combined-meaning variants remain `draft.2` pending
  explicit Care/content-owner approval. Design approval does not approve health
  copy or deployment.
