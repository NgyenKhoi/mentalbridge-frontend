# Community uploaded avatar — user-requested, 2026-10-13

## Authority and scope

USER explicitly chose an uploaded photo rather than only existing presets.
Community owns this image; never import Identity/Care photos, email or account IDs.
Existing signed media intent → provider upload → owner finalize verifies file
format/size/ownership. A new versioned PUT profile/avatar selects only an owned,
unattached READY IMAGE or removes the photo with null. Existing name/preset PUT
keeps the selected photo. Selection is public on named Community posts/comments;
anonymous/deleted authors never expose it. Current selection protects orphan
retention; replaced/removed images return to existing media retention.

Slices: additive Community API/model/tests; profile avatar UI/BFF/tests; MB-641
Care evidence retry/consumer separately. No seed/grant/appointment/Git publication.
The schema migration is application correctness, not demo seed data.

## Verified full-frame baseline

The author inspected existing local production captures named
`profile-1440x900.png` and `profile-375x812.png` before editing. They were
workspace-local baseline evidence, not a dependency of this PR or its replay.
The committed reusable shell input is the prior
`../community-social/baseline-desktop.html` plus its captured CSS; current
profile-content screenshots are available in `production-qa/`.

Root viewed both and compared CommunityShell, CommunityProfileSettings and current
community.css. Desktop header 68px, logo left, Feed/Saved/Identity tabs, safety and
dashboard exits right. Mobile header 64px, brand/dashboard exit, existing bottom
nav Feed/Saved/Identity/Support. Safety floating widget remains shell-owned.
Profile reads in centered 680px column, natural document scrolling.
The older prototype profile captures are NOT the production content baseline.

Locked: every shell region, route links/order, widths, header/mobile nav and
scroll ownership. Editable: CommunityProfileSettings photo/preview region only;
existing name, presets and privacy copy adapt to truthful photo capability.
No invented cover/banner, followers, social metrics, sidebar or extra header.

## Design and canonical UI map

Product form in Vietnamese, not a Japan-market or marketing surface. Runtime
app/globals.css is canonical (Model B); docs/DESIGN_SYSTEM.md and
PRODUCT_EXPERIENCE.md are maintained DESIGN/UX equivalents. Preserve teal/sage
and Be Vietnam Pro, restrained existing editorial headings. Palette inherited:
canvas #f1f4eb, white #ffffff, ink #1b2a22, secondary #52604f,
teal #1e4a43/#3d7a6e, sage #e9efe3. No system-level token/rebrand change.
Signature is the personal circular preview with small camera affordance; quiet
surrounding controls. Existing photo is never replaced before a confirmed save.

Owners: CommunityAvatar renders photo/preset/initial fallback everywhere;
profile feature owns file selection/preview; existing browser Community media
upload handles signed transport; FeedbackProvider owns status/confirmation;
Dialog owns any confirmation; same-origin Community BFF owns authorization;
global tokens own scrollbars/focus/motion. Sibling: CommunityPostComposer upload.
No duplicate upload framework, cropper, image URL field or client-side database.

## Interaction/state map

Initial loading/error/retry → current photo or preset. Choose JPEG/PNG/WebP ≤10MiB
→ local circular preview (center crop is explicitly visible) and filename/help
→ explicit Save photo → pending upload/finalize/select → confirmed profile/ETag
and success feedback. No success if upload/finalize/select fails. Failed select
keeps uploaded media identity so retry does not duplicate upload; failed upload
keeps file/preview. Cancel restores saved preview. Remove uses app confirmation,
then null command; error preserves existing photo. Stale conflict preserves photo
choice and unsaved display-name draft, offers reload current version before retry.
Name/preset edits remain independent and cannot overwrite a photo silently.
Do not reset another region's draft on avatar success or profile version changes.
Broken photo falls back to chosen preset/initial without a broken-image icon.
Uploading disables duplicate command/selection, exposes live status; unload
cleans object URLs/abort signals. Navigation remains unchanged.

Prototype fixtures only: synthetic person/name and local image; no real account,
credentials or service calls. Assert actual values/state, not just clickable UI.
Keyboard picker/cancel/save/remove, focus restoration; all primary targets≥44px.
Feedback opacity/transform only using existing160/220ms tokens; reduced motion
removes movement without losing status. No animation loops.

## Stitch prompt and gates

Reuse MentalBridge UI Redesign project10509806209320093143; closest existing
Community full-frame screens be8e8458a12d4993b32b3a1d92ece0b4 and
bcba0c33758d490c8459439aefd20716. Edit ONLY content to profile/avatar in exact
verified shell described above. Generate desktop1440 and mobile375. Retrieve
HTML/PNG; compare full shell, loaded Vietnamese fonts/glyphs, layout and controls.
Any altered/duplicate chrome fails. Build shell-integrated interactive prototype
and run state assertions before production UI edits.

Verification:1440×900,1280×800,768,375,640×400 zoom-equivalent; picker valid/invalid,
preview/cancel, pending/error/retry/success, remove confirmation, stale preserving
name draft, loaded fonts, console, overflow, keyboard and reduced motion. Focused
owner/PostgreSQL contract/concurrency tests; web BFF/component/Playwright update;
one full app quality gate at final checkpoint. No provider-live/native pass claim.

## Final design/prototype gate

Stitch project `10509806209320093143`; accepted final content references:
desktop `d0a4c5c59b274a6aa5abdb0a24838ca9`, mobile
`314ecebc698c4974b2dec7756142c947`. Retrieved final HTML/PNG are named
`stitch-desktop-approved` and `stitch-mobile-approved`. Earlier generated screens
are retained as rejected iteration evidence, not implementation references.

The first desktop/mobile generations altered route hrefs, omitted shell SVG or
used a different safety icon. They were corrected before production. A later
edit returned only a textual completion claim with unchanged downloaded HTML;
it was not treated as a passed gate. The final actual design artifacts contain
the original hand-heart SVG/button, restored route targets and nav order.

`interactive-prototype.html` is built from existing full-frame repository DOM,
not generated shell markup. The prototype demonstrates real local file choice,
decode/preview/cancel, pending/failure/retry, independent name/photo drafts,
stale recovery, removal confirmation, selected fallback icons, keyboard,
reduced motion and object URL cleanup. `prototype-qa.mjs` passed 13 check groups
with 10 captures at five viewport sizes. `stitch-render-qa.mjs` passed two
targeted actual 1440px/375px renders with loaded fonts, decoded images, route and
shell checks. See `prototype-qa.md` for exact commands/results and limitations.

The downloaded synthetic portrait is cached for reproducible design rendering;
it is not a production avatar or default asset. No real credentials, accounts,
uploads, Community writes or business API calls were used. The gate authorizes
only repository-native profile content translation; production shell and safety
widget remain untouched. No provider-live/native/production QA is implied.
