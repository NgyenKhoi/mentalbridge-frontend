# Community local prototype verification

Executed against `http://127.0.0.1:3300` with headless Chrome on 2026-10-13.
The static server proxies only images and Next static/font assets to isolated
`:3100`; business API requests are rejected. No fixture reset or database write.

Result: **passed**, 9 grouped behavior checks, 39 screenshot artifacts,
zero console/runtime errors, zero business API requests.

Verified at 1440×900, 1280×800, 768×1024, 375×812, and 640×400:

- Feed, saved collection, detail/comments, profile, and composer render without
  horizontal overflow; Be Vietnam Pro font loads with Vietnamese text.
- Native baseline header and mobile navigation remain. Mobile top action is
  `Trang cá nhân`; no generated expert/avatar/help navigation was introduced.
- Composer empty validation focuses the input; Escape preserves the draft,
  changes the launcher to `Viết tiếp`, and restores trigger focus.
- Topic selection filters the fixture by bounded OR membership; filter-empty
  state and `Tất cả` recovery work.
- Reactions preserve committed state/count while pending, block repeated
  commands, increment once on add, retain count on replacement, decrement on
  removal, preserve state with no success pulse after error, and allow retry.
- Reduced motion keeps selected feedback without pulse animation.
- Two-image gallery supports previous/next, arrow keys, an uncropped viewer,
  Escape, and trigger focus restoration.
- Profile editing acknowledges the save and survives in-memory navigation.

Machine results: `prototype-qa/report.json`.
Representative reviewed captures: `prototype-qa/feed-1440x900-viewport.png` and
`prototype-qa/feed-375x812-viewport.png`. Other route/state captures are listed
in the JSON report. Full-page captures accompany viewport captures.

Prototype corrections: real topic membership/filtering; draft close/focus
restoration; gallery navigation; committed-only/reduced-motion reaction pulse;
compact launcher flex direction; captured CSS font URL serving.

Scope limit: this prototype uses in-memory fixture state and two gallery assets.
Production checks must verify real BFF behavior and the bounded four-preview
plus `+N` representation with all ten supported attachments reachable.
