# ADR: Mầm Rive V2 contract and the welcome airplane arrival

- Status: **proposed for MB-894 review**
- Decision: `MB-MAM-RIVE-002`, contract version `mam-rive-contract-v2`
- Date: 2026-11-22
- Scope: Phase A of Mầm V2 (S1): the Rive v0.7 asset and one welcome scene on
  `/dashboard`. Other routes, other welcome variations and the central scene
  orchestrator are later phases (S2, S3).
- Amends: [ADR_MAM_RIVE_V1_CONTRACT.md](ADR_MAM_RIVE_V1_CONTRACT.md). V1 history is not edited; where
  this document and V1 differ, V2 wins for the items below and V1 stands for everything else.

## Decision summary

1. The web asset becomes `public/mam/mam-v07.riv`. `mam-v06.riv` stays in `public/mam/` for rollback.
2. Four behaviour IDs are appended after the 24 V1 IDs: `pilot` (24), `pilot_wave` (25), `hop_down` (26),
   `wave` (27). The first 24 IDs and their order are unchanged. `sad` and `rest` stay reserved.
3. The rig gains one art node, `goggles`, inside `head` (opacity 0 except in the pilot states).
4. The host renders a welcome airplane and a cloud trail as SVG layers around the Rive canvas, in a new
   travel mode `welcome`. Mầm herself stays Rive (no translated still image).
5. The scene plays at most once per account per browser session, on `/dashboard` only, and every cancel
   gate below stops it at once.
6. The asset budget rises from 160 KB to 180 KB for the goggles and the four states (measured below).

## Asset

| | v0.6 (V1) | v0.7 (V2) |
| --- | --- | --- |
| File | `mam-v06.riv` | `mam-v07.riv` |
| Bytes | 145,399 | 174,450 |
| SHA-256 | `6abc31b75f180fa58506e2ff1b48f9322818fe72652b20e8df9c03a0992ad644` | `b440cb6f097a5ae12cb7ad3d44cf4f4f5055000156c823b09530d1e85ea653c3` |
| Artboard, state machine, view model | `companion_main`, `MamBehaviorController`, `MamControls` | unchanged |

The source of truth is `design-source/mam-rive/build.mjs`; `scene.rml` is generated and never edited by
hand. Rebuild with `node build.mjs` and `rive.exe .\rig --once` (free CLI path, no login, no push, no
publish). Rig name `mam-v07`. The V1 hash lock moves to `features/mam/mam-contract.ts` (`MAM_ASSET.sha256`)
and `features/mam/mam-assets.test.ts`.

### Budget decision

v0.7 is 29,051 bytes (+20%) over v0.6 and 10,610 bytes over the V1 limit of 160 KB (163,840 B). The extra
bytes are the `goggles` node (about 1 KB of paths) plus four animations. This rig keys every animated channel
in every animation (so blends are exact), which makes each new animation cost about 6 to 7 KB. The art was not
cut to fit. The new limit is **180 KB (184,320 B)**, about 9.6 KB of headroom. The asset still loads lazily,
once per page, and only where the dock shows (V1 "Failure and fallback" is unchanged). A later phase that
adds more states must re-measure and justify again, or move to a separate asset.

### Appended behaviours

| ID | State | Class | Length | Used by |
| --- | --- | --- | --- | --- |
| 24 | `pilot` | host-set loop | 72 frames (1.2 s) | seated in the plane, wind-swept leaves, goggles on |
| 25 | `pilot_wave` | host-set loop | 48 frames (0.8 s) | `pilot` with the right hand waving at the user |
| 26 | `hop_down` | one-shot (`playOnce`) | 54 frames (0.9 s) | crouch, jump out, land with squash, goggles fade, dock pose |
| 27 | `wave` | one-shot (`playOnce`) | 84 frames (1.4 s) | standing greeting; also the generic hello later phases reuse |

`pilot` and `pilot_wave` join `MAM_LOOPING_BEHAVIORS`; the host sets them only through the welcome flight
(like `dangle` for a drag). `hop_down` and `wave` join `MAM_ONE_SHOTS` (timeouts 1000 ms and 1500 ms) and
return to `idle` themselves. Arbitration is unchanged: hidden, reduced motion and no-interrupt zones come
first, and an interrupted one-shot returns to the dock.

