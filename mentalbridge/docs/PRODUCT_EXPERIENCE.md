# MentalBridge product experience contract

Tài liệu này giữ trải nghiệm xuyên suốt giữa các route.
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) quy định ngôn ngữ thị giác và primitive;
tài liệu này quy định người dùng nhìn thấy gì, hiểu gì và đi tiếp như thế nào.
Không dùng tài liệu này để invent API, dữ liệu hoặc quyền mà backend chưa cung
cấp.

## 1. Mục tiêu và thứ tự ưu tiên

MentalBridge phải cho cảm giác là một sản phẩm thống nhất, bình tĩnh và đáng tin,
không phải tập hợp các màn được dựng độc lập theo từng story.

Viewport nghiệm thu chính, đo theo browser viewport trong DevTools sau khi đã
trừ browser chrome và scrollbar:

1. Desktop 1440 × 900.
2. Laptop 1280 × 800.
3. Tablet 768px và mobile 375px là regression gate: không mất chức năng, không
   tràn ngang và vẫn thao tác được bằng bàn phím/touch.

Hai journey ưu tiên:

1. `Assessment → Support guide → Support plan → Resources → Analytics`.
2. Appointment, Summary và phiên chat theo sơ đồ canonical ở mục 5.

Một thay đổi trên route trong hai journey này phải được review trong ngữ cảnh
toàn journey, không chỉ bằng screenshot của một component.

## 2. Màn tham chiếu và điều cần học

Các màn tham chiếu là chuẩn chất lượng, không phải nguồn mock data hoặc template
để sao chép nguyên xi.

| Màn tham chiếu         | Điều cần giữ                                                                                      | Không sao chép                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Landing page           | Chất thương hiệu, typography biên tập, khoảng trắng có chủ đích và motion kể chuyện có kiểm soát. | Parallax, cursor follower hoặc scroll choreography vào product flow. |
| User Dashboard         | Tổng quan có phân cấp, CTA rõ, dữ liệu nhiều loại nhưng vẫn đọc được theo một nhịp.               | Mọi section/card nếu route chỉ có một nhiệm vụ chính.                |
| `/specialist/clients`  | Work surface giàu dữ liệu, master-detail rõ ràng, quyền truy cập nằm đúng ngữ cảnh.               | Mật độ hoặc dữ liệu chuyên gia sang màn người dùng.                  |
| `/specialist/earnings` | KPI, biểu đồ và bảng phối hợp thành một câu chuyện thay vì các card rời rạc.                      | Chart/KPI trang trí khi không có câu hỏi dữ liệu thật.               |

Không mang parallax, cursor follower hoặc choreography của Landing vào product
flow. Không sao chép mật độ dữ liệu của workspace chuyên gia vào màn dành cho
người dùng nếu nó không hỗ trợ quyết định hiện tại.

## 3. Contract chung cho product page

Mỗi viewport đầu tiên phải trả lời được bốn câu hỏi theo thứ tự:

1. Tôi đang ở đâu trong hành trình?
2. Dữ liệu hoặc trạng thái quan trọng nhất là gì?
3. Tôi nên làm gì tiếp theo?
4. Nếu chưa thể tiếp tục, vì sao và tôi có thể phục hồi thế nào?

### PX-01 — Một nhiệm vụ chính

- Mỗi page/state có một primary action nổi bật.
- Secondary action không cạnh tranh màu sắc, kích thước hoặc vị trí với primary.
- Không lặp cùng CTA ở header, card và footer nếu chúng dẫn đến cùng kết quả.
- Ngoại lệ an toàn chỉ kích hoạt khi một field/contract backend hiện có báo cần
  hỗ trợ an toàn. Khi đó, khối hỗ trợ an toàn đứng ở vị trí ưu tiên cao nhất và
  không bị tính là primary action thứ hai. UI không tự suy diễn tín hiệu từ điểm
  sàng lọc, nội dung nhật ký, chart, thời gian hoặc hành vi sử dụng; không có
  signal authoritative thì không hiển thị và không tự tạo field/state mới.
- Nội dung và liên kết an toàn phải là nội dung đã được product/clinical owner
  duyệt, không phụ thuộc toast, animation hoặc riêng màu sắc.

### PX-02 — Phân cấp trước, card sau

- Tạo hierarchy bằng heading, spacing, alignment và surface trước khi thêm border.
- Chỉ dùng card khi nội dung có boundary hoặc hành vi riêng.
- Tránh lưới nhiều card đồng hạng khi một section, timeline, list hoặc chart sẽ
  truyền đạt quan hệ tốt hơn.

### PX-03 — Dữ liệu thật và trạng thái thật

- Không dùng số liệu mẫu hoặc ngày giờ giả trên product route. Trạng thái kết
  nối chỉ được hiển thị khi phản ánh kết nối thật.
