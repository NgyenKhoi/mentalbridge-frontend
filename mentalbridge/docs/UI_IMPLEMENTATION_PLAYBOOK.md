# MentalBridge UI implementation playbook

Playbook này biến product contract và design foundation thành quy trình dựng
màn hình có thể lặp lại mà không cần một reviewer AI bên ngoài. Đây không phải
nguồn style thứ ba:

- [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md) quyết định hierarchy,
  journey, dữ liệu và Definition of Done.
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) quyết định token, primitive,
  interaction, motion và accessibility.
- File này quyết định cách thu thập bằng chứng, tự review và bàn giao.

Nếu task mâu thuẫn với accessibility/an toàn hoặc cần invent API, quyền, trạng
thái hay nội dung y tế, dừng và hỏi product owner. Không giải quyết bằng mock
data, copy suy đoán hoặc logic dựa trên đồng hồ client.

## 1. UI brief tối thiểu trước khi code

Ghi brief ngắn ngay trong plan/PR; không cần tạo thêm file cho từng story.

```text
Route và role:
Việc chính người dùng cần hoàn thành:
Primary action theo từng state:
Entry point → route này → destination tiếp theo:
Nguồn dữ liệu/authority đang có:
Ngoài phạm vi (API, business rule, data mới):
Reference screen và điều học từ nó:
Browser viewport nghiệm thu:
```

Brief không đạt nếu chưa trả lời được:

1. Dữ liệu nào là authoritative, dữ liệu nào chỉ để trình bày?
2. Khi API thiếu field, UI ẩn dòng hay có fallback thật nào?
3. Mỗi state có đúng một primary action không?
4. Route trước và sau nhận lại context bằng URL, state hay dữ liệu nào?

## 2. Audit hiện trạng

Trước khi sửa, kiểm tra theo thứ tự:

1. Token trong `app/globals.css`.
2. Primitive trong `components/ui` và `components/motion`.
3. Owning feature, model/helper và targeted tests.
4. Màn tham chiếu phù hợp trong `PRODUCT_EXPERIENCE.md`; học nguyên tắc, không
   sao chép layout/card.
5. API client, validation/OpenAPI và quyền hiện có nếu UI phụ thuộc dữ liệu.

Ghi lại tối đa năm vấn đề có tác động người dùng, phân loại:

- **Blocker:** sai authority/quyền/an toàn, mất chức năng, không thể phục hồi.
- **Major:** hierarchy, responsive, state hoặc accessibility làm flow khó dùng.
- **Minor:** polish không làm sai quyết định hoặc chặn flow.

Chỉ sửa blocker/major nằm trong scope. Minor không được làm phình story.

## 3. Page blueprint

Mọi product page dựng theo thứ tự thông tin, không theo tên component:

```text
Context ngắn
  → trạng thái/đối tượng quan trọng nhất
  → primary action
  → work surface chính
  → context hoặc action phụ
  → history/technical disclosure
```

Quy tắc composition:

- Header gồm eyebrow/context, heading, một dòng mô tả; tối đa một secondary
  action. Không dùng hero trang trí làm đẩy công việc xuống dưới viewport đầu.
- Đối tượng quan trọng nhất có thể dùng surface nổi bật; CTA cùng đích trong
  list phải là secondary.
- List có quan hệ theo thời gian/trạng thái dùng row + divider. Card chỉ dùng
  khi item có boundary/hành vi độc lập.
- Side panel chỉ tồn tại khi cột chính vẫn đọc được. Dùng container query khi
  sidebar/layout cha làm browser breakpoint không phản ánh bề rộng thật.
- DOM order phải là thứ tự đọc/tab. Không dùng CSS `order` để chữa layout.
- Disclosure cùng loại phải cùng vị trí, target và affordance; dùng primitive
  hiện có nếu contract hành vi trùng.

### Pattern cho route quản lý dữ liệu

- Summary/next item đứng trước list nếu nó hỗ trợ quyết định hiện tại.
- Filter dùng mental model người dùng, không phơi toàn bộ backend enum.
- Result count là `role="status"`; đổi filter giữ focus ở control.
- Row đọc theo: đối tượng/thời gian chính → trạng thái → metadata cần quyết định
  → secondary actions → disclosure.
- Metadata chỉ hiện khi có nghĩa trong status hiện tại. Không hiển thị deadline
  đã hết vai trò hoặc field rỗng với placeholder giả.
- Refetch giữ dữ liệu cũ; loading lần đầu mới dùng skeleton gần kích thước thật.

## 4. State matrix bắt buộc

Điền ma trận này cho từng vùng gọi API độc lập. Hai vùng không được làm sập nhau
chỉ vì dùng chung page.

| State                    | Nội dung giữ lại        | Copy cần có                  | Recovery/focus                        |
| ------------------------ | ----------------------- | ---------------------------- | ------------------------------------- |
| Initial loading          | Shell/hierarchy ổn định | Nhãn loading khi cần         | Skeleton không layout shift           |
| Data                     | Dữ liệu authoritative   | Status và action đúng quyền  | Primary action rõ                     |
| Empty source             | Page context            | Vì sao trống + bước đầu tiên | CTA tạo/bắt đầu khi có capability     |
| Empty filter             | Filter + dữ liệu nguồn  | Nhóm này chưa có kết quả     | Xóa/đổi filter                        |
| Partial/dependency error | Dữ liệu vùng còn dùng   | Vùng nào chưa tải được       | Retry tại chỗ, không reset vùng khác  |
| Mutation pending         | Lựa chọn hiện tại       | Đang xử lý                   | Disable đúng command, không khóa page |
| Mutation error           | Input/lựa chọn          | Lỗi nghiệp vụ dễ hiểu        | Retry/sửa tại chỗ, focus gần lỗi      |
| Mutation success         | State mới               | Kết quả thật                 | Update tại chỗ/destination có ích     |
| Stale/version conflict   | Context cũ có nhãn      | Dữ liệu vừa thay đổi         | Refetch/reconcile trước command       |
| Forbidden/permission     | Context an toàn         | Không có quyền làm gì        | Destination hợp lệ nếu có             |

