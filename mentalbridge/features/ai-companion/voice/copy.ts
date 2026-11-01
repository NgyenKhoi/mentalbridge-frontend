export const voiceCopy: Record<string, string> = {
  MIC_DENIED:
    'Micro chưa được cho phép. Bạn có thể cho phép micro trong cài đặt trình duyệt, rồi thử lại.',
  MIC_UNAVAILABLE:
    'Chưa thể sử dụng micro trên thiết bị này. Bạn vẫn có thể tiếp tục nhắn tin.',
  FREE_LOCKED:
    'Gọi AI dành cho gói Plus và Premium, với số phiên và thời lượng hữu hạn.',
  CONSENT_REQUIRED: 'Bạn cần đồng ý xử lý AI trước khi sử dụng giọng nói.',
  VOICE_CONSENT_REQUIRED:
    'Bạn cần đọc và đồng ý với thông tin xử lý giọng nói trước cuộc gọi đầu tiên.',
  GLOBAL_CAPACITY_FULL:
    'Cả hai chỗ gọi AI đang được sử dụng. Bạn có thể thử lại sau hoặc tiếp tục nhắn tin.',
  SESSION_LIMIT:
    'Tài khoản đang có một cuộc gọi khác. Hãy kết thúc cuộc gọi đó trước khi bắt đầu.',
  QUOTA_EXHAUSTED:
    'Bạn đã dùng hết lượt hoặc thời lượng gọi AI hôm nay. Giới hạn được làm mới vào ngày tiếp theo.',
  RATE_LIMITED:
    'Bạn đang thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.',
  PROVIDER_UNAVAILABLE:
    'Gọi AI hiện chưa sẵn sàng. Bạn vẫn có thể trò chuyện bằng tin nhắn.',
  ENTITLEMENT_UNAVAILABLE:
    'Chưa thể xác minh quyền gọi AI của bạn. Vui lòng thử lại sau.',
  CONSENT_UNAVAILABLE:
    'Chưa thể xác minh quyền riêng tư của bạn. Cuộc gọi chưa được mở.',
  INVALID_RESPONSE: 'Chưa thể xác nhận dữ liệu cuộc gọi. Vui lòng thử lại sau.',
  OUTCOME_UNKNOWN:
    'Chưa xác nhận được kết quả yêu cầu. Hãy kiểm tra lại yêu cầu cũ trước khi bắt đầu cuộc gọi khác.',
  CONNECTION_LOST: 'Kết nối cuộc gọi đã gián đoạn. Âm thanh đã ngắt.',
  CONSENT_REVOKED: 'Cuộc gọi đã dừng vì quyền xử lý AI đã thay đổi.',
  VOICE_CONSENT_REVOKED:
    'Cuộc gọi đã dừng vì quyền xử lý giọng nói đã thay đổi.',
  ENTITLEMENT_LOST: 'Cuộc gọi đã dừng vì quyền sử dụng giọng nói đã thay đổi.',
  IDLE_TIMEOUT: 'Cuộc gọi đã kết thúc sau một khoảng im lặng.',
  HARD_DEADLINE: 'Cuộc gọi đã đạt thời lượng được cấp.',
  RECONNECT_TIMEOUT: 'Không thể khôi phục kết nối trong thời gian cho phép.',
  SESSION_EXPIRED: 'Phiên gọi đã hết hạn. Hãy kiểm tra lại trước khi bắt đầu.',
}
export const voiceErrorText = (code?: string) =>
  voiceCopy[code ?? ''] ??
  'Chưa thể hoàn tất cuộc gọi AI. Bạn vẫn có thể tiếp tục nhắn tin.'
export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0
    ? `${minutes} phút${rest ? ` ${rest} giây` : ''}`
    : `${rest} giây`
}
export function clockLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