- Loading, empty, partial, error, permission denied và stale data là các state
  thiết kế bắt buộc khi API có thể tạo ra chúng.
- Lỗi phải giữ lại dữ liệu/ngữ cảnh an toàn và đưa ra hành động phục hồi tại chỗ.
- `Thông tin kỹ thuật` là disclosure đóng mặc định dành cho ID/version/audit
  thực sự hữu ích; không dùng làm nơi đẩy mọi copy khó hiểu khỏi màn chính.

### PX-04 — Liên tục giữa các route

- Route sau phải giải thích nó nhận được gì từ bước trước và bước tiếp theo là gì.
- Giữ tên đối tượng, trạng thái và quyết định của người dùng nhất quán; không đổi
  thuật ngữ giữa page, dialog và toast.
- Sau mutation thành công, cập nhật state tại chỗ hoặc điều hướng đến destination
  có giá trị; không trả người dùng về một màn không liên quan.

### PX-05 — Độ rộng và mật độ

- Nội dung chính dùng chiều rộng đủ cho nhiệm vụ, không kéo đoạn văn dài kín màn.
- Form/reading surface ưu tiên khoảng 60–75 ký tự mỗi dòng.
- Dashboard, chart và master-detail được phép rộng hơn nhưng cột chính luôn có
  `min-width: 0`; panel phụ không được làm nội dung chính quá hẹp.
- Phần quan trọng của laptop 1280 × 800 phải nhìn thấy mà không cần cuộn qua một
  hero trang trí lớn.

### PX-06 — Biểu đồ có câu hỏi rõ ràng

Chỉ dùng chart khi người dùng cần so sánh, nhìn xu hướng, tỷ lệ hoặc nhịp theo
thời gian. Mỗi chart phải có:

- tiêu đề nêu câu hỏi hoặc insight;
- khoảng thời gian và đơn vị;
- text summary cho insight chính;
- legend/label không dựa riêng vào màu;
- empty/partial state trung thực;
- mô tả hoặc bảng thay thế đủ dùng cho screen reader, gồm khoảng thời gian, đơn
  vị và các giá trị cần thiết để hiểu insight mà không nhìn chart.

Không biến một con số đơn thành chart và không thêm chart chỉ để làm màn hình
“đa dạng”.

## 4. Journey 1 — Từ sàng lọc đến theo dõi

```text
Assessment → Support guide → Support plan → Resources → Analytics
```

### J1-01 — Assessment

- Ưu tiên tiếp tục/bắt đầu bài phù hợp và cho biết thời gian, phạm vi dữ liệu.
- Kết quả gần nhất và lịch sử là ngữ cảnh thứ cấp, không lấn át bài đang làm.
- Sau khi hoàn thành, giải thích kết quả bằng ngôn ngữ mô tả và đưa một CTA rõ
  sang gợi ý hỗ trợ.

### J1-02 — Support guide

- Cho biết gợi ý dựa trên bài sàng lọc nào bằng tên và ngày, cùng dữ liệu nào
  thực sự được dùng. ID/version chỉ nằm trong `Thông tin kỹ thuật` khi cần audit.
- Nhóm nội dung theo nhu cầu/hành động, không tạo một wall of cards đồng hạng.
- Quyết định chọn/bỏ qua phải còn rõ khi sang bước lập kế hoạch.

### J1-03 — Support plan

- Đầu trang ưu tiên “hôm nay/tiếp theo”, tiến độ và hành động cần làm.
- Chi tiết kế hoạch, lịch sử và thay đổi phiên bản nằm sau context hiện tại.
- Các trạng thái đề xuất, chấp nhận, từ chối, thay thế và hết hạn phải nói rõ
  điều gì thay đổi và điều gì vẫn giữ nguyên.

### J1-04 — Resources

- Nêu lý do tài nguyên liên quan tới mục tiêu hoặc hoạt động hiện tại nếu có dữ
  liệu authoritative.
- Trạng thái bắt đầu/đang xem/hoàn thành đồng nhất khi đi từ support plan vào
  resource và quay lại.

### J1-05 — Analytics

- Tổng hợp xu hướng và mức độ tham gia, không biến thành history list lặp lại dữ
  liệu từng record.
- Phân biệt rõ dữ liệu tự ghi nhận, hoạt động hoàn thành và kết quả sàng lọc.
- CTA quay lại hành động có ích; chart không tự suy diễn chẩn đoán hay hồi phục.

## 5. Journey 2 — Lịch hẹn và phiên tư vấn

```text
Appointments ─► Summary (chuẩn bị trước phiên) ─► Messages ─► Ended · Chỉ đọc
      ▲                                                        │
      └──── Summary (nội dung đã chốt + bước tiếp theo) ◄───────┘
```