### Art note

The goggles sit on the forehead above the brows, never over the eyes. In `wave` and `pilot_wave` the raised
right arm is lifted and stretched (`armR.dy`, `armR.sy`) and held clear of the head silhouette so it reads
as a wave. The storyboard asked for the hand to be above head height; the arm length makes that impossible
without distorting the character, so the hand reaches the temple, beside the head.

## Host layering (airplane and cloud trail)

- Everything is drawn inside the dock's `.flight` space, in the character's artboard units (512 units = the
  character box: 96 px, 72 px compact). The plane is 556 units (about 104 px) long at dock size. In the air the plane and the seated Mầm are drawn at a flight scale of 1.7 on desktop and 1.3 at 900 px and narrower, about the seat, and ease to 1.0 over the 800 ms before touchdown, so touchdown, roll and hop are dock size. The path is kept inside the viewport for the scaled size, and the Rive drawing buffer is sized for the scale while the flight lasts.
- `MamAirplane layer="back"` renders before the mover (cockpit hollow, far wing tip, far tailplane);
  `MamAirplane layer="front"` renders after it (fuselage rim that hides her belly and feet, tail fin, low
  wing, gear, propeller). `MamFlightFx` holds the ground blob (a soft patch under the wheels) and the cloud trail.
- Palette is Mầm's rig palette. All parts are `aria-hidden`, have no text and `pointer-events: none`.
- Only transform and opacity animate. The propeller is a 120 ms scaleY flicker; it is the one loop the
  scene is allowed (it exists only inside the scene).
- Layers mount only while the travel mode is `welcome` and unmount with it; the plane fades over 180 ms
  on a cancel, the puffs are removed at once.

## Welcome travel mode

`mam-travel.ts` gains the mode `welcome` and `welcome(plan)` on the existing token and `requestAnimationFrame`
machinery, so `snap()` cancels it. The pure flight plan is `features/mam/mam-welcome-flight.ts`
(`buildFlightPlan`, `sampleFlight`): about 7.1 s from off-screen left, a turn at the right, a pass back while
waving, a descent, touchdown and roll to 70 px right of the dock, `hop_down` into the dock, and the plane
leaving (it fades instead when the screen edge is under 120 px away, as on compact screens). The greeting
`wave` follows when the mode is back to `dock`, so the whole moment is about 8.5 s. Bank never exceeds 12
degrees and the flight stays inside the viewport between entering and leaving.

### Start conditions (all true)

- pathname `/dashboard` (the V1 route matrix is unchanged; S2 owns more routes);
- `calm` (`canTravel` and Rive ready), travel mode `dock`, not asleep, no menu, summon, notice, celebration
  or local shot, and no focused element sits under the dock (a page action under it only dims her while docked; the
  plane is click-through);
- the whole wait is capped at 4 s from when it began: whatever holds the start (a slow asset, a no-interrupt zone, focus, a modal), after 4 s the scene is off for this arrival, Mầm shows in the dock and the session is not marked as played. Any input during the wait also ends it, so the plane never launches once the user has started to use the page;
- `document.visibilityState === 'visible'` and a viewport of at least 320 by 480;
- not played this session for this account. The flag is `sessionStorage` key
  `mentalbridge_mam_welcome:<accountId>` = `1`, written at the start, so a cancelled scene still counts;
- it starts 700 ms after Rive is ready, so the page's staggered entrance lands first. The dock character is
  held back only while the asset is loading or in those 700 ms (so Mầm does not appear and then vanish); a
  fallback, an error, a no-interrupt zone or the cap shows her (the static pose on a fallback) at once;
- it is due whenever the pathname becomes `/dashboard` and the session has not played it, not only when the
  session opens there.

Reduced motion (OS or the Mầm setting), "Chuyển động" off, hidden, a no-interrupt zone (it blocks the start
and, past the 4 s cap, ends the wait for good) and a failed or fallback renderer never start it.

### Cancel (immediate)

