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
