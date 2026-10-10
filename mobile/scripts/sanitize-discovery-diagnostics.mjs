import { readFileSync } from 'node:fs'

const hierarchy = readFileSync(0, 'utf8')
const messages = [
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
  }),
)
