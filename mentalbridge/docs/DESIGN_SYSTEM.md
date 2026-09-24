# MentalBridge UI Foundation

MentalBridge dùng một lớp UI do chính sản phẩm sở hữu. Không dùng một thư viện
component có sẵn làm ngôn ngữ thiết kế. Có thể dùng primitive headless cho hành
vi khó, nhưng màu sắc, typography, khoảng cách, trạng thái và cách ghép màn hình
phải mang ngôn ngữ MentalBridge.

Nguyên tắc cốt lõi: **abstract behavior, not appearance**. Primitive là sàn chất
lượng, không phải trần sáng tạo của feature.

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

## 6. Quy trình bắt buộc cho thay đổi UI

1. **Discover** — đọc token, `components/ui`, `components/motion`, Landing/Auth.
2. **Audit** — ghi nhận hierarchy, primitive trùng, state thiếu, transition gãy,
   responsive và accessibility.
3. **Plan** — tách rõ thay đổi foundation, feature và motion.
4. **Implement** — sửa primitive trước, feature sử dụng primitive sau.
5. **Verify** — desktop/tablet/mobile, keyboard, reduced motion và các trạng thái
   loading/error/empty.
6. **Self-review** — so lại với ngôn ngữ MentalBridge và copy rules trong
   `AGENTS.md`.

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
