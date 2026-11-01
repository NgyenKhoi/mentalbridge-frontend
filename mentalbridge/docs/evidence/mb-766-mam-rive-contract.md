# MB-766 Mầm Rive V1 asset verification

Decision record: [ADR_MAM_RIVE_V1_CONTRACT.md](../ADR_MAM_RIVE_V1_CONTRACT.md).
Verified on 2026-10-27 with Rive CLI 1.7.0 (portable build, signed out). The
rig was copied to a scratch folder, so `creative/mam-rive/` was not modified.
All renders are native CLI headless screenshots. CLI screenshots are opaque:
the rig renders on the CLI clear colour `#1d1d1d`, used here as the dark
proxy, and the capture project adds a `#f1f4eb` fill, which equals `--bg`.
Pixels were measured against the background colour with a tolerance of 15
summed RGB levels.

## Results

| Check                                                          | Result                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rive rig --verify --format=json`                              | PASS: 0 errors, 0 warnings, no problems                                                                                                                                                                                   |
| `rive rig --once`                                              | PASS: 80,826 bytes, SHA-256 `2fbd1dac…53a6`, identical to the existing build                                                                                                                                              |
| Scripts / images / fonts / audio in source                     | none. The artboard has no fill, so it is transparent by structure                                                                                                                                                         |
| `inspect --summary`                                            | 1 artboard, 1 state machine with 3 layers, view model with 7 properties, 15 enum values (12 behaviours and 3 tiers)                                                                                                       |
| 12 behaviours × 72/96/240 px × light/dark                      | PASS: 72 renders, 0 pixels on any frame edge                                                                                                                                                                              |
| Hero trajectory, frames 0–100 every 4 frames, at 512/240/96/72 | PASS at 512/240/96. Geometry stays at least 4 artboard px inside the frame (512: y 4–498, x 48–463). At 72 px, frame 28 has 2 anti-alias pixels on row 0, and no geometry is cut. The contract renders the hero at 240 px |
| Gaze `attentionDirection` −1 / 0 / +1                          | PASS: both pupil edges move exactly −6 / 0 / +6 px at 512 px (left pupil edge x 206 / 212 / 218)                                                                                                                          |
| `celebrate_hero` set without `playOnce`                        | PASS: identical to `idle` (same foreground pixel count and bounding box)                                                                                                                                                  |
| `reducedMotion=true` + hero + `playOnce`                       | PASS: static `rest` pose, no celebration                                                                                                                                                                                  |
| `isVisible=false` (with `happy`)                               | PASS: 0 foreground pixels                                                                                                                                                                                                 |
| One-shot return                                                | PASS: the data dump reads `behaviorState=idle` at 1.3 s (`light_success`), 1.0 s (`celebrate_soft`) and 1.6 s (`celebrate_hero`)                                                                                          |
| Silhouette contrast (hood `#5E877F`)                           | PASS ≥ 3:1. Light theme: 3.60 (`--bg`), 4.00 (`--surface`), 3.41 (`--surface-soft`). Dark theme: 4.59 / 4.20 / 3.72                                                                                                       |
| Web runtime render, splash/watermark                           | NOT_RUN: belongs to MB-767 (release-gate item 1)                                                                                                                                                                          |

## Captures

- [States at 72/96/240 px on light and dark](mb-766-states-sizes.png). Columns:
  idle, curious, listening, thinking, gentle, explaining, happy, sad, rest,
  light_success, celebrate_soft, celebrate_hero. Rows: light 72/96/240, then
  dark 72/96/240.
- [Hero trajectory at 240 px, every 8 frames](mb-766-hero-trajectory-240.png)
- [Gaze −1 / 0 / +1 at 512 px](mb-766-gaze-minus1-0-plus1.png)
- [Control guards](mb-766-control-guards.png): idle, hero fired, hero fired
  with reduced motion, hero without `playOnce`, `isVisible=false`.

## Reproduce

```powershell
$rive = 'D:/mentalbridge/.artifacts/tools/rive/rive.exe'
& $rive <copy-of-rig> --verify --format=json
& $rive <copy-of-rig> --once
& $rive <copy-of-rig> --screenshot=out.png --viewport=240x240 --fit=contain --data=behaviorState=celebrate_hero --data=playOnce=fire --advance=28
& $rive <copy-of-rig> --data-dump=dump.json --data=behaviorState=celebrate_hero --data=playOnce=fire --advance=3s --data-dump-every=6 --data-dump-filter=behaviorState,celebrationTier
```

The measurement scripts are kept with the story's local artifacts. They are not
product code.
