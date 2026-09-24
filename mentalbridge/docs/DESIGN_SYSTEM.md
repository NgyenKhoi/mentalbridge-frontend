# MentalBridge UI Foundation

MentalBridge dùng một lớp UI do chính sản phẩm sở hữu. Không dùng một thư viện
component có sẵn làm ngôn ngữ thiết kế. Có thể dùng primitive headless cho hành
vi khó, nhưng màu sắc, typography, khoảng cách, trạng thái và cách ghép màn hình
phải mang ngôn ngữ MentalBridge.

Nguyên tắc cốt lõi: **abstract behavior, not appearance**. Primitive là sàn chất
lượng, không phải trần sáng tạo của feature.

## 0. Phạm vi và nguồn sự thật

Tài liệu này cô đọng foundation bền vững, không phải cổng bắt buộc duy nhất cho
mọi thay đổi UI và cũng không phải catalog của từng animation. Bắt đầu từ
[`README.md`](README.md) để chọn tài liệu đúng với task.

Thứ tự ưu tiên khi triển khai:

1. Hành vi người dùng và yêu cầu của task.
2. Token và primitive đang chạy trong `app/globals.css`, `components/ui`,
   `components/motion` và `lib/animations/config.ts`.
3. Contract bền vững trong tài liệu này.
4. Tài liệu animation lịch sử, prompt và changelog chỉ dùng để hiểu ngữ cảnh.

`CLAUDE.md` chỉ chuyển tiếp đến `AGENTS.md`. Các file `ANIMATION_*`,
`ANIMATIONS_README.md` và `GSAP_PROMPT.md` không tự động trở thành quy chuẩn chỉ
vì có ví dụ code hoặc nhãn “production ready”.

## 1. Ngôn ngữ thiết kế

- Bình tĩnh, ấm áp, gần gũi và có cảm giác con người.
- Hình học mềm, khoảng trắng có chủ đích, chiều sâu nhẹ.
- Fraunces dùng cho tiêu đề mang tính biên tập; Be Vietnam Pro dùng cho nội dung
  và điều khiển.
- Teal là màu nhận diện. Amber/terracotta chỉ nhấn thông tin cần chú ý; màu không
  được là tín hiệu duy nhất.
- Product UI ưu tiên liên tục và phản hồi rõ ràng. Marketing UI mới được biểu
  đạt mạnh hơn.
- Không biến toàn bộ màn hình thành một lưới các card có viền giống nhau. Dùng
  typography, spacing, alignment và surface để tạo phân cấp trước khi thêm viền.

Landing và Auth là tham chiếu về chất lượng thương hiệu; các token trong
`app/globals.css` là nguồn sự thật khi triển khai.

## 2. Token contract

Không tự tạo duration, easing, radius, shadow hoặc spacing mới trong feature nếu
token hiện có đáp ứng được.

```css
/* Spacing: nhịp 4/8px */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* Shape and depth */
--radius-control: 12px;
--radius-panel: 18px;
--radius-shell: 22px;
--radius-pill: 999px;
--elevation-1: 0 14px 36px -30px rgba(30, 74, 67, 0.42);
--elevation-2: 0 18px 44px -32px rgba(30, 74, 67, 0.5);

/* Motion */
--motion-instant: 120ms;
--motion-fast: 160ms;
--motion-base: 220ms;
--motion-medium: 300ms;
--motion-slow: 480ms;
--ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
--ease-emphasis: cubic-bezier(0.34, 1.56, 0.64, 1);
```

Giữ palette hiện tại: `--bg`, `--surface`, `--ink`, `--ink-soft`, `--teal-*`,
`--amber-*`, `--terracotta-*`, `--line`. Không tạo palette riêng cho từng màn.

## 3. Kiến trúc component

`components/ui` chứa primitive hành vi dùng lại trong product:

- `Dialog`: focus trap của platform, Escape, backdrop, khôi phục focus, motion và
  reduced motion.
- `Disclosure`: semantic `details/summary`, target đủ lớn, chevron và motion.
- `Skeleton`: loading ổn định về bố cục và tôn trọng reduced motion.
- Các primitive tiếp theo chỉ được thêm khi có hành vi lặp thực sự: Button,
  Select, Tabs, Toast, Checkbox, Radio, Switch, TextField, TextArea.

Không tạo `Card`, `Container`, `Stack` chung chỉ để gom CSS. Assessment result,
Support evaluation và Support plan là feature composition; chúng được quyền có
bố cục và cách kể chuyện riêng trong khi dùng chung foundation.

Trước khi tạo control mới:

1. Tìm trong `components/ui`.
2. Tìm trong `components/motion`.
3. Tìm implementation tương tự ở feature khác.
4. Mở rộng primitive hiện có nếu contract hành vi giống nhau.