Summary gắn với đúng một appointment và có thể xuất hiện ở hai pha: chuẩn bị
trước phiên và xem nội dung đã chốt sau phiên. Chat CTA từ Appointments đi thẳng
tới Messages. Trạng thái kết thúc do backend xác lập; UI chỉ gọi hành động kết
thúc khi API hiện tại thực sự cung cấp hành động đó.

### J2-01 — Appointments quản lý lịch

- Đầu trang có cuộc hẹn tiếp theo và trạng thái dễ hiểu.
- Filter theo mental model: `Tất cả`, `Chờ xác nhận`, `Sắp tới`, `Lịch sử`;
  không biến mọi enum backend thành một tab.
- Appointment detail tóm tắt lịch, người tham gia, hình thức và hành động hợp lệ.
- Nút chat điều hướng sang Messages với appointment được chọn; không render một
  chat destination thứ hai bên trong Appointments.

### J2-02 — Summary hỗ trợ phiên

- Summary gắn với đúng appointment và đúng người có quyền xem/chỉnh sửa.
- Trước phiên: hỗ trợ chuẩn bị. Sau phiên: thể hiện nội dung đã chốt và các bước
  tiếp theo. Không trình bày draft như kết quả cuối.
- Nếu có đề xuất thay đổi support plan, người dùng nhìn thấy quyết định cần làm
  và hệ quả của chấp nhận/từ chối bằng ngôn ngữ nghiệp vụ.

### J2-03 — Messages là nơi chat duy nhất

- Mỗi conversation tương ứng một appointment `IN_APP_CHAT`; không có direct
  message tự do hoặc conversation vô thời hạn.
- Danh sách conversation nêu người tham gia, thời gian phiên và trạng thái theo
  bảng dưới đây.
- Khung chat giữ header và composer trong viewport; chỉ message list cuộn.
- Waiting, active, reconnecting, ended, cancelled và rescheduled dùng authority
  backend. UI không suy đoán quyền gửi chỉ từ đồng hồ máy người dùng.
- Composer chỉ render khi backend cho phép gửi trong trạng thái hiện tại. Các
  trạng thái khác thay composer bằng status strip cùng vị trí. Strip có
  `role="status"`, giải thích vì sao chưa gửi được và chỉ đưa hành động hợp lệ.

| Trạng thái chat | Nhãn danh sách/header | Vùng composer/status                    | Copy chính                                             |
| --------------- | --------------------- | --------------------------------------- | ------------------------------------------------------ |
| Waiting         | Chưa bắt đầu          | Status strip, trừ khi backend cho gửi   | `Phiên chưa bắt đầu · {giờ hẹn}.`                      |
| Active          | Đang diễn ra          | Composer                                | Không có strip                                         |
| Reconnecting    | Đang kết nối lại      | Giữ nội dung đang soạn; strip phía trên | `Đang kết nối lại. Chưa thể xác nhận tin nhắn đã gửi.` |
| Ended           | Đã kết thúc · Chỉ đọc | Status strip                            | `Phiên đã kết thúc. Cuộc trò chuyện chỉ để xem.`       |
| Cancelled       | Đã hủy                | Status strip                            | `Lịch hẹn đã bị hủy.`                                  |
| Rescheduled     | Đã đổi lịch           | Status strip                            | Chỉ nêu giờ mới khi API trả về                         |

Quyền gửi và quyền xem lịch sử ở từng trạng thái vẫn do backend quyết định.
`Chờ xác nhận` là trạng thái lịch hẹn, khác `Chưa bắt đầu` của chat. Các nhãn
phải nhất quán giữa Messages, Appointments, dialog và toast.

### J2-04 — Kết thúc phiên

- Khi phiên kết thúc, composer được thay bằng status strip và trạng thái
  `Đã kết thúc · Chỉ đọc` hiện ngay trong header. Nếu focus đang ở composer,
  chuyển focus tới strip.
- Lịch sử còn xem được theo quyền hiện hành; hành động tiếp theo là xem summary,
  lịch hẹn hoặc kế hoạch, không mở lại chat bằng mẹo UI.

## 6. Route convergence backlog

Đây là tiêu chí cho các lần refactor tiếp theo, không phải giấy phép thay đổi
logic/API ngoài Jira story.

