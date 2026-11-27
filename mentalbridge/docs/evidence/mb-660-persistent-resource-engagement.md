# MB-660 persistent resource engagement evidence

MB-660 replaces device-local resource bookmarks and presentation-only Bingo
stamps with owner-scoped Content state. Bookmark save/delete is available from
the catalogue and reviewed resource detail pages. Weekly Bingo renders unchecked,
self-confirmed, and Content-verified evidence as separate states and lets the
owner undo only their self-confirmation.

The browser fails closed after ambiguous writes or an ETag conflict: the prior
bookmark/Bingo state is hidden and an authoritative reload is offered. Content
responses are bound to the exact requested resource, week, position, and strong
ETag at the BFF/provider boundary. Week rollover follows the authoritative
journey `weekStart`; no device-local progress fallback is used.

## UX and rendering

The Stitch source and capture are recorded in `../../.stitch/mb-660`. The
implemented controls have 44px touch targets, visible pressed/loading/error
states, reduced-motion behavior, and no horizontal overflow at 1280x800,
768x1024, 375x812, or 640x400. The browser journey asserts that headings resolve
to Fraunces and body copy to Be Vietnam Pro from the repository's `next/font`
Vietnamese subsets. Controlled desktop and mobile captures are stored as
`mb-660-resource-engagement-desktop.png` and
`mb-660-resource-engagement-mobile.png`.

## Verification

- `npm run quality`: 207 files and 1076 unit/route/component tests, contract
  snapshots, lint, typecheck, and production build.
- `node scripts/run-e2e.mjs tests/e2e/resources.spec.ts --workers=1
  --reporter=line`: nine Chromium journeys, including bookmark save/reload/delete,
  self-confirm/undo, authoritative completion verification, responsive overflow,
  font resolution, reduced motion, missing catalogue, outage, timeout, and
  malformed dependency states.
- Native parity remains tracked by MB-665/MB-666 under the approved deferral.