## 4. Interaction và motion contract

Mọi điều khiển phải xét default, hover, focus-visible, pressed, disabled,
loading, selected/open và error khi phù hợp. Target chính tối thiểu 44 × 44px;
body text trên mobile ưu tiên từ 16px.

| Interaction | Enter                   | Exit              | Token gợi ý    |
| ----------- | ----------------------- | ----------------- | -------------- |
| Tooltip     | fade + y 4              | fade              | instant–fast   |
| Dropdown    | fade + y -4 + scale .98 | reverse           | fast–base      |
| Disclosure  | content fade + y -4     | immediate/native  | base           |
| Dialog      | fade + y 8 + scale .98  | reverse nhanh hơn | base / instant |
| Page state  | fade + y 8              | fade              | base–medium    |
| List item   | fade + y 6              | fade              | fast–base      |

- Motion diễn đạt quan hệ nhân quả và sự liên tục, không dùng để trang trí.
- Ưu tiên `transform` và `opacity`; không làm input bị chặn trong lúc animation.
- Exit nhanh hơn enter khoảng 15–25%.
- Không kết hợp scale + glow + shadow + rotation trên control thông thường.
- GSAP chỉ dành cho landing/storytelling hoặc sequence phức tạp.
- `prefers-reduced-motion` phải bỏ chuyển động lớn, bounce và parallax.

### 4.1 Chọn công cụ theo phạm vi

| Nhu cầu | Công cụ ưu tiên |
| ------- | --------------- |
| Hover, focus, pressed, màu, opacity hoặc transform đơn giản của một control | CSS transition/keyframe dùng motion token |
| Mount/unmount, dialog, list/page state và transition gắn với state React | Primitive hiện có hoặc Framer Motion |
| Timeline nhiều bước, scroll choreography, scrub, pin hoặc parallax của landing/storytelling | GSAP + ScrollTrigger |
| Smooth scrolling | `useLenis` trên route đã được cho phép trong `PUBLIC_SMOOTH_ROUTES` |

Không thêm GSAP cho một fade/slide đơn giản và không thêm Framer Motion nếu CSS
đã diễn đạt đủ. Product page dùng chuyển động ngắn, nhẹ và có ích cho việc hiểu
state; bounce, 3D tilt, glow liên tục và parallax chỉ phù hợp khi ngữ cảnh thương
hiệu thực sự cần chúng.

### 4.2 Ownership và lifecycle

- Một DOM layer chỉ có một owner của `transform`. Khi GSAP reveal và Framer
  Motion hover cùng tồn tại, dùng wrapper riêng như contract của `TiltCard`.
- Scope selector vào root/ref của component. Dùng `gsap.context()` hoặc timeline
  do component sở hữu và `revert()`/`kill()` đúng scope khi unmount. Không gọi
  `ScrollTrigger.getAll().forEach(kill)` vì sẽ phá animation của feature khác.
- Đăng ký plugin trong client boundary. Dynamic import phải có cờ disposed hoặc
  cleanup tương đương để callback đến muộn không gắn listener sau khi unmount.
- Listener, `requestAnimationFrame`, timer, tween, timeline và subscription phải
  được dọn bởi chính component đã tạo chúng.
- `ScrollTrigger.refresh()` chỉ chạy sau thay đổi layout thực sự như font, ảnh,
  dữ liệu động hoặc preloader; không refresh liên tục trong render/scroll.
- Lenis và ScrollTrigger phải dùng chung vòng cập nhật qua `useLenis`; không tạo
  một smooth-scroll instance riêng trong feature.

### 4.3 Progressive enhancement và reduced motion

- Nội dung phải đọc và thao tác được nếu JavaScript hoặc animation không chạy.
  Không để content mặc định `opacity: 0` mà thiếu no-JS/reduced-motion fallback.
- Với reduced motion, hiển thị ngay trạng thái cuối; bỏ scrub, parallax, pointer
  follower, smooth scrolling, chuyển động lớn và loop trang trí. Giữ feedback
  không chuyển động bằng màu, border, icon hoặc thay đổi nội dung.
- CSS dùng `@media (prefers-reduced-motion: reduce)`; React dùng
  `useReducedMotion`/`MotionConfig`; GSAP dùng `gsap.matchMedia()` hoặc kiểm tra
  media query trước khi tạo timeline.
- Hover phụ thuộc con trỏ chỉ chạy với `(hover: hover) and (pointer: fine)`;
  touch và keyboard không được mất chức năng hoặc focus feedback.

### 4.4 Hiệu năng và nhịp chuyển động