| Route/feature      | Trạng thái               | Outcome cần đạt                                                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `/journal`         | Cần hội tụ               | Trình soạn thảo là focus; lịch sử là context phụ; draft, lưu, lỗi và rời trang có continuity rõ.  |
| `/assessments`     | Cần hội tụ               | Người dùng hiểu bài nên làm, tiến độ và bước sau kết quả; history không phụ thuộc modal nặng.     |
| `/support-guides`  | Cần hội tụ               | Gợi ý được nhóm theo hành động, giải thích nguồn đúng mức và dẫn tự nhiên sang lựa chọn kế hoạch. |
| `/support-plan`    | Cần hội tụ               | Việc hôm nay/tiếp theo và tiến độ đứng trước lịch sử; trạng thái thay đổi kế hoạch dễ hiểu.       |
| `/appointments`    | Đang hội tụ              | Quản lý lịch, filter và next appointment; mọi chat CTA hội tụ về Messages.                        |
| `/resources`       | Giữ và kiểm chứng        | Lý do liên quan và trạng thái tiến độ còn đúng khi đi từ support plan rồi quay lại.               |
| `/analytics`       | Giữ và kiểm chứng        | Tổng hợp xu hướng, không lặp history record hoặc suy diễn chẩn đoán/hồi phục.                     |
| Messages + Summary | Giữ logic, kiểm chứng IA | Appointment là boundary; summary hai pha; trạng thái chat theo mục 5.                             |

Mỗi route chỉ được đánh dấu “converged” sau khi đã kiểm tra cả state có data,
empty, loading, API error và hành động chính tại 1440 × 900 và 1280 × 800.

## 7. Motion trong product journey

- Motion cho biết state nào vừa thay đổi, đối tượng đến từ đâu hoặc hành động đã
  hoàn tất; không dùng như lớp trang trí mặc định.
- Product route dùng token `instant` đến `medium`. `slow`, scroll choreography,
  parallax và magnetic interaction chỉ dành cho marketing/storytelling đã được
  duyệt.
- Route entrance tối đa một lần. Filter, refetch và rerender không replay cả
  page hoặc stagger dài.
- Primary action phản hồi ngay; không chờ animation mới gửi request hoặc đổi
  focus.
- Loading skeleton giữ kích thước gần state thật để tránh layout shift.
- Reduced motion hiển thị state cuối ngay và vẫn giữ feedback bằng copy, icon,
  border hoặc màu.

## 8. Definition of Done — nguồn duy nhất

Quy trình reviewer phụ, xử lý secret và quality gate nằm ở
[`review-and-testing.md`](review-and-testing.md), không phải thuộc tính UI.

- [ ] Browser viewport 1440 × 900 và 1280 × 800, chưa cuộn, cho thấy vị trí
      trong journey, trạng thái chính và đúng một primary action.
- [ ] Không dùng mock data hoặc copy mô tả capability chưa có thật; không lộ
      service name, policy/version/ID ngoài disclosure `Thông tin kỹ thuật`.
- [ ] Có loading, empty, partial/error, success và—khi API tạo ra được—permission
      denied/stale; lỗi có recovery tại chỗ và giữ ngữ cảnh an toàn.
- [ ] Journey trước/sau liền mạch; thuật ngữ nhất quán giữa page, dialog và toast.
- [ ] Dùng token/primitive hiện có; không thêm palette, duration, easing hoặc
      radius riêng cho route.
- [ ] Control có hover, focus-visible, pressed, disabled và loading khi phù hợp.
- [ ] 768px, 375px và zoom 200% không tràn ngang hoặc mất chức năng.
- [ ] Motion không replay khi filter/refetch, không chặn thao tác; reduced motion
      hiển thị state cuối ngay.
- [ ] Loading → data không gây layout shift đáng kể ở vùng nội dung chính.
- [ ] Chart (nếu có) đạt PX-06 và dùng màu trung tính trừ khi backend cung cấp
      ngưỡng/nhãn authoritative.
- [ ] Đạt sàn accessibility và an toàn ở mục 9.
- [ ] Targeted tests và quality gate theo `review-and-testing.md` đã chạy.

## 9. Accessibility và an toàn — sàn bắt buộc

- Tối thiểu WCAG 2.2 AA: contrast chữ thường ít nhất 4.5:1; focus indicator và
  thành phần UI ít nhất 3:1 so với màu kề bên.
- Target chính tối thiểu 44 × 44px. Focus không bị sticky UI che. Thay đổi trạng
  thái quan trọng dùng `role="status"`/`aria-live` phù hợp; link/button cùng nhãn
  phải có accessible name phân biệt theo ngữ cảnh.
- Ở zoom 200% trên browser viewport 1280 × 800, mọi chức năng vẫn dùng được,
  không mất nội dung và nội dung chính không cuộn ngang. Bảng/code được phép cuộn
  trong container riêng; sticky UI không được chiếm hết vùng đọc.
- Screenshot/visual evidence ghi rõ browser viewport và mức zoom.
- Không task, Jira story hay yêu cầu giữ layout nào được override mục này, ngoại
  lệ an toàn của PX-01, PX-03 hoặc rule không suy diễn y tế. Nếu xung đột, dừng
  và hỏi product owner.