Không thêm permission/error state mà backend không thể tạo; nhưng nếu API hiện
có thể trả về thì phải thiết kế.

## 5. Responsive và density matrix

Đo theo browser viewport. Với app shell, ghi thêm content width thực sau
sidebar và page padding.

| Gate             | Bằng chứng bắt buộc                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| 1440 × 900       | Shell thật; context, trạng thái chính và primary action trước khi cuộn |
| 1280 × 800       | Shell thật; cột phụ không ép cột chính; phần đầu list nhìn thấy        |
| 768px            | Một cột hợp lý; DOM/tab order đúng; không tràn ngang                   |
| 375px            | Touch target, copy dài, action wrap/stack; không mất chức năng         |
| 1280 × 800 @200% | Tương đương 640 × 400 CSS px vẫn dùng được; sticky không che focus     |

Checklist density:

- Heading/mô tả không tạo khoảng trống lớn trước công việc.
- Text đọc dài khoảng 60–75 ký tự mỗi dòng.
- Tên dài, ngày giờ tiếng Việt và trạng thái dài wrap mà không đẩy action ra
  ngoài.
- Fixed widget/toast không che CTA, composer hoặc focus target.
- Không đánh giá desktop bằng một preview bỏ sidebar nếu production có sidebar.

## 6. Action, copy và authority review

Trước khi chốt UI, kiểm tra từng CTA:

| Câu hỏi                                                   | Kết quả cần có                         |
| --------------------------------------------------------- | -------------------------------------- |
| Backend/data hiện tại cho phép action này không?          | Field/status/contract cụ thể           |
| UI có đang suy ra quyền từ time/score/content không?      | Không; chỉ trình bày authority có sẵn  |
| Có CTA cùng đích đang cạnh tranh primary không?           | Chỉ một primary; bản lặp là secondary  |
| Cùng nhãn ở nhiều row có accessible name phân biệt không? | Có người/đối tượng + ngày giờ/ngữ cảnh |
| Mutation phá huỷ có confirm và trả focus không?           | Dùng `ConfirmDialog` hiện có           |
| Copy có hứa capability hoặc kết quả chưa tồn tại không?   | Không                                  |

Status, button, dialog và toast phải dùng cùng thuật ngữ. ID, version, service
name và policy không xuất hiện ngoài `Thông tin kỹ thuật` khi thực sự cần.

## 7. Motion recipe cho product UI

- Page/state entrance tối đa một lần, token tối đa `medium`.
- Filter, refetch và rerender không replay page entrance/stagger.
- Hover chỉ trong `(hover: hover) and (pointer: fine)`.
- Loading loop dừng hoặc thành state tĩnh trong reduced motion.
- Primary feedback dùng copy/icon/border trước; motion chỉ tăng continuity.
- Không dùng GSAP cho product page thông thường. Không thêm scale + glow +
  shadow + rotation cho một control.

## 8. Tự review bằng bằng chứng

### Behavior

- Test helper/model cho mapping status, filter, next item và authority.
- Component test cho accessible name/href, focus, state độc lập và mutation quan
  trọng.
- Test lỗi của từng dependency riêng để chứng minh partial page vẫn dùng được.
- Không sửa test chỉ để khớp DOM; assert outcome người dùng nhìn thấy.

### Visual

Chụp bằng fixture đã sanitize hoặc môi trường local được phép. Mỗi ảnh ghi:

```text
Route · role · state · browser viewport · content width · zoom · data source
```

Tự review theo thứ tự:

1. Đúng một primary action?
2. Trong năm giây có hiểu trạng thái và bước tiếp theo?
3. Có card/border nào không tạo boundary thật?
4. Text phụ đạt contrast, target đạt 44px, focus không bị che?
5. Ngày giờ/tên dài có lặp, wrap xấu hoặc gây tràn?
6. Loading/empty/error có giữ hierarchy và recovery?
7. Motion/reduced motion có làm thay đổi khả năng thao tác?

Reviewer bên ngoài, kể cả Claude, chỉ là advisory tùy chọn. Không cần reviewer
AI để đạt DoD nếu bằng chứng local và CI bên dưới đầy đủ.

## 9. Handoff template

```text
Outcome:
- Người dùng giờ làm được gì rõ hơn?

Authority/scope:
- API/business logic giữ nguyên hay thay đổi ở đâu?
- Có inference/capability nào đã loại bỏ không?

States verified:
- data / initial loading / source empty / filter empty / partial error /
  mutation pending-error-success / stale-permission nếu áp dụng

Responsive evidence:
- 1440×900 (content width ...), 1280×800 (...), 768, 375, 200% zoom

Accessibility:
- keyboard/focus, target, contrast, live status, reduced motion

Automated evidence:
- targeted tests, lint, typecheck, production build

Known limits/follow-up:
- Chỉ ghi điều có căn cứ; không biến minor polish thành blocker.
```

Chỉ gọi màn hình “converged” khi Definition of Done trong
`PRODUCT_EXPERIENCE.md` và evidence trên đều hoàn tất.
