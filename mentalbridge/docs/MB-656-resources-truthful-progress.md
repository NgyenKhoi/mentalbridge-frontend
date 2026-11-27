# MB-656 truthful Resources progress

## Runtime truth model

The Resources overview renders only facts returned by the Content contracts for
the authenticated owner. Opening a card or following a link is navigation; it
does not create completion, a streak, or any other historical fact.

| UI value                                                                     | Authoritative source           | Display rule                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue title, summary, source organization, duration, and published state | Content `ResourceSummary`      | Render the returned value. A missing source label is shown as unavailable, never replaced with a named source.                                           |
| Daily status, completion time, and reviewed content version                  | Content `ResourceProgressItem` | Render only after the progress request or save succeeds. The local calendar date is sent unchanged with the owner request.                               |
| Daily totals, practice streak, plan revision, and bingo stamps               | Content `ResourceJourney`      | Render only for dates whose journey request succeeds with the browser timezone. A missing, partial, or unavailable journey keeps its own explicit state. |
| Filters and expanded catalogue state                                         | Current browser view           | These controls affect presentation only and are never described as account history.                                                                      |
| XP, levels, unlockable badges, and reward balances                           | No production contract         | Hidden until a reviewed server-owned reward contract exists. The frontend does not derive or persist them.                                               |

Completion feedback appears only after `saveResourceProgress` returns a
persisted `COMPLETED` item. A failed save has retry copy and no celebration. A
page refresh or a different browser session rebuilds the screen from Content,
so session state cannot restore deleted or unavailable progress.

## SupportPlan boundary

Resource progress is a Content-owned participation fact. SupportPlan
occurrences remain Care-owned facts under
[the SupportPlan v3 boundary](ADR_SUPPORTPLAN_V3_PRODUCT_BOUNDARY.md): a
`RESOURCE` occurrence needs explicit completion evidence, and opening content
alone is not completion. This screen does not create, infer, rewrite, or score
SupportPlan occurrences. It also does not calculate adherence, recovery, or
wellbeing from inactivity, mood, skipped activity, or completion.

The current v2 journey may present activities selected by an active plan, but
its daily Resource progress and its plan revision are displayed as separate
facts. Native v3 occurrence behavior remains in the MB-638/MB-639/MB-646/MB-647
follow-up scope.

## Failure and partial-data behavior

- A catalogue outage replaces the page with a retry state because resource
  identity and provenance cannot be confirmed.
- A progress outage leaves the reviewed catalogue usable and labels progress as
  unavailable. It never falls back to “not started.”
- A journey `404`, plan conflict, or provider failure has distinct copy and a
  reload action. It never becomes a zero-day streak.
- When today's journey succeeds but an older day fails, today's totals and
  streak remain visible with a partial-history notice; failed days use an
  unknown marker.

## Verification evidence

The focused component suite covers new, existing, and returning owners; failed
save and retry; partial and missing journeys; a new session; and server-deleted
progress. The Resources Playwright journey covers authoritative save, desktop
and mobile layout, keyboard-visible actions, reduced motion, and the absence of
reward claims.

Synthetic captures: [desktop](evidence/mb-656-resources-desktop.png) (1440 × 900) and [mobile](evidence/mb-656-resources-mobile.png) (375 × 812).
