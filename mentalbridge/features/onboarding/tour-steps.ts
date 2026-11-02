export type OnboardingStep = Readonly<{
  target: string
  title: string
  description: string
  inSidebar: boolean
}>

export const ONBOARDING_VERSION = 1
export const ONBOARDING_REPLAY_EVENT = 'mentalbridge:onboarding-replay'

export const ONBOARDING_NAV_TARGETS: Readonly<Record<string, string>> = {
  '/journal': 'journal',
  '/ai-companion': 'companion',
  '/specialists': 'specialists',
  '/resources': 'resources',
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    target: 'welcome',
    title: 'Chào mừng đến với MentalBridge',
    description:
      'Cùng khám phá những nơi giúp bạn ghi lại cảm xúc và chăm sóc bản thân. Bạn có thể đi từng bước hoặc bỏ qua bất cứ lúc nào.',
    inSidebar: false,
  },
  {
    target: 'journal',
    title: 'Ghi lại cảm xúc trong Nhật ký',
    description:
      'Viết về ngày của bạn, ghi lại điều đang nghĩ và nhìn lại những cảm xúc đã trải qua. Bạn có thể bắt đầu bằng vài dòng ngắn.',
    inSidebar: true,
  },
  {
    target: 'companion',
    title: 'Trò chuyện cùng AI Companion',
    description:
      'Diễn đạt suy nghĩ và khám phá các gợi ý hỗ trợ qua trò chuyện với AI. AI không thay thế chuyên gia hoặc hỗ trợ khẩn cấp.',
    inSidebar: true,
  },
  {
    target: 'specialists',
    title: 'Tìm chuyên gia phù hợp',
    description:
      'Xem hồ sơ chuyên gia, hình thức tư vấn và những khung giờ có thể đặt. Bạn có thể tìm hiểu trước khi quyết định đặt lịch.',
    inSidebar: true,
  },
  {
    target: 'resources',
    title: 'Dành một khoảng nhỏ cho bản thân',
    description:
      'Khám phá bài viết và bài tập thư giãn trong Tài nguyên. Chọn một hoạt động phù hợp với thời gian và nhu cầu của bạn.',
    inSidebar: true,
  },
  {
    target: 'profile',
    title: 'Hồ sơ và tài khoản của bạn',
    description:
      'Mở menu tài khoản để xem Hồ sơ cá nhân, quản lý tài khoản hoặc chọn “Xem lại hướng dẫn” bất cứ lúc nào. Bạn đã sẵn sàng khám phá theo nhịp của mình.',
    inSidebar: true,
  },
]

export function requestOnboardingReplay() {
  window.dispatchEvent(new Event(ONBOARDING_REPLAY_EVENT))
}
