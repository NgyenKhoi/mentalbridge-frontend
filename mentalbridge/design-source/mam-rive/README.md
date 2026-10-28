# Mầm v0.3 — Rive rig

> Nguồn sinh asset, đã đưa vào repo trong MB-767 (bản gốc ở
> `creative/mam-rive/`, nằm ngoài Git). Thư mục này không được Next.js phục vụ.
> Ứng dụng dùng `public/mam/mam-v03.riv`. Hash của file đó được khóa trong
> `docs/ADR_MAM_RIVE_V1_CONTRACT.md`. Nếu đổi `build.mjs`, phải build lại, cập
> nhật hash và làm lại QA hình ảnh. Các lệnh bên dưới chạy trong thư mục gốc
> `creative/mam-rive/`.

Rig Rive dựng lại từ canvas **"Mầm — Character Sheet v0.3"** (file
`source/mam_v03_rive_layers.svg`). Bản này thay phần art 2.5D gradient của
`../mam-companion` (v0.4). Hợp đồng điều khiển giữ nguyên, nên consumer chỉ cần
đổi file `.riv`.

## Xem nhanh

- `states-sheet.png`: 10 trạng thái, render native bằng Rive CLI.
- `hero-strip.png`: các frame của Hero celebrate (frame 4 đến 72).
- `controls-sheet.png`: hero frame 4, rồi hero, soft và light_success sau khi
  tự về idle, light_success đang chạy, reducedMotion, chỉ đặt enum hero mà
  không fire, và isVisible=false (ô trống).
- `rig/build/mam-v03.riv`: bản build unsigned để preview cục bộ.

Preview trực tiếp (PowerShell, trong thư mục này):

```powershell
.\Preview.ps1
.\Preview.ps1 -State curious -AttentionDirection 0.6
.\Preview.ps1 -State celebrate_hero
.\Preview.ps1 -ReducedMotion
```

## Cấu trúc

- Artboard `companion_main`, 512×512, nền trong suốt. Art map từ toạ độ
  canvas: `X = 256 + (x−120)·1.5`, `Y = 256 + (y−101)·1.5`.
- 74 node có tên, pivot đặt đúng khớp xoay: `mam` (chân), `sprout` (gốc cuống),
  `leafL/leafR` (gốc lá), `armL/armR` (vai), `head` (cổ), `body` (đáy thân).
- Biến thể mắt (`open, wide, focus, lookup, soft, sad, happy`), mày
  (`neutral, raised, high, soft, sad, low`), miệng (`smile, gentle, rest, side,
  frown, o, talk, open, big`) và mí (`lidSoft, lidSad`) xếp chồng đúng vị trí.
  Mỗi state chỉ bật biến thể của nó.
- FX: `fxCurious, fxListen, fxThink, thinkRings, fxExplain, fxHappy,
  fxSparkle, fxRing, fxConfetti`, cùng `tear` và `orbDim` (giọt sáng tắt khi buồn).

## Hợp đồng điều khiển (không đổi so với v0.2/v0.4)

State machine `MamBehaviorController`, View Model `MamControls`, instance `Default`.

| Property | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `behaviorState` | enum `idle, curious, listening, thinking, gentle, explaining, light_success, celebrate_soft, celebrate_hero, rest, sad, happy` | Hành vi |
| `attentionDirection` | number −1…1 | Hướng nhìn; đồng tử lệch tối đa 6 px |
| `celebrationTier` | enum `none, soft, hero` | Chọn celebration theo tier |
| `playOnce` | trigger | Phát one-shot đã chọn |
| `returnToDock` | trigger | Ngắt và về idle |
| `reducedMotion` | boolean | Giữ pose tĩnh, chặn celebration |
| `isVisible` | boolean | Ẩn nhân vật và bóng |

Ba layer:

- **Behavior** blend tư thế: 260 ms, riêng `sad` 600 ms theo motion spec.
- **Face** đổi mắt, mày, miệng tức thì (0 ms), để không bị bóng mặt chồng
  khi chuyển state.
- **Attention** điều khiển hướng nhìn.

One-shot (`light_success` 1.2 s, `celebrate_soft` 0.9 s, `celebrate_hero` 1.5 s)
cần chọn behavior hoặc tier rồi fire `playOnce`. Khi xong, asset ghi lại
`behaviorState=idle` và `celebrationTier=none`.

Nhịp chuyển động theo bảng Motion spec của canvas:

- Idle: thở 3.5 s, chớp mắt mỗi 3.5 s, lá đung đưa ±4°.
- Listening: sóng âm 1.2 s.
- Thinking: vòng sáng và 3 chấm nối tiếp, chu kỳ 1.5 s.
- Gentle: thở chậm 4 s.
- Explaining: tay nhấn 2 nhịp mỗi 3 s.
- Hero: nhún lấy đà, bật 16 đơn vị (24 px) có squash/stretch, lá bật 34°,
  vòng sáng và confetti.

## Tái tạo

Không cần npm dependency để build:

```powershell
node build.mjs                      # ghi rig/scene.rml + capture/scene.rml
..\..\.artifacts\tools\rive\rive.exe .\rig --once   # rig/build/mam-v03.riv
node capture.mjs                    # previews/*.png từ project capture (nền kem)
```

`sheet.mjs` và `edge.mjs` chỉ dùng để review. Hai script này cần Sharp qua
`SHARP_MODULE_PATH`.

`edge.mjs` kiểm tra không có pixel nào chạm mép khung. Đã chạy cho hero ở các
frame 4 đến 80, bước 4 frame: 0 pixel chạm mép.

Sửa `build.mjs` rồi chạy lại. Lệnh build ghi đè mọi chỉnh tay trong `scene.rml`.

## Giới hạn

- Đây là `.riv` unsigned để preview cục bộ. Chưa có `.rev` cho Rive Editor, chưa
  publish hay ký, vì các bước đó cần đăng nhập Rive.
- Chưa tích hợp vào web hoặc mobile MentalBridge.
- Miệng `talk` của Explaining là pose tĩnh, chưa có lip-sync hay viseme.
- Chuyến bay rời dock của Hero (~1.4 s) là việc của app. Asset chỉ nhảy tại chỗ.
