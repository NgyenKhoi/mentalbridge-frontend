---
version: alpha
colors:
  canvas: '#f1f4eb'
  surface: '#ffffff'
  ink: '#1b2a22'
  muted: '#52604f'
  primary: '#3d7a6e'
  primaryStrong: '#1e4a43'
  amber: '#e1a651'
  line: 'rgba(27, 42, 34, 0.12)'
typography:
  display:
    fontFamily: 'Fraunces, Georgia, serif'
  body:
    fontFamily: 'Be Vietnam Pro, sans-serif'
rounded:
  control: '12px'
  panel: '18px'
  shell: '22px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  panel:
    background: '#ffffff'
    radius: '18px'
  focusRing:
    color: '#1e4a43'
    width: '2px'
---

## Overview

MentalBridge product surfaces should feel like a quiet, well-kept Vietnamese
reading and practice room: warm, grounded and trustworthy without looking
clinical or decorative. The product register favors clear tasks, factual states,
gentle language and stable layouts. It must never resemble a competitive fitness
dashboard, casino reward system or medical scorecard.

The shared runtime tokens in `app/globals.css` are canonical. This file records
their visual intent; feature styles consume those variables and may add scoped
semantic aliases without copying a second global palette.

## Colors

Green carries navigation, focus and voluntary action. Amber is reserved for
attention and selected accents. White surfaces sit on the pale green canvas;
muted text remains dark enough for sustained Vietnamese reading. Clinical
severity and reward rank are never encoded by color.

## Typography

Fraunces gives headings a humane editorial voice. Be Vietnam Pro owns body,
controls and data because its Vietnamese marks remain clear at compact sizes.
Large figures may use Fraunces, with adjacent plain-language labels in the body
family so their meaning is never conveyed by size alone.

## Layout

The application uses a centered 1180px content wrap, a 16–32px rhythm and
responsive grids that collapse to one column. Async states reserve the space of
the content they replace. Resource recognition stays in the existing side stack
and never displaces the daily activity workflow.

## Elevation & Depth

Static product panels use the restrained shared `--elevation-1`; stronger depth
is reserved for overlays. Borders provide most separation. Reward information
uses a single green rule as its signature rather than trophies or ornamental
badges.

## Shapes

Panels use 18–22px corners, controls use 12px or pill geometry, and data rows use
straight dividers. Roundness communicates approachability while keeping dense
facts easy to scan.

## Components

Buttons retain their size while pending, use native semantics, visible focus and
plain verbs. Loading, empty, error, stale and confirmed-zero states are distinct.
Optional recognition always provides a reversible hide/show control. Reduced
motion removes entrance and transition effects without hiding content.

## Do's and Don'ts

- Show personal totals only after the owner service confirms them.
- Explain provenance and recovery next to stale or unavailable information.
- Use participation language for resource XP.
- Do not use leaderboards, trophies, rank colors or treatment-progress wording.
- Do not let reward visibility affect Resources, SupportPlan, safety or specialist access.
