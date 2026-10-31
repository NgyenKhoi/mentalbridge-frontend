# MB-781: Mầm dock host loaded dynamically

MB-775 finding 1 recorded that `app/providers.tsx` imported `MamDock` statically,
so the dock host, its character renderer and the reward watcher shipped in the
shared root bundle on every route, even with `MAM_WEB_ENABLED=false`. MB-781
splits them out. Web only; no backend, contract, dependency or flag change.

## What changed

- `features/mam/MamDock.tsx` is now a light gate. It keeps the root mount, the
  slot store and the route allowlist, and loads `MamDockHost` with `React.lazy`
  only when a USER layout slot is mounted on a dock route. Flag-off pages and
  undocked routes never request the host chunk.
- `features/mam/MamDockHost.tsx` is the previous host, moved unchanged.
- The bottom clearance (104 px, 96 px at 900 px and below) moved to
  `MamDockSpace.module.css`. The gate renders a hidden marker for it, so the space
  appears at the same moment as before and does not wait for the chunk.
- A host chunk that fails to load resolves to an empty component: no dock, no
  error screen, no retry from the app. Card-level Mầm buttons become
  `aria-disabled`, as they already are while Mầm is suppressed.
- Reward reads that arrive while the host is still loading are kept in order,
  each with the account of the USER layout signed in when it landed, and handed
  once to that account's host (`mam-celebrations.ts`). The first read stays the
  baseline, so an award earned during the load still plays. A read that lands
  with no USER layout is dropped. When another account's layout mounts, the
  award session ends (`MamDockSlot.tsx`), so a read still in flight for the
  previous account is dropped by the existing session check even if no host
  ever loaded.
- The latest card-button press made while the host loads is answered once it
  listens (`mam-summon-request.ts`). It is dropped if Mầm turns suppressed or
  hidden meanwhile, the route changes, the card leaves, or the host starts
  disabled. It is taken only after the host's subscription survives a
  StrictMode effect replay.

## Bundle, same base and command

Base `4dfe57c6` (clean HEAD) against the same base plus MB-781. One production
standalone build per version, restarted with the flag `false` and `true`.
Chromium 153 headless, 1440x900, a cold context for each route and flag, one run
per cell. The value is the encoded Script transfer (CDP) through load or
character ready, a 2 s settle and a 1 s idle. Commands and raw files are in the
workspace artifacts `mb-781-bundle-before.md` and `mb-781-bundle-after.md`.

| Route                   | Off before | Off after | Off change | On before | On after | On change |
| ----------------------- | ---------: | --------: | ---------: | --------: | -------: | --------: |
| `/dashboard`            |    276,632 |   262,559 |    −14,073 |   332,192 |  339,903 |    +7,711 |
| `/achievements`         |    252,238 |   193,084 |    −59,154 |   307,798 |  315,375 |    +7,577 |
| `/support-guides`       |    260,785 |   196,523 |    −64,262 |   316,345 |  318,814 |    +2,469 |
| `/support-guides/:id`   |    260,865 |   196,603 |    −64,262 |   316,425 |  318,894 |    +2,469 |
| `/journal`              |    274,356 |   210,010 |    −64,346 |   329,916 |  332,301 |    +2,385 |
| `/resources`            |    277,877 |   263,816 |    −14,061 |   333,437 |  341,160 |    +7,723 |
| `/resources/:id`        |    321,977 |   304,293 |    −17,684 |   377,537 |  381,637 |    +4,100 |
| `/support-plan`         |    308,709 |   296,184 |    −12,525 |   364,269 |  373,528 |    +9,259 |
| `/assessment/anonymous` |    249,050 |   228,223 |    −20,827 |   249,050 |  228,223 |   −20,827 |

- Flag off: the host chunk is requested 0 times on every route (before: once on
  every route). JS transfer falls on every route, including the undocked
  control. The larger drops on Achievements, Support Guides and Journal also
  remove shared modules (such as the dock's animation library) that those pages
  do not use themselves.
- Flag on: one more script request (the host chunk) and 2.4 to 9.3 KB more
  transfer per dock route, from the split itself. Behaviour is unchanged.
- Rive runtime, `.riv`, `.wasm` and `/mam/*` assets were already absent with the
  flag off; MB-781 claims no saving there. Reward event and preference helpers
  that pages import themselves still ship with those pages.
- Same-build drill, one tab: on, turn "Mầm tự lên tiếng" off, hide and reduce
  motion, restart off (no dock, no `/mam` request), restart on: hide, motion
  and mute are still stored, and after showing Mầm both switches read off.

## Visual parity

The same capture harness ran on clean HEAD (before) and on the change (after),
at 1440x900, 1280x800, 768x1024 and 375x812:

- with the flag on: dashboard, achievements, a support guide, resources list
  and detail, SupportPlan and journal ready, plus dashboard menu open, hidden
  handle, reduced motion, and the journal editor;
- with the flag off: dashboard, resources, SupportPlan and journal;
- undocked `/assessment/anonymous` and `/login`, with both flag values.

That is 76 captures in all. The dock, content and page geometry (dock box,
content box and padding, scroll height) match exactly on all 76. Remaining pixel
differences are all outside the dock and also appear with the flag off: the
wall-clock greeting on the dashboard, the journal entry time, the animated
artwork on Resources cards, and sub-pixel anti-aliasing under the journal
dialog. The Rive canvas is masked in the pixel comparison because its frames
depend on time; its box is part of the geometry check.

## Tests

| Check                                      | Result                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/mam/MamDock.lazy.test.tsx` (new) | Off, no slot and undocked never import the host; space reserved while pending; failure is silent, no retry, card button inert                                                                                                  |
| `use-mam-celebrations.test.tsx`            | A read before the host listens is heard once; a baseline then an award earned while loading still plays; account A's buffered or in-flight read never reaches B; a heard read is never handed again                            |
| `MamSummon.test.tsx`                       | A card press made while the host loads is answered once, also under StrictMode; one followed by a dirty-form cycle is dropped                                                                                                  |
| `mam-gate.spec.ts`                         | Held host chunk: page usable, Help Now and CTA boxes and the 104 px clearance unchanged on ready. Failed chunk: no dock, no page error, no route error, last action clickable, at most 2 loader attempts and no more after 3 s |
| `mam-flag-off.spec.ts`                     | All eight dock route forms attempt no request, of any outcome, for a host, character or Rive chunk (found by content in the build; the failed-chunk gate test checks the detector catches a failed request)                    |

The failed-chunk check sees two requests for the chunk before the import
rejects. They come from the bundler's chunk loader; the app does not retry.

Final review also serializes live owner reads behind buffered replay, so a
newer read cannot be overtaken while the account lock is busy. A deterministic
delayed-lock regression failed before that correction and passes afterward.
The account-switch regression uses a nonempty earned in-flight response.
The bundle and preference measurements above retain their recorded snapshot;
these final delivery corrections were verified separately.

Existing suites that summon by gesture (`mam-summon`, `mam-resource-cards`) now
wait for the dock before the gesture, as their sibling tests already did. The
right-click placement test in `mam-resource-cards.spec.ts` now scrolls the whole
card into view first. It had passed only when the dock briefly intercepted the
first scroll.
