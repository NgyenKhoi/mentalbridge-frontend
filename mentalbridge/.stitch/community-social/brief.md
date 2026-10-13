# Community social reading refactor — user-requested, no new Jira issue

## Scope and baseline

USER: browse, open media, react supportively, comment, save, compose, manage own
Community identity. Appointment/Plus and data mutation are paused.
Baseline real Next route using isolated synthetic owner APIs at 3201/3202:
`baseline-desktop.png` 1440×900, `baseline-laptop.png` 1280×800,
`baseline-mobile.png` 375×812, plus captured HTML/CSS. Root inspected desktop
and mobile and verified against CommunityShell/CommunityFeed current source.
Existing unrelated dirty SupportPlan/nav work must remain untouched.

Locked: CommunityShell brand, header links/order, safety/dashboard exits,
mobile bottom nav, USER authorization, document scroll owner, Safety trigger.
No global authenticated sidebar exists on this route; do not invent one.
Editable: feed/detail/saved/profile content, composer, comments, media gallery,
reaction presentation. Same header/navigation component retained in production.

## Grounded direction

Existing runtime tokens in app/globals.css own values (Model B);
docs/DESIGN_SYSTEM.md and PRODUCT_EXPERIENCE.md are maintained equivalents of
DESIGN.md/UX-CONTRACT.md. No rebrand, second framework, font or token generator.
Palette: canvas #f1f4eb, white #ffffff, ink #1b2a22, secondary #52604f,
teal #1e4a43/#3d7a6e, sage #e9efe3. Be Vietnam Pro body/control;
Fraunces only restrained editorial heading. Vietnamese locale, not Japan scope.

Social reading rather than wide admin cards: centered bounded 680px stream,
secondary 256px topic dock, 24–32px gutter, compact context and composer.
Desktop container about 980px; tablet/mobile single stream with collapsible
topic filters. Post identity → text/topics → media → feedback/actions.
Signature: supportive reaction icons make one small committed-state pulse
and short halo/seed drift, using transform/opacity and existing 120–300ms tokens.
No loop, page-wide entrance replay, fake popularity/ranking/followers/stories.

Media: single image preserves source ratio; tall media is contained within a
bounded stage (roughly 4:5 max), landscape never forced into a banner. Multiple
attachments use up to four deliberate square grid previews, with a +N cue on
the last tile when more are attached, plus an uncropped viewer; all up to 10
supported files remain reachable. The local prototype exercises two assets;
production verification covers the supported bound. Broken/unknown dimensions recover.
Gallery keyboard/Escape and focus restoration; no decorative automatic video.

## Authority and owners

Community API OpenAPI owns topics, media, optional viewerState, anonymous identity,
counts and operations. Only SUPPORT/RELATE/THANK_YOU, one selection per viewer.
No valid viewerState means no reaction/bookmark controls. Mutation commits only
after server success; pending duplicate prevention, previous state on error,
actual response selection. Counts are local deltas, not fresh aggregate claims.
Saved unbookmark removes/refetches private collection as before.
Sensitive content stays gated, absent/deleted/anonymous identity stays bounded.
Owner edits use existing ETag/confirmation; no new data/auth/API behavior.

Canonical map: shell CommunityShell; forms existing composer/profile/comments;
dialog Dialog; feedback FeedbackProvider; topics Disclosure; media CommunityMedia;
reactions CommunityInteractions; scrollbar globals.css; server permissions BFF.
Sibling reference: SupportPlan updated controls, but social feed stays feature-owned.

## State and interaction map

Feed: initial loading/data/source-empty/filter-empty/partial media/topic error,
load-more error/retry, stale filter response ignored. Detail: loading/not found,
owner edit pending/error/conflict/confirm delete. Profile: loading/create/edit,
validation/pending/error/conflict. Composer: open/dirty/keep-or-discard/publish
pending/error/success, attachment readiness, anonymous/warning/topic choices.
Reaction: idle → pending → server-committed icon pulse / unchanged error + retry;
replace count unchanged; remove decrements; server refresh reconciles selection.
Prototype fixtures only, no real credentials/services. Test image ratio/contain,
gallery navigation, reaction add/replace/remove/error/double-click, saved/feed
handoff, profile edit feedback, draft preservation, keyboard and reduced motion.

## Stitch and verification gates

Reuse MentalBridge UI Redesign project 10509806209320093143. Tool has no verified
image-upload/reference input, and existing project has no Community frame.
Provide exact captured frame geometry/markup before generation and compare
generated full frame to baseline; generated chrome is never production source.
Generate desktop/mobile, retrieve HTML/PNG, review Vietnamese/fonts and shell.
Then local shell-integrated interactive prototype; only after QA production edits.
1440×900, 1280×800, 768, 375, 640×400 zoom-equivalent; keyboard, reduced motion,
loading/error/empty and multi-media layouts. Focused tests then one repo quality
gate at delivery, scoped Playwright update; no DB seed or real mutation.