`snap()` runs, focus never moves, nothing is announced. Triggers: `pointerdown`, `keydown`, `wheel` or
`touchstart` on `window` (capture, passive, so the click that cancels still reaches its target); a route
change; `canTravel` going false; a preference change to hidden or motion off; the tab becoming hidden; a
renderer failure; a window resize (the plan holds the viewport and dock size); unmount. While the mode is
`welcome` the dock button and everything Mầm draws in it are `pointer-events: none`, so the click that
cancels lands on the page element under her.

### QA and demo replay

`?mamWelcome=1` on `/dashboard` ignores the session flag, once per page load (not again when she returns to `/dashboard` later in the page), and is still subject to every
other gate. Automated browsers (`navigator.webdriver`) do not get the surprise entrance unless the replay
query is present, so the existing end-to-end suites are unaffected.

## Rollback

In `mam-contract.ts` set `MAM_WELCOME_ENABLED` to `false` and point `MAM_ASSET.src` and `sha256` back at
`mam-v06.riv` (still shipped). The host then never starts the scene and never sets a v0.7 id. Swapping the
constants alone is not enough without that flag, because the host does not check the asset version. To
remove the feature for good, revert the MB-894 change; the four ids cannot simply be dropped from the
contract, since the host and the travel controller use them.

## Plan decision 8

The owner relaxes UI-WORKFLOW rule 13 only for Mầm's character layer. The scene is a friendly arrival, not a
reward, and the page under it stays calm. It never plays on clinical or safety surfaces, and `/dashboard` is
the only route in S1.

## Gate A (visual quality)

Evidence lives in the story's `.artifacts/MB-894-*`: Rive previews of each new state, videos at 1440 by 900
and 375 by 812, motion frames at 0.5, 2.0, 3.0, 4.6, 5.5, 6.2, 6.6 and 8.0 s, and one reduced-motion run.
Gate A is a visual decision, not a test count: it stays open while the art or the timing is weak.

## Route surface matrix V2

- Status: **proposed for MB-895 review**. Date: 2026-11-22. This section replaces the V1 "Surface matrix" table and
  its "static dock" rows. Everything else in V1 and in the sections above stands.
- Scope (owner, 2026-11-22): Mầm is present on the important tabs of the user-support journey, as one character per
  tab. The community and the plans-and-payment pages are out.

`features/mam/mam-routes.ts` maps a pathname to one mode (`mamRouteMode`). The host exposes it as
`data-mam-mode` on the dock root. A route that is not listed is HIDDEN, so a new route never shows Mầm by accident.

| Mode   | Routes |
| ------ | ------ |
| FULL   | `/dashboard`, `/achievements`, `/resources`, `/analytics`, `/nhin-lai` |
| QUIET  | `/journal`, `/ai-companion`, `/support-plan` (exact), `/support-guides`, `/support-guides/[id]`, `/appointments`, `/appointments/[id]`, `/messages`, `/notifications`, `/profile`, `/specialists`, `/resources/[id]` |
| HIDDEN | `/appointments/[id]/chat`, `/appointments/[id]/video`, `/call/*`, `/assessments(/*)`, `/assessment/*`, `/initial-check`, `/safety-directory`, `/community/*`, `/subscription`, and any unknown route |

- **FULL:** visible; idle life at the normal cadence; celebrations and reactions; the welcome may play.
- **QUIET:** visible and docked. Idle micro-actions (`stretch`, `look_around`, `scratch`) run at half the FULL cadence
  (interval 50 to 90 s instead of 25 to 45 s); sleep after 60 s idle is unchanged. No celebration bubbles or queued
  awards (they wait for a FULL route), no tip hop, no welcome. Summon and drag still work. While a text field, or any
  control in a form, has focus, Mầm stays visible and still: no idle action, no gaze, no sleep, and the character gets
  the static pose (`reducedMotion`). A dirty form (`useMamSuppress`) already did this; the journal list no longer hides, and the journal editor modal is the exception below.
