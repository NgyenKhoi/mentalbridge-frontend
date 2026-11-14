export const ADMIN_SECTIONS = {
  dashboard: {
    label: 'Tổng quan',
  },
  retention: {
    label: 'Bảo lưu & xóa dữ liệu',
    description:
      'Quản trị chính sách bảo lưu và theo dõi thực thi xóa dữ liệu với bằng chứng kiểm toán.',
  },
  accounts: {
    label: 'Tài khoản',
  },
  specialists: {
    label: 'Chuyên gia',
  },
  content: {
    label: 'Tài nguyên tự chăm sóc',
  },
  moderation: {
    label: 'Kiểm duyệt Community',
  },
  appointments: {
    label: 'Lịch hẹn',
  },
  disputes: {
    label: 'Xem xét phiên tư vấn',
  },
  audit: {
    label: 'Nhật ký kiểm toán',
  },
  reports: {
    label: 'Báo cáo',
  },
  payments: {
    label: 'Thanh toán gói',
  },
  payouts: {
    label: 'Chi trả chuyên gia',
  },
  feedback: {
    label: 'Ý kiến & Phản hồi',
    description:
      'Thu thập, phân tích chỉ số hài lòng (CSAT/NPS) và điều phối xử lý ý kiến đóng góp từ Khách hàng và Chuyên gia y tế.',
  },
  reconciliation: {
    label: 'Đối soát thương mại',
    description:
      'Đối soát vòng đời thương mại, phát hiện sai lệch và truy vết dòng tiền.',
  },
} as const

export type AdminSection = keyof typeof ADMIN_SECTIONS

export function isAdminSection(value: string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(ADMIN_SECTIONS, value)
}
