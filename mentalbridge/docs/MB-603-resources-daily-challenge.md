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

The daily challenge is a presentation over the reviewed resource catalogue. It does not replace catalogue review state or Support Plan occurrence tracking.

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
summary + callout        4–4–6 timer/orb        embedded player
content sections         phase checklist       2-question reflection
takeaway checklist       auto completion       retry guidance
```

## Persisted state

- Backend key: authenticated owner + resource + local calendar date.
- Stored fields: status, reviewed resource version, and bounded action identifiers.
- No free-text reflection, journal content, clinical score, or diagnostic inference is stored.
- Overview state (selected date, filters, and scroll position) is session-local; progress is server-persisted and shared across views.
