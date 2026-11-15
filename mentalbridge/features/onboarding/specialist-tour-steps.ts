import type { OnboardingStep } from './tour-steps'

export const SPECIALIST_ONBOARDING_VERSION = 1
export const SPECIALIST_ONBOARDING_REPLAY_EVENT =
  'mentalbridge:specialist-onboarding-replay'

export const SPECIALIST_ONBOARDING_NAV_TARGETS: Readonly<
  Record<string, string>
> = {
  availability: 'specialist-availability',
  appointments: 'specialist-appointments',
  clients: 'specialist-clients',
  messages: 'specialist-messages',
}

export const SPECIALIST_ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    target: 'specialist-welcome',
    title: 'Chào mừng đến với không gian chuyên gia',
    description:
      'Cùng làm quen với những công cụ giúp bạn sắp xếp lịch và chuẩn bị cho các phiên tư vấn. Bạn có thể đi từng bước hoặc bỏ qua bất cứ lúc nào.',
    inSidebar: false,
  },
  {
    target: 'specialist-availability',
    title: 'Chủ động với lịch khả dụng',
    description:
      'Chọn Thêm khung giờ để thiết lập ngày, giờ và hình thức tư vấn phù hợp. Các khung giờ được xuất bản sẽ hiển thị trong danh sách hoặc lịch.',
    inSidebar: true,
  },
  {
    target: 'specialist-appointments',
    title: 'Theo dõi lịch hẹn của bạn',
    description:
      'Xem yêu cầu đặt lịch, phản hồi các yêu cầu và theo dõi trạng thái buổi tư vấn. Mở từng lịch hẹn để xem các thao tác đang khả dụng.',
    inSidebar: true,
  },
  {
    target: 'specialist-clients',
    title: 'Chuẩn bị trước mỗi phiên',
    description:
      'Xem khách hàng gắn với lịch hẹn và nội dung được chia sẻ cho buổi tư vấn. Thông tin hiển thị phụ thuộc vào quyền truy cập của từng phiên.',
    inSidebar: true,
  },
  {
    target: 'specialist-messages',
    title: 'Trao đổi trong phiên tư vấn',
    description:
      'Tìm cuộc trò chuyện theo lịch hẹn và xem thông tin buổi tư vấn. Bạn có thể gửi tin nhắn khi lịch hẹn đủ điều kiện mở chat.',
    inSidebar: true,
  },
  {
    target: 'profile',
    title: 'Tài khoản và hướng dẫn của bạn',
    description:
      'Mở menu tài khoản để quản lý tài khoản hoặc chọn “Xem lại hướng dẫn” bất cứ lúc nào. Bạn có thể cập nhật hồ sơ chuyên gia tại mục Hồ sơ trong thanh bên.',
    inSidebar: true,
  },
]

export function requestSpecialistOnboardingReplay() {
  window.dispatchEvent(new Event(SPECIALIST_ONBOARDING_REPLAY_EVENT))
}
