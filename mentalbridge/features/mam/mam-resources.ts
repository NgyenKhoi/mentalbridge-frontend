import type { PublicResourceSummary } from '@/features/resources/api/browser-resources'

import type { MamAnswer } from './mam-targets'

// Reviewed Resource cards (ADR "Explanation sources in V1"). The catalogue
// page publishes the items it already fetched; a card target carries only its
// ID, and Mầm answers from published catalogue fields, never from page text.
type MamResource = Readonly<{
  title: string
  category: PublicResourceSummary['category']
  minutes: number
  source: string | null
  href: string
}>

const resources = new Map<string, MamResource>()

const CATEGORY_COPY: Record<
  PublicResourceSummary['category'],
  Readonly<{ label: string; how: string }>
> = {
  BREATHING: {
    label: 'bài tập thở',
    how: 'Bạn thở theo nhịp hướng dẫn và dừng lại bất cứ lúc nào thấy không thoải mái.',
  },
  MEDITATION: {
    label: 'bài thiền',
    how: 'Bạn tìm một chỗ yên, nghe và làm theo hướng dẫn. Lần đầu chưa quen cũng không sao.',
  },
  ARTICLE: {
    label: 'bài đọc',
    how: 'Bạn đọc theo nhịp của mình, có thể dừng giữa chừng và quay lại sau.',
  },
  VIDEO: {
    label: 'video',
    how: 'Bạn có thể tạm dừng hoặc xem lại bất cứ lúc nào.',
  },
  JOURNALING: {
    label: 'bài viết nhật ký',
    how: 'Bạn viết vài dòng theo gợi ý. Không có câu trả lời đúng hay sai.',
  },
  COMMUNITY: {
    label: 'hoạt động cộng đồng',
    how: 'Bạn tham gia ở mức mình thấy thoải mái.',
  },
}

export const MAM_RESOURCE_FALLBACK =
  'Mầm không thấy bài này trong thư viện đã duyệt. Bài có thể đang được cập nhật. Bạn chọn bài khác nhé.'

/** Keeps only published items; returns the cleanup for the page's effect. */
export function publishMamResources(
  items: readonly PublicResourceSummary[],
  hrefOf: (resource: PublicResourceSummary) => string,
) {
  const ids: string[] = []
  for (const item of items) {
    if (item.status !== 'PUBLISHED') continue
    resources.set(item.id, {
      title: item.title,
      category: item.category,
      minutes: item.expectedDurationMinutes,
      source: item.sourceOrganization?.trim() || null,
      href: hrefOf(item),
    })
    ids.push(item.id)
  }
  return () => ids.forEach((id) => resources.delete(id))
}

/** Null when the ID is not a published catalogue item on this page. */
export function mamResourceAnswer(
  resourceId: string | undefined,
): MamAnswer | null {
  const resource = resourceId ? resources.get(resourceId) : undefined
  if (!resource) return null
  const copy = CATEGORY_COPY[resource.category]
  if (!copy) return null
  const facts = [
    `“${resource.title}” là ${copy.label}`,
    Number.isInteger(resource.minutes) && resource.minutes > 0
      ? `khoảng ${resource.minutes} phút`
      : null,
    resource.source ? `từ ${resource.source}` : null,
  ].filter(Boolean)
  return { text: `${facts.join(', ')}. ${copy.how}`, href: resource.href }
}
