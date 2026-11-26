# Hướng dẫn spotlight trên app

Thay cơ chế popup minh họa bằng một coach-mark duy nhất cho USER và SPECIALIST. Màn tham chiếu: ảnh `codex-clipboard-de3a9490-60e8-49a7-a4df-8ec41374b849.png` do chủ sản phẩm cung cấp, ngày 19/11/2026. Không thay API, quyền truy cập, dữ liệu lịch hẹn hay thanh điều hướng.

## Trạng thái và tương tác

| Trạng thái                        | Cách hiển thị / hành động                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Phần tử thật đã đo được           | Khoét đúng rect + 8 px, bo góc 16 px; tooltip né mép an toàn; mũi tên hướng vào vùng sáng.  |
| Chuyển trang / đang tải           | Nền tối, chưa khoét lỗ khi chưa có tọa độ đúng; Quay lại / Tiếp tục / Bỏ qua vẫn dùng được. |
| Phần tử chưa xuất hiện sau 4 giây | Giải thích vùng chưa hiển thị, có Tìm lại vị trí; không tạo phần tử hoặc lịch hẹn giả.      |
| Danh sách lịch trống / tải lỗi    | Bước 4 trỏ vào thanh Danh sách yêu cầu thật và dùng nội dung phù hợp trạng thái.            |
| Nằm ngoài màn hình                | Screen cuộn tới vùng thật trước khi công bố rect.                                           |
| Xoay máy / đổi cỡ chữ             | Đo lại cả gốc app và phần tử; chọn lại phía đặt card, không dùng tọa độ thiết bị cố định.   |
| Reduced Motion                    | Tắt pulse / bounce và chuyển tức thì.                                                       |
| TalkBack / VoiceOver              | Ẩn cây nền khỏi accessibility; đưa focus vào tiêu đề và đọc bước; nút có nhãn.              |
| Bỏ qua / hoàn tất / Android Back  | Đóng hướng dẫn, lưu SecureStore theo tài khoản + vai trò; không tự mở lại.                  |

## File và các điểm bám

- `src/onboarding/guide-steps.ts`: mảng 6 bước cho từng vai trò; `target`, `route`, `href`, `title`, `description`, `placement`.
- `src/onboarding/tour-overlay.tsx`: lớp tối native, góc khoét trong suốt, glow, arrow, card và accessibility. Không thêm native dependency.
- `src/onboarding/tour-target.tsx`: registry ref + nativeID, cách ly theo route; hủy đăng ký khi unmount.
- `src/onboarding/tour-layout.ts`: padding và chọn vị trí tooltip trong safe area.
- `src/navigation/SpecialistOverviewTabBar.tsx`: `specialist-tab-specialist`, `specialist-tab-clients`, `specialist-tab-appointments`, `specialist-tab-messages`, `specialist-tab-profile`.
- `src/specialist-appointments/SpecialistAppointmentsScreen.tsx`: `specialist-appointment-actions` trên vùng nút của lịch đầu tiên; khi danh sách chưa có phần tử dùng thanh danh sách hiện hữu cùng nội dung giải thích.
- `src/navigation/UserTabBar.tsx`: `user-tab-user`, `user-tab-journal`, `user-tab-specialists`, `user-tab-profile`.
- `src/mam/MamHomePet.tsx`: ref `user-mam-pet` gắn trực tiếp pet thật.
- `src/home/HomeShortcuts.tsx`: `user-shortcuts` trên khối tiện ích thật.
- `src/components/Screen.tsx`: cung cấp cơ chế cuộn tới target và bảo toàn ref cuộn hiện hữu.

Bước 6 của chuyên gia highlight đúng **một** tab Tài khoản, mô tả thêm vị trí nút SOS. Bước 5 highlight tab Tin nhắn từ trang Lịch hẹn; không tự mở hoặc gửi cuộc trò chuyện. Các nút nền bị chặn trong hướng dẫn, không có thao tác đặt lịch, chat, lưu hồ sơ hay chuyển tiền tự động.

## Chạy thử

Dùng development build đang chạy với Metro (không cần APK mới). Vào **Tài khoản → Xem lại hướng dẫn**; USER dùng **Cá nhân → Xem lại hướng dẫn**. Kiểm tra đủ 6 bước, Quay lại, Bỏ qua, Hoàn tất, thoát app rồi mở lại. Với chuyên gia có lịch, bước 4 phải cuộn đến nút thật; tài khoản chưa có lịch phải thấy hướng dẫn trạng thái danh sách. Kiểm tra dọc / ngang, cỡ chữ lớn, TalkBack / VoiceOver và Reduce Motion trên thiết bị.

## Thêm hoặc sửa bước

Sửa nội dung / thứ tự trong `GUIDE_STEPS`, số chấm và bộ đếm tự lấy theo độ dài mảng. Với một vùng mới, gắn ref ổn định bằng:

```tsx
<TourTarget id="specialist-example" route="/appointments">
  <ExistingComponent />
</TourTarget>
```

Giữ style kích thước / flex của vùng hiện hữu trên `TourTarget`. Với nút có vị trí absolute, dùng `useRegisterTourTarget(id, route, existingRef)` trực tiếp để giữ nguyên layout. Đặt cùng `target` trong mảng bước và `href` Expo Router thật; `route` là pathname không gồm nhóm `(specialist)` / `(user)`. Không thêm tọa độ vào cấu hình. Không đổi khóa `onboarding.v1` để người đã hoàn tất không bị làm phiền lại.