- Ưu tiên `transform` và `opacity`; tránh animate layout, blur/filter lớn hoặc
  shadow nặng trên nhiều phần tử cùng lúc.
- `will-change` chỉ dùng cho phần tử thật sự chuyển động và nên được giải phóng
  khi animation kết thúc; không phủ toàn trang để “đảm bảo 60 FPS”.
- Dùng token CSS cho microinteraction. Landing sequence dùng giá trị chung trong
  `lib/animations/config.ts`; không tạo duration/easing riêng trong từng feature.
- Stagger phải có giới hạn để item cuối không xuất hiện quá muộn. Async data và
  thao tác chính không được chờ animation mới dùng được.
- “60 FPS”, “không memory leak” hay “production ready” chỉ được ghi nhận sau khi
  đo trên flow và thiết bị mục tiêu; không suy ra từ việc dùng GSAP/GPU.

## 5. Accessibility và responsive contract

- Semantic HTML trước, ARIA chỉ bổ sung khi cần.
- Focus ring nhìn thấy rõ trên mọi control và không bị sticky UI che.
- Dialog có Escape, focus containment và trả focus về trigger.
- Icon trang trí cạnh text có `aria-hidden`; icon-only control có accessible name.
- Error nói rõ vấn đề và đường phục hồi, đặt gần nơi xảy ra.
- Empty state giải thích bước tiếp theo, không để vùng trống.
- Kiểm tra tối thiểu ở 375px, 768px, 1280px và 1440px.
- Mobile cần xét lại thứ tự thông tin; không chỉ xếp dọc desktop một cách máy móc.
- Nội dung dài giới hạn khoảng 60–75 ký tự mỗi dòng ở desktop và cho phép
  `overflow-wrap: anywhere` với ID/URL.

## 6. Quy trình áp dụng cho thay đổi UI

1. **Discover** — đọc token, `components/ui`, `components/motion`, Landing/Auth.
2. **Audit** — ghi nhận hierarchy, primitive trùng, state thiếu, transition gãy,
   responsive và accessibility.
3. **Plan** — tách rõ thay đổi foundation, feature và motion.
4. **Implement** — sửa primitive trước, feature sử dụng primitive sau.
5. **Verify** — desktop/tablet/mobile, keyboard, reduced motion và các trạng thái
   loading/error/empty.
6. **Self-review** — so lại với ngôn ngữ MentalBridge và copy rules trong
   `AGENTS.md`.

Với task nhỏ, các bước có thể ngắn và thực hiện liền nhau; không cần biến thành
một tài liệu kế hoạch riêng. Điều bắt buộc là đã kiểm tra đúng tác động, không
phải đã đọc toàn bộ design system hoặc toàn bộ tài liệu animation.

### Kiểm thử motion theo tác động

- Kiểm tra trạng thái đầu/cuối, nội dung async, điều hướng đi-về và mount/unmount;
  không chỉ xem entrance lần đầu.
- Bật reduced motion ở hệ điều hành/devtools và xác nhận toàn bộ nội dung hiện
  ngay, focus/keyboard vẫn hoạt động, không còn scrub/parallax/loop lớn.
- Kiểm tra touch/coarse pointer và các mốc 375px, 768px, 1280px, 1440px.
- Dùng Performance panel khi thay đổi choreography hoặc scroll; tìm long task,
  layout shift và frame drop thay vì dựa vào cảm giác.
- Kiểm tra console/hydration error và xác nhận selector/ref vẫn tồn tại trong
  code hiện tại trước khi dùng các script trong `DEBUG_ANIMATIONS.md`.
- Chạy lint, typecheck và targeted test theo phạm vi. Visual review là bằng chứng
  bổ sung, không thay thế kiểm tra hành vi.

## 7. Definition of Done

- [ ] Thuộc cùng ngôn ngữ MentalBridge, không sinh palette/style riêng.
- [ ] Đã tìm và tái sử dụng primitive hiện có.
- [ ] Có hover, focus-visible, pressed, disabled và loading phù hợp.
- [ ] Có empty/error state và đường phục hồi.
- [ ] Keyboard và reduced motion hoạt động.
- [ ] Đã kiểm tra mobile, tablet, desktop; không có horizontal overflow.
- [ ] Không layout shift đáng kể khi đổi state.
- [ ] Không lộ service name, policy/version/ID ngoài `Thông tin kỹ thuật`.
- [ ] Build, typecheck và targeted tests chạy qua; visual review được ghi nhận.

Khi cần catalog trực quan, ưu tiên route nội bộ `/dev/ui` trước khi thêm Storybook
và dependency mới. Chỉ mở rộng foundation sau khi một feature thật chứng minh
nhu cầu.
