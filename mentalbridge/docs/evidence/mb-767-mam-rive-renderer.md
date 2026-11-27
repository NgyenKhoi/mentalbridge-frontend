# MB-767 Mầm Rive renderer evidence

Contract: [ADR_MAM_RIVE_V1_CONTRACT.md](../ADR_MAM_RIVE_V1_CONTRACT.md).

MB-767 adds three pieces:

- `features/mam/MamCharacter.tsx`: a decorative renderer that loads lazily.
- `features/mam/mam-controls.ts`: the typed `MamControls` adapter.
- `features/mam/mam-contract.ts`: the frozen asset, enum and view-model names.

No product route mounts the renderer yet; the dock comes in MB-768. Verified on
2026-10-27.

## Runtime and assets

| Item                     | Value                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Runtime                  | `@rive-app/canvas-lite` 2.47.1 (MIT), exact pin, loaded only by dynamic `import()`                        |
| WASM                     | `public/mam/rive-lite-2.47.1.wasm`: 807,566 bytes, 331 KB gzip. Self-hosted; the CDN fallback is disabled |
| Rig                      | `public/mam/mam-v03.riv`: 80,826 bytes, SHA-256 `2fbd1dac…53a6`                                           |
| Static fallback          | `public/mam/mam-v03-idle.svg`: 10,935 bytes, viewBox aligned to the 512 artboard                          |
| Runtime JS (lazy chunk)  | about 120 KB gzip                                                                                         |
| Own source               | 11.5 KB, 4 KB gzip                                                                                        |
| Initial route bundles    | Unchanged. No production chunk contains the renderer or the runtime                                       |
| Requests for 8 instances | 1 rig and 1 WASM. The runtime and the bytes are cached per page                                           |

The full `@rive-app/canvas` runtime was measured first: its WASM is 898 KB
gzip. `canvas-lite` renders this asset the same way. The mean pixel difference
over the seven looping states was 0.1/255. Hero frames differ only by capture
timing.

## Real-runtime results (Chromium, Vite harness `tests/mam-harness/`)

| Check                                                | Result                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Seven looping states plus the hero cell              | PASS: all `ready`, no console errors                                                                                                        |
| Rive splash or watermark (release-gate item 1)       | PASS: none at 50, 250 or 600 ms after load, or when ready                                                                                   |
| Requests outside the app origin                      | PASS: none in any run, including both failure runs                                                                                          |
| `celebrate_hero` fired                               | PASS: plays, then returns to idle by 2.5 s                                                                                                  |
| Hero enum set without `playOnce`                     | PASS: the asset stays idle (MB-766 CLI guard capture). The adapter never sets a one-shot enum without the trigger (`mam-controls.test.ts`)  |
| Re-render with the same one-shot key                 | PASS: no replay. An older key after a different one (A, B, A) fires again, as documented (component tests)                                  |
| New looping state while a hero runs                  | PASS: the hero is interrupted with `returnToDock`. The pose matches `thinking` 2.5 s later (mean diff 0.7, against 17.8 for the hero frame) |
| OS reduced motion and hero fired                     | PASS: the static pose stays and no celebration plays                                                                                        |
| OS reduced motion switched on after ready, then hero | PASS: no celebration (frame diff 0); `data-mam-reduced="true"`                                                                              |
| User motion setting with OS motion allowed           | PASS: canvas `transition-duration: 0s`                                                                                                      |
| Canvas `contextlost` after ready                     | PASS: status `fallback`, static pose visible                                                                                                |
| `visible=false`                                      | PASS: empty cell                                                                                                                            |
| Rig request blocked                                  | PASS: all 8 instances fall back to the static pose                                                                                          |
| WASM request blocked                                 | PASS: all 8 instances fall back to the static pose                                                                                          |
| Fallback-to-canvas swap (rig delayed 1.5 s)          | PASS: the character is steady from 0 to 320 ms after ready, with no blink                                                                   |

## Automated checks

- Unit and component tests: `features/mam/*.test.ts(x)`, 29 tests. They cover:
  - the contract guards;
  - one-shot gating and key semantics;
  - interrupting a running one-shot, and restoring the host state after the
    asset writes `idle`;
  - live reduced-motion changes and the user's motion setting;
  - loss of the canvas context before or after load;
  - reading values back from the asset;
  - the CDN-free loader;
  - one download per page and a retry after a failure;
  - every fallback path;
  - unmounting while loading;
  - the committed rig and WASM hashes against the installed runtime.
- Full suite after the round-1 fixes: 299 files and 2,126 tests pass. `format:check`, `lint`,
  `typecheck`, `companion:budget` and `build` all pass.

## Captures

- [Seven looping states, ready](mb-767-states-ready.png)
- Hero, hidden and reduced-motion frames:
  [mb-767-hero-hidden-reduced.png](mb-767-hero-hidden-reduced.png). The frames
  in order are: before, 0, 120, 300, 600 and 1000 ms, after, hidden, then
  reduced motion before and at 300 ms.
- [Fallback-to-canvas swap at 0–320 ms](mb-767-fallback-swap.png)
- [WASM blocked, static fallback](mb-767-fallback-wasm-blocked.png)
