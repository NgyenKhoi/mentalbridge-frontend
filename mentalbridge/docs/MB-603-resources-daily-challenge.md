# MB-603 — Resources daily challenge

## Navigation

```text
Sidebar / mobile navigation (remaining-today badge)
  → Resources overview
      → select one of the last 7 days
      → filter catalogue by difficulty or format
      → open resource detail
          → complete checklist / guided practice / video reflection
          → previous resource | next resource
          → Back to Resources (restores day, filters, and scroll position)
```

The daily challenge is a presentation over the reviewed resource catalogue. It does not replace catalogue review state or Support Plan occurrence tracking. A journey exists only for local days 1–14 of the active plan; dates outside that window are shown as unavailable rather than failing the seven-day view.

## Overview wireframe

```text
┌ Greeting · date · streak ───────────────────── mascot ┐
├ 7-day selector  [T2] [T3] [T4✓] [T5] [T6] [T7] [CN] ┤
├ Daily challenge ─ progress ring ─ checklist ─ Start ─┤
├ Difficulty chips · format chips                       ┤
├ Resource cards (responsive 1 / 2 / 3 columns)         ┤
├ Weekly bingo                  │ Recently completed    ┤
└───────────────────────────────┴───────────────────────┘
```

Loading, empty, filtered-empty, and dependency-error states use the same calm visual language. Completion feedback is dismissible and respects `prefers-reduced-motion`.

## Detail wireframes

```text
Shared
┌ Back / breadcrumb                                      ┐
├ cover · title · badges · duration · complete · progress│
├ sticky/collapsible TOC │ structured content            │
├ previous resource     │ next resource                  │
└───────────────────────┴────────────────────────────────┘

Article / journaling     Practice              Video
reviewed structured      timer/orb + active     embedded player
content + callouts       step/cue highlight     synced Vietnamese transcript
purpose-shaped actions   repeat-session action  2-question reflection
```

## Persisted state

- Daily progress key: authenticated owner + resource + local calendar date. Once completion is confirmed, later checklist edits do not erase the recorded completion.
- A deliberate repeat of a repeatable exercise creates a distinct practice-session identifier with start time and optional bounded duration, so multiple sessions on one day remain countable and retry-safe.
- Stored progress fields: status, reviewed resource version, bounded action identifiers, and non-clinical practice-session metadata.
- No free-text reflection, journal content, clinical score, or diagnostic inference is stored.
- Overview state (selected date, filters, and scroll position) is session-local; progress is server-persisted and shared across views.

## Reviewed content contract

- Public catalogue and detail responses accept only published resources whose source review status is `REVIEWED`.
- `structuredContent` supplies reviewed overview, when-useful, key-idea, and next-step copy; legacy `contentBody` remains a fallback only.
- `interactionType` selects the correct experience (reader, transcript, paced/timed practice, worksheet, activation planner, self-compassion/unhooking prompts, specialist preparation, or reflection) instead of inferring the detail layout from the catalogue category.
- The admin BFF forwards the same semantic, interaction, frequency, structured-content, and provenance fields used by the Content contract.
