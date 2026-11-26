import type { Href } from 'expo-router'
import type { TourPlacement } from './tour-layout'

export type GuideRole = 'USER' | 'SPECIALIST'
export type GuideStep = Readonly<{
  target: string
  route: string
  href: Href
  title: string
  description: string
  placement?: TourPlacement
}>

export const GUIDE_STEPS: Record<
  GuideRole,
  readonly [GuideStep, ...GuideStep[]]
> = {
  SPECIALIST: [
    {
      target: 'specialist-tab-specialist',
      route: '/specialist',
      href: '/(specialist)/specialist',
      title: 'Tổng quan công việc',
      description:
        'Xem nhanh phiên tư vấn tiếp theo, lịch trống và những việc cần theo dõi.',
      placement: 'top',
    },
    {
      target: 'specialist-tab-clients',
      route: '/clients',
      href: '/(specialist)/clients',
      title: 'Khách hàng của bạn',
      description:
        'Quản lý khách hàng và chuẩn bị cho từng phiên tư vấn. Bạn chỉ xem được nội dung trong phạm vi đã được chia sẻ.',
      placement: 'top',
    },
    {
      target: 'specialist-tab-appointments',
      route: '/appointments',
      href: '/(specialist)/appointments',
      title: 'Theo dõi lịch hẹn',
      description:
        'Xem yêu cầu đặt lịch, phản hồi yêu cầu và theo dõi trạng thái từng buổi tư vấn.',
      placement: 'top',
    },
    {
      target: 'specialist-appointment-actions',
      route: '/appointments',
      href: '/(specialist)/appointments',
      title: 'Thao tác với từng lịch hẹn',
      description:
        '“Xem chi tiết” mở thông tin và thao tác của buổi tư vấn. “Mở tin nhắn” xuất hiện khi lịch hẹn có cuộc trò chuyện được phép truy cập.',
      placement: 'top',
    },
    {
      target: 'specialist-tab-messages',
      route: '/appointments',
      href: '/(specialist)/appointments',
      title: 'Trao đổi với khách hàng',
      description:
        'Mở Tin nhắn để tìm cuộc trò chuyện theo lịch hẹn. Bạn có thể gửi tin khi phiên đủ điều kiện mở chat.',
      placement: 'top',
    },
    {
      target: 'specialist-tab-profile',
      route: '/profile',
      href: '/(specialist)/profile',
      title: 'Tài khoản và trợ giúp',
      description:
        'Cập nhật hồ sơ và chọn “Xem lại hướng dẫn” tại đây. Nút “SOS – Cần hỗ trợ ngay” ở góc màn hình mở các lựa chọn hỗ trợ khẩn cấp.',
      placement: 'top',
    },
  ],
  USER: [
    {
      target: 'user-tab-user',
      route: '/user',
      href: '/(user)/user',
      title: 'Trang chủ của bạn',
      description:
        'Xem nhanh hoạt động chăm sóc và những gợi ý đang có trên trang chủ.',
      placement: 'top',
    },
    {
      target: 'user-tab-journal',
      route: '/journal',
      href: '/(user)/journal',
      title: 'Ghi lại cảm xúc trong Nhật ký',
      description:
        'Viết vài dòng về ngày của bạn và nhìn lại cảm xúc theo thời gian.',
      placement: 'top',
    },
    {
      target: 'user-mam-pet',
      route: '/user',
      href: '/(user)/user',
      title: 'Trò chuyện cùng Mầm',
      description:
        'Chạm vào Mầm để khám phá gợi ý và mở trò chuyện AI. AI không thay thế chuyên gia hoặc hỗ trợ khẩn cấp.',
    },
    {
      target: 'user-tab-specialists',
      route: '/specialists',
      href: '/(user)/specialists',
      title: 'Tìm chuyên gia phù hợp',
      description: 'Xem hồ sơ, hình thức tư vấn và các khung giờ có thể đặt.',
      placement: 'top',
    },
    {
      target: 'user-shortcuts',
      route: '/user',
      href: '/(user)/user',
      title: 'Tiện ích chăm sóc',
      description:
        'Mở Kho tài nguyên để tìm bài đọc và bài tập thư giãn. Các tiện ích khác giúp bạn sàng lọc, đặt lịch và theo dõi tiến trình.',
    },
    {
      target: 'user-tab-profile',
      route: '/profile',
      href: '/(user)/profile',
      title: 'Hồ sơ và tài khoản của bạn',
      description:
        'Quản lý tài khoản và chọn “Xem lại hướng dẫn” bất cứ lúc nào tại đây.',
      placement: 'top',
    },
  ],
}
