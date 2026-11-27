import { readFileSync } from 'node:fs'

const hierarchy = readFileSync(0, 'utf8')
const messages = [
  'Chưa thể tải lượt tư vấn. Lịch hẹn vẫn có thể xem bên dưới.',
  'Chưa thể hoàn tất thao tác lúc này. Vui lòng thử lại.',
  'Chưa có lượt tư vấn phù hợp với giờ hẹn này. Hãy cập nhật quyền lợi và chọn lại.',
  'Lịch hẹn vừa thay đổi. Hãy tải lại và kiểm tra trước khi xác nhận.',
  'Nhập email và mật khẩu để tiếp tục.',
  'Email, mật khẩu hoặc trạng thái tài khoản không hợp lệ.',
  'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
  'Không thể đăng nhập lúc này. Vui lòng thử lại.',
  'Chưa thể tải thông tin chuyên gia lúc này. Vui lòng thử lại.',
  'Hồ sơ hoặc khung giờ không còn khả dụng. Hãy quay lại tìm chuyên gia khác.',
]
console.log(
  JSON.stringify({
    visiblePublicErrorCopy: messages.filter((message) =>
      hierarchy.includes(message),
    ),
    signInVisible: hierarchy.includes('sign-in-submit'),
    discoveryVisible: hierarchy.includes('discovery-open-'),
    selectionVisible: hierarchy.includes('discovery-selection-summary'),
    appointmentReviewVisible: hierarchy.includes('appointment-review'),
    appointmentDetailVisible: hierarchy.includes('appointment-detail'),
  }),
)
