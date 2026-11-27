# Community uploaded avatar — design/prototype evidence

## Verified local interaction prototype

Command, application directory:

```text
node .stitch/community-avatar/build-prototype.mjs
node .stitch/community-avatar/prototype-qa.mjs
```

Chrome headless; an ephemeral loopback static server; synthetic PNG files only.
Current result: **13 check groups passed, 10 captures**, recorded in
`prototype-qa/report.json`. No business API requests or page runtime exceptions.
This is not an authenticated owner/provider upload or production verification.

The builder clones the existing full-frame Community route DOM, including SVG
navigation and the existing safety widget. Only `.community-shell-main` content
is replaced. Header heights are asserted at 68px desktop / 64px mobile; existing
routes, active Identity tab, desktop/mobile navigation and 680px content bound
are checked at 1440×900, 1280×800, 768×1024, 375×812 and 640×400. The last is a
200%-zoom-equivalent CSS viewport, not a claim of physical browser zoom execution.
Loaded Be Vietnam Pro font faces and Vietnamese copy are checked; screenshots
were opened and reviewed, including staged mobile photo and removal error dialog.

Behavior assertions cover:

- unsupported, empty, oversized and corrupt images; valid decoded local preview;
- centered circular crop, cancel restoring the selected SPROUT SVG fallback,
  while independently edited name and public preview remain intact;
- pending state without a false success; upload failure retaining the file;
  profile selection failure retaining the uploaded media ID; retry without a
  second upload; avatar success preserving an unsaved name;
- stale version recovery requiring explicit reload while preserving both drafts;
  name save retaining the staged photo and uploaded media identity;
- removal confirmation, native dialog Escape/focus restoration, pending/error
  preserving the saved photo and dialog, inline retry and real SPROUT fallback;
- broken rendered image using the selected preset, not a broken-image icon;
- fast A/B image-decode race retaining B and revoking A; keyboard opening the
  picker; reduced motion; object URL cleanup after cancel/save/dispose.

## Stitch references and exact render checks

Project: `10509806209320093143` (maintained Community-adjacent project).

| Screen | Purpose | Inspection |
| --- | --- | --- |
| `80d1918f93db45cd89f5ffc329383af2` | Initial desktop | Rejected: invented 32-character limit/presets |
| `3f084212cd2a4efc8e445d0ddd12f87a` | First desktop correction | Rejected: incorrect shell hrefs and missing navigation SVG |
| `0436b14682be4a229024208b1eaf8869` | Initial mobile | Rejected: hash routes and extra secondary nav |
| `7749a289b76640d1a4a8cf8e61091d50` | Corrected desktop | Real 1440px browser render: fonts/68px header/routes/no overflow passed; safety icon still differs from locked shell |
| `425278f38aa34b768c8b69e0f6963e2e` | Corrected mobile | Real 375px browser render: fonts/64px header/routes/no overflow passed; generated metadata incorrectly labels DESKTOP/2560px |
| `d0a4c5c59b274a6aa5abdb0a24838ca9` | Final desktop reference | Accepted content direction: original hand-heart safety SVG/button, three-dot brand palette, real 1440px render/font/image/route/overflow check |
| `314ecebc698c4974b2dec7756142c947` | Final mobile reference | Accepted content direction: original hand-heart safety SVG/button, exact four nav links/icons, 64px header and real 375px render/font/image/overflow check |

Stitch's downloaded screenshot metadata is not viewport evidence; local browser
captures in `prototype-qa/` provide actual 1440px and 375px render evidence.
Both HTML and screenshots are retained. CDN/runtime dependencies remain design
reference only and must never be copied into production.

`prototype-qa/stitch-desktop-approved-1440x900.png` is a **historical first remote
render with a transient broken portrait**; it does not prove image correctness.
The correspondingly named mobile capture is also historical. Final reference
visual evidence is exclusively `stitch-render-qa/desktop-1440x900.png` and
`stitch-render-qa/mobile-375x812.png`, with `stitch-render-qa/report.json`.
The original failed remote capture is kept rather than overwritten so reviewers
can distinguish the identified problem from the later verified result.

Final surgical edit after usage-limit recovery claimed completion in a text
response but returned no new design artifact; `get_screen` kept the same URLs.
Downloaded `stitch-*-final.html` still contained the old safety SVG/English
labels. That textual claim was **not** accepted as gate evidence. Single-screen
corrections explicitly requesting actual new design artifacts returned the final
two screens above, retrieved as `stitch-*-approved.html` / `.png` and inspected.

The original remote synthetic portrait intermittently failed to load in one
browser render. The exact generated asset was downloaded, not redrawn or
substituted, as `stitch-avatar-reference.png`. Targeted browser QA routes only
that exact remote image URL to the cached original; retrieved HTML is unchanged.

```text
node .stitch/community-avatar/stitch-render-qa.mjs
```

Result: **2 render checks passed, 2 captures**, in
`stitch-render-qa/report.json`. All images decoded; actual header height,
existing five route targets, loaded Vietnamese font, no horizontal overflow and
the four original safety SVG paths / semantic button are asserted. Both final
local screenshots were opened for visual inspection. This final targeted run
does not rerun or replace the 13 passed interaction check groups.

The design/prototype gate is passed for the declared profile-content region.
Generated shell styling remains reference only: minor icon/brand sizing and
tones are not production change instructions. The local prototype clones the
repository shell, and production must retain CommunityShell / safety-widget
components exactly rather than translating generated chrome.

## Production translation boundary

Reuse the existing production CommunityShell and CrisisSupportWidget unchanged;
only profile photo controls / CommunityAvatar presentation and owner-derived
data are in scope. Do not copy generated shell, upload logic, fake data or CDN
assets. Production controls must retain the state invariants demonstrated here,
with owner API/BFF authorization and existing signed upload/finalize mechanism.