- **HIDDEN:** `MamDock` renders nothing, so no host and no motion run there.
- **Welcome (changes the V1-era rule above):** a wait that ends without playing (the 4 s cap, a failed start check or
  the user's first input) is remembered in memory for this page load, so later FULL routes, and a return from a
  HIDDEN route, never hold her back again; `?mamWelcome=1` ignores it. Otherwise: eligible on the first FULL route reached in the session, not only
  `/dashboard`. It never plays on a QUIET route. Going QUIET to FULL plays it only if it has not played, and never
  replays after. Any input that ends the wait also marks the session, so a later FULL route does not surprise the user.
  The `?mamWelcome=1` replay works on any FULL route.
- **Safety:** unchanged. A modal (the voice dialog, a tour, the crisis panel), or a SupportPlan or HomeHub safety
  zone, still removes Mầm (`away`), so the AI voice dialog keeps its own Mầm face and there is never a second
  character on `/ai-companion`. The crisis button (z 120000) is never covered.
- **Journal editor exception (owner, 2026-11-22):** the editor dialog (create and edit, not the reader) opts in with
  `data-mam-companion="quiet"` (`Dialog` prop `companion="quiet"`). Only a dialog that carries it is exempt from
  the modal rule, and only while all of these hold:
  - the viewport is wider than 900 px (`min-width: 901px`); at 900 px or less the dialog covers the screen and she
    stays away, as she does where the browser has no Popover API;
  - no other modal is open over it;
  - the route is QUIET: on any other route the opt-in is ignored and the dialog hides her like every modal.

  Then she is drawn above the dialog's backdrop: the dock root becomes a manual popover (top layer,
  `data-mam-above="true"`), which a normal z-index cannot do under a native modal. She sits in the gap left of the
  dialog panel (`data-mam-panel`): `left = panel.left - size - 16` (size 96 px on desktop), her bottom edge on the
  panel's bottom edge (never lower than her 24 px dock edge, so she clears the sidebar's account card), over the
  sidebar, which is inert under a modal. She is away only when `panel.left < size + 32`.
  The editor panel is up to 980 px wide and centred, so that is below about 1236 px wide (and she fits at 1440,
  1366 and 1600). The position is recomputed on a resize, on the panel's own resize and when its entrance animation
  ends (a panel that never reports an animation is measured after 350 ms). She is hidden until first placed and
  until the entrance has settled, so she never shows at her dock spot or slides sideways; she enters with a 160 ms fade and no
  movement (no animation under reduced motion).

  The top layer is also above the crisis widget's z-index, but the page under a modal is inert, so the widget is
  unreachable there as it is today, and she is inert too (`pointer-events: none`). She keeps the slow QUIET idle
  micro-actions while the user types (no form-focus stillness there), with no gaze-follow, no bubbles, no tip and no
  sound.
- **`/nhin-lai` (14-day journey, MB-898):** FULL, but the page holds a no-interrupt zone (`useMamSuppress`) while it loads and
  whenever the fortnight reads harder or a screening band is moderate or above, so no celebration, queued award or
  welcome plays beside hard news.
- **Celebration routes** (queued awards play, `isMamCelebrationRoute`): FULL routes only (was `/dashboard`,
  `/achievements`, `/resources`, `/resources/[id]`). The award waits on `/resources/[id]` until a FULL route.
- **Mounting:** `MamDockSlot` stays in the `(dashboard)` and `resources` layouts. It is not mounted in
  `(community)`, so the community has no dock even if a path were mapped.
- **Rollback:** emptying the FULL and QUIET lists hides Mầm everywhere. `MAM_WEB_ENABLED` still gates the slots.

## v0.8 amendment (MB-896, Phase C: orchestrator and variations)

- **Asset:** `public/mam/mam-v08.riv` (233,322 bytes, 227.9 KB), SHA-256 `e54ddc955c0f4fc1b7a190a06b33e1e8e7eeb050409c083f9e56b5a4fb86b021`, rig name `mam-v08`. `mam-v07.riv` (174,450 B, hash above) and `mam-v06.riv` stay in `public/mam/` for rollback; `mam-assets.test.ts` locks all three hashes.
- **Budget:** v0.8 is 58,872 bytes over v0.7. Eight states at about 7 KB each, plus the `fistL`/`fistR`/`thumbR` nodes. A ninth state, `leaf_play`, was cut after the art review (the arm crossed the head shell); it was the last id, so no other id moved. The art was not cut to fit. The new limit is **240 KB (245,760 B)**, and the next phase must re-measure again or split the asset.
- **IDs 28 to 35, appended in this order; the first 28 are unchanged:**

