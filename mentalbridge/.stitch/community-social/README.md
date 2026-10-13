# Community social reading — design evidence

Scope: USER Community feed, saved collection, detail/comments, independent
display identity, composer, media viewer and supportive reactions. No backend,
seed, Plus, appointment, payment or identity mutation in this UI delivery.

## Source and design gate

- Current route baseline: `baseline-{desktop,laptop,mobile}.png/html`, captured
  on isolated :3100 with synthetic owner fixtures; captured CSS includes actual
  self-hosted Vietnamese fonts. Brief: `brief.md`.
- Stitch project: `10509806209320093143`.
- Desktop initial `be8e8458a12d4993b32b3a1d92ece0b4`, corrected
  `b8941d52006f4b87a37218ffdd93e605`.
- Mobile feed/detail initial `7dd5f1f7bcdd4876a5f96b9a0a0de179` /
  `58129bfeff0f4227be21157de4253c92`, corrected
  `bcba0c33758d490c8459439aefd20716` / `716f47f4635b4a838cc19945cd7f6727`.
- Downloaded HTML/PNG are reference only. Invented expert/verified badges,
  medical assertions, sorting/metrics and generated shell variations were
  rejected. Production retains the real Community shell, API capabilities and
  runtime tokens/fonts, not Stitch CDN/framework code.
- Accepted direction: bounded social reading stream, compact composer,
  native-ratio image, purposeful gallery, conversational comments and
  committed-only reaction feedback. Desktop stream680 + dock256 + gap24.

## Interactive prototype

`community-interactive-prototype.html`, `prototype.js`, `prototype.css` use
in-memory labelled fixture data; no business API. This is a local interactive
prototype grounded in Stitch, not a claimed native linked Stitch prototype.

Prototype browser QA passed before production changes: 9 behavior groups,
39 captures, five viewports, zero console/runtime errors and zero API requests.
See `prototype-qa.md` and `prototype-qa/report.json`.

The gallery prototype exercises two assets. Production browser QA separately
exercises four previews/+6 and all ten assets. Production verification is in
workspace `.artifacts/community-ui/production-qa.md`; its browser interception
does not prove provider/BFF integration. Fixture E2E and production build are
separate delivery gates.

## Implementation owners

Native React/Next components only. `CommunityMedia.module.css` owns media
geometry; `CommunityInteractions.module.css` owns success feedback and reduced
motion. Existing feature CSS owns feed/detail/comments/profile composition.
The shared `LightSelect` owns keyboard/focus and popup clipping bounds; no new
dropdown library, icon font, motion dependency or CSS framework.

No measured 60FPS/GPU performance claim. 640×400 is a zoom-equivalent layout
check, not a manual browser zoom certification. Real authenticated shared-dev
Community needs the user's own session; synthetic fixture auth is never sent
to :3000.
