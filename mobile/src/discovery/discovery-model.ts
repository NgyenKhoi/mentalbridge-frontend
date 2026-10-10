import { ApiError } from '@/api/api-error'

import type {
  DiscoveryItem,
  DiscoveryPage,
  DiscoverySlot,
} from './discovery-contract'

export const supportAreaLabels = {
  DEPRESSIVE_SYMPTOMS: 'Khí sắc và trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const
export const languageLabels = { vi: 'Tiếng Việt', en: 'English' } as const
export const modalityLabels = {
  IN_APP_CHAT: 'Chat trong ứng dụng',
  IN_APP_VIDEO: 'Video trong ứng dụng',
} as const

export function slotLabel(slot: DiscoverySlot) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: slot.timezone,
  }).format(new Date(slot.startAt))
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: slot.timezone,
  })
  return `${date} · ${time.format(new Date(slot.startAt))}–${time.format(new Date(slot.endAt))}`
}

export function explanationText(item: DiscoveryItem) {
  const explanation = item.explanation
  const compatibility = {
    NEUTRAL: 'Thứ tự chung không sử dụng nội dung bài sàng lọc.',
    MATCHED: 'Có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc được chọn.',
    NOT_MATCHED: 'Chưa có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc.',
    UNAVAILABLE:
      'Chưa thể dùng gợi ý sau bài sàng lọc; các tiêu chí còn lại vẫn được áp dụng.',
  }
  return [
    compatibility[explanation.compatibility],
    ...(explanation.languageMatched === null
      ? []
      : [
          explanation.languageMatched
            ? 'Có ngôn ngữ bạn ưu tiên.'
            : 'Chưa có ngôn ngữ bạn ưu tiên.',
        ]),
    ...(explanation.timezoneMatch === 'EXACT'
      ? ['Trùng múi giờ bạn ưu tiên.']
      : []),
    ...(explanation.timezoneMatch === 'OFFSET_DISTANCE'
      ? ['Độ lệch múi giờ được dùng trong thứ tự hiển thị.']
      : []),
    ...(explanation.ratingTieBreakerApplied
      ? ['Đánh giá chỉ phân định khi các yếu tố chính bằng nhau.']
      : []),
  ].join(' ')
}

export function discoveryError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Tài khoản hiện chưa thể xem chuyên gia.'
    if (error.status === 404)
      return 'Hồ sơ hoặc khung giờ không còn khả dụng. Hãy quay lại tìm chuyên gia khác.'
    if (error.code === 'DISCOVERY_CURSOR_STALE')
      return 'Danh sách đã thay đổi. Hãy tìm lại từ đầu.'
  }
  return 'Chưa thể tải thông tin chuyên gia lúc này. Vui lòng thử lại.'
}

export type SlotSelection = Readonly<{
  specialist: DiscoveryItem
  slot: DiscoverySlot
  bookingHandoff: DiscoveryPage['bookingHandoff']
}>

export function selectedHandoff(
  item: DiscoveryItem,
  previous: DiscoverySlot,
  page: DiscoveryPage,
): SlotSelection | null {
  const slot = item.selectableSlots.find(
    (candidate) => candidate.id === previous.id,
  )
  if (
    item.specialistAccountId !== previous.specialistAccountId ||
    !slot ||
    slot.specialistAccountId !== previous.specialistAccountId ||
    slot.version !== previous.version ||
    slot.startAt !== previous.startAt ||
    slot.endAt !== previous.endAt ||
    slot.timezone !== previous.timezone ||
    slot.modality !== previous.modality ||
    (slot.modality === 'IN_APP_VIDEO' && !page.videoEnabled)
  )
    return null
  return { specialist: item, slot, bookingHandoff: page.bookingHandoff }
}