| ID  | State       | Class         | Length             | Pose                                                                                                     |
| --- | ----------- | ------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| 28  | `spin`      | one-shot      | 66 frames (1.1 s)  | crouch, hop, two turns about the vertical axis (scaleX = cos), landing squash                            |
| 29  | `dance`     | one-shot      | 144 frames (2.4 s) | side sway, beat bounce, arms trading up and down, feet stepping                                          |
| 30  | `clap`      | one-shot      | 96 frames (1.6 s)  | arms rise, six claps under the chin, small bob                                                           |
| 31  | `thumbs_up` | one-shot      | 78 frames (1.3 s)  | wink, right arm out with the thumb up, two pushes                                                        |
| 32  | `fist_pump` | one-shot      | 72 frames (1.2 s)  | crouch, two hops with the right fist driven up                                                           |
| 33  | `sit_hug`   | host-set loop | 240 frames (4 s)   | seated, squashed body, arms wrapped round the belly, happy closed eyes, slow rocking                     |
| 34  | `hang`      | host-set loop | 72 frames (1.2 s)  | both fists up (about (30,140) and (210,140) canvas, V arms), feet kicking, leaves lifted; shadow hidden  |
| 35  | `pop_up`    | one-shot      | 66 frames (1.1 s)  | starts crouched 18 canvas units low (the host's pot hides the body), squats, springs up with arms raised |

- **New art nodes:** `fistL` (in `armL`), `fistR` and `thumbR` (in `armR`), opacity 0 except in `thumbs_up`, `fist_pump` and `hang`.
- **Contract:** `sit_hug` and `hang` join `MAM_LOOPING_BEHAVIORS` (set only by a variation sequence); the six one-shots join `MAM_ONE_SHOTS` (timeouts 1200, 2500, 1700, 1400, 1300 and 1200 ms) and return to `idle` themselves. Arbitration is unchanged.
- **Build:** `keys()` accepts a third element `'lin'` on a frame (linear segment); `spin` uses it for its cosine keys.
- **Rollback:** point `MAM_ASSET.src` and `sha256` at `mam-v07.riv`. `MAM_ASSET_VERSION` is read from `src`, so the catalogue then drops every variation that declares `minAsset: 'v08'` (ids 28 to 35) by itself; a half rollback cannot send them to v0.7 (`mam-assets.test.ts` ties the two).

## Orchestrator and variations (MB-896, Phase C)

One behaviour, many looks. A caller asks for a semantic **intent**; the orchestrator picks one **variation** and runs its steps. Code: `features/mam/mam-orchestrator.ts` (pure core), `mam-variations.ts` (the catalogue), `use-mam-stage.ts` (the host adapter), `MamProps.tsx` (host SVG props), `mam-scenes.ts` (pure scene motion).

### API

`play(intent, { source, priority?, grade?, variation? })` returns `{ status: 'played', variation }`, `{ status: 'queued' }` or `{ status: 'skipped', reason }`. Skip reasons: `disposed`, `hidden`, `reduced`, `route`, `viewport`, `none`, `blocked`, `busy`, `queue_full`. `grade` (`light`, `soft`, `hero`) narrows CELEBRATE to the celebration's own looks; `variation` forces one look (a trigger with a fixed look, or QA) and every gate still applies. Other calls: `cancel(reason)`, `dequeue(source)` (drops a waiting play), `input()` (ends a cinematic look only), `claim(priority)`, `refresh()`, `current()` (intent, variation, tier, whether it may grow), `candidates()`, `dispose()`. A seeded generator (`seededRandom`) and an injected clock make it deterministic in tests.

Intents: `WELCOME, IDLE, HAPPY, CELEBRATE, ENCOURAGE, COMFORT, LISTEN, THINK, GUIDE, REST`.

### Selection

Filter by route mode, viewport width, the served asset (`minAsset`), grade or forced id, and the host gate the look needs (`calm`, `present`, `festive`, `touch`, `autonomous`). A weight of 0 switches a look off. Then a weighted random pick that never repeats the intent's last look while another one qualifies. Hidden and reduced motion are checked first and skip with their own reason.

### Priority, queue, cancel

Priority, high to low: safety, hide and reduced motion (gates that cancel everything, not priorities), then `user` (4: a poke, a drag), `summon` (3: summon, guide, listen, think), `activity` (2: an acknowledgement, a celebration, a save), `welcome` (1), `idle` (0). `REST` ranks with `welcome`: the yawn of a nap is a host one-shot that takes the stage from idle looks, and must not cancel the nap. A lower priority never interrupts a higher one (`busy`). A higher one cancels the running one (`preempted`). The same priority queues at most one (`queued`, then `queue_full`); it is judged again when it starts, and a welcome that has to wait is dropped, since that page load has tried.

What cancels a running look (`MamCancelReason`):

- **Any look:** a route change and an account change (layout effects, so the old route's props never paint on the next one); hide, away and suppression (`hidden`); reduced motion; a closed host gate (`gate`); the journal editor dialog opening beside her (`modal`; other modals take her away, which is `hidden`); a renderer failure; a scene that is cut short, throws or rejects (`scene`: the priority is released and she returns to the dock); a hidden tab or a resize (`host`: a plan made for the old viewport is stale); unmount.
- **Cinematic looks only:** any pointer, key, wheel or touch (`input`). The input still reaches its target. This covers the plant pot and the parachute's whole run, not only the airplane. An expressive or micro look plays on after an input.

`clear()` on the host removes props, loop, concealment, gaze, the stage's one-shot and any scene motion (a travel snap); all timers are cleared. A normal end only settles props, loop and gaze; the last one-shot finishes by itself.

Travel modes: `welcome` and `scene` are cinematic (the dock layer moves to the front, the dock is click-through, celebrations and saves wait). `hop` is the expressive dance and spin on the spot: she stays in the dock layer, the dock button stays clickable and keyboard-usable, and a celebration or a save queues behind the look instead of being blocked.

### Variation library

Tiers bound the length (micro up to 2 s, expressive up to 5 s, cinematic 5 to 9 s); cinematic looks are WELCOME only, FULL only. The tier test (`mam-variations.test.ts`) enforces it. New looks are marked ★.

| Intent               | Looks                                                                                             | Notes                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WELCOME              | `airplane` (MB-894), ★`parachute`, ★`plant_pot`                                                   | cinematic, FULL only. The parachute is `hang` plus a descent (`parachuteDescent`, 4.2 s) and a closing `wave`; the pot drops in, hides her (concealed), `pop_up`, `wave`, then sinks                                                                                  |
| HAPPY                | `happy`, ★`spin`, ★`tiny_dance`                                                                   | `spin` and `tiny_dance` FULL only. The asset's hops are about a pixel at the 96 px dock, so both also run a host travel scene (`danceMotion`: a 9 px hop on every beat and an 11 px sway; `spinHop`: a 14 px jump over the asset's jump), scaled by dock size over 96 |
| CELEBRATE | `light_success` (Bingo), `celebrate_soft`, ★`clap` (soft), `celebrate_hero`, ★`cheer_sign` (hero) | FULL only. The sign shows on every screen: on the compact dock its board and text are bigger so the text is 12 px or more, and it stands on the roomy side (right of the dock), or floats above her head when there is no room there |
| ENCOURAGE            | `nod`, ★`thumbs_up`, ★`fist_pump`                                                                 | `nod` is also allowed on QUIET routes and is the look of every confirmed save                                                                                                                                                                                         |
| COMFORT              | `gentle`, ★`sit_hug`, ★`umbrella`                                                                 | the umbrella and its drops are FULL only                                                                                                                                                                                                                              |
| LISTEN, THINK, GUIDE | `listening`, `listen_nod`, `thinking`, `point`                                                    | the triggers come with the summon wiring (MB-897)                                                                                                                                                                                                                     |
| IDLE | `stretch`, `look_around`, `scratch`, ★`butterfly` | the butterfly is rarer (weight 1 of 10) and FULL only; her gaze follows its path. An idle look pauses the pointer gaze and restarts the 25 to 45 s cadence from its end, as before |
| REST | `drowsy_sleep` (the existing yawn and lie-down), ★`blanket_tuck` (a nap in place) | the 60 s idle sleep asks for `REST/drowsy_sleep`; the travel controller still performs it |

### Emphasis at the dock

While an EXPRESSIVE look plays at the dock, the flight box (Mầm and her props) grows to 1.25 (desktop) or 1.15 (compact), anchored at her feet (`transform-origin: 50% 100%`), so a pose that is a few pixels at 96 px reads. Looks that grow: `spin`, `tiny_dance`, `clap`, `thumbs_up`, `fist_pump`, `sit_hug`, `happy`, `celebrate_soft`, `gentle`, `umbrella`, `butterfly`. Looks that opt out (`grow: false`): `look_around` and every REST look (`drowsy_sleep`, `blanket_tuck`), which are idle life, not performances. It is a CSS transform on the flight box: in over 180 ms with `--ease-emphasis`, out over 220 ms when the look ends. The canvas is oversampled while it lasts, so she stays sharp. Micro looks, cinematic scenes and reduced motion never scale; under reduced motion no look starts at all. The dock root carries `data-mam-emphasis`. The page-action yield check uses the grown box. A look gated on `touch` or `autonomous` is cancelled when the grown box would cover a page action; a CELEBRATE look (`festive` gate) deliberately may play while the page yields, so a grown `celebrate_soft` dims behind the action instead of being cancelled.

### Host props

SVG in the character's artboard space, with the rig's palette and stroke, never taking a pointer or focus: `parachute` (rides with her), `plantPot` (a back layer and a front lip around her), `cheerSign` ("Giỏi lắm!", on a pole to her right or above her head), `umbrella` (with a few drops) and `butterfly` (drawn 1.3 times larger so it reads at the dock size; its path is shared with the gaze steps). Only transform and opacity animate, and every animation is inside `prefers-reduced-motion: no-preference`; a prop that is asked to leave while motion is reduced is retired at once. The butterfly's WAAPI path does not run under reduced motion.

### Migration (the same behaviour, with the differences listed)

- The welcome plays through `WELCOME`; its once-per-session flag, 4 s cap, start gate and input cancel are unchanged. `?mamVariation=<id>` picks the look for a demo or a capture.
- The idle actions keep their 25 to 45 s cadence, the cap of 2 a minute and the QUIET half cadence in `use-mam-idle-actions.ts`; which look plays is `IDLE` (the "never the same twice" rule moved into the orchestrator).
- A celebration asks for `CELEBRATE` with its grade; the hook still owns the reservation, the budget and the bubble. A confirmed save asks for `ENCOURAGE/nod`.
- The stage has its own one-shot channel (`stage:` keys), so the older gates on pokes, drowsing and `point` never judge its commands. The yawn, the wake and a poke take the stage from an idle look; the airplane's own hop and wave do not.
- The 60 s sleep timer keeps its gates and asks for `REST/drowsy_sleep`. Pokes, drag and the summon stay as they were, and tell the orchestrator through `claim`.
- Deliberate differences: an idle look is picked by weight (the butterfly is new and rare) instead of uniformly; an expressive look (not `look_around`, not a REST look) grows her while it plays; `celebrate_soft` is one of them; the stretch, look-around and scratch keep their asset lengths.

### QA trigger

`?mamIntent=<INTENT>` (any case) plays one intent once, 400 ms after the host is ready; `&mamVariation=<id>` forces a look. Every gate still applies and a skipped play is not retried. The dock root carries `data-mam-intent`, `data-mam-variation` and `data-mam-last` (the last look started) for tests and captures.

### Known limits

- The welcome's "never the same twice" holds within a page load; across sessions the look is random.
- `blanket_tuck` uses the rig's own blanket (sleep pose) rather than a separate host prop.
- The dev `?mamIntent=` trigger plays only when the host is calm, so under reduced motion it never reaches the orchestrator; the `skipped: reduced` reason is covered by the unit tests.
