# MB-667 — one saved Meaning experience

## Owner request and reference

The post-screening tab in `/assessments` previously rendered an independent,
legacy interpretation accordion. The owner requested the UI/UX of
`/assessments/results/[supportEvaluationId]` as the canonical reference.
Reuse the approved MB-667 result exports and the existing verified result
composition; do not generate or introduce a different design direction.

## Scoped implementation

- USER enters Assessments → Gợi ý sau sàng lọc.
- Display the most recent stored evaluation from the authoritative ordered
  history, then allow selecting an older stored evaluation. Do not pair the
  latest standalone PHQ-9 and GAD-7.
- Render the existing `HistoricalCombinedMeaning` / `CombinedMeaningCard` in
  the tab, without another page-padding wrapper or a redundant back-to-history
  link. Heading levels adapt to the existing Assessments h1; appearance does not.
- Keep a compact existing Disclosure for record selection, plus a link to the
  canonical result URL. Selection and pagination preserve one active viewer.
- Same score cards, segments, meaning, saved Guide hrefs, disclosures, Mầm An
  loading, Safety precedence and unavailable/retry behavior as the result route.
- Read-only GETs only. No Guide creation, result regeneration, health-copy
  change, backend contract/schema mutation or historical data rewrite.

## State and verification map

| Change | Verification |
| --- | --- |
| Shared result composition | Compare actual score markup and Meaning text between tab and canonical route |
| Exact saved pair selection | Switch to an older record; confirm its ID, score and canonical href |
| Tab continuity | Load on first activation; retain selection across tab switches |
| Loading / empty / unavailable | Accessible Mầm An, assessment start CTA, no replacement pair on failure |
| Pagination | Failed append retains selected result; retry same cursor; no duplicate choices |
| Safety | Explicit saved safety takes priority above ordinary score/meaning surface |
| Responsive | 1440, 1280, 768, 640 and 375 CSS px, no page overflow |

The selector is presentation of existing history, not a new business flow.
The twenty draft combined meanings still require content-owner approval before
production; this refactor does not change that gate.
