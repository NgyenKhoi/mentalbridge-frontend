import type { CompanionSuggestion } from '@/lib/companion/companion-contract'

// The server resolves the destination; routes and copy stay on the web (ADR 0049).
const fixed: Record<
  Exclude<CompanionSuggestion['destination'], 'RESOURCE'>,
  { href: string; label: string }
> = {
  RESOURCE_LIBRARY: { href: '/resources', label: 'Mở Thư viện tài nguyên' },
  JOURNAL: { href: '/journal', label: 'Mở Nhật ký' },
  EMOTION_CHECK_IN: {
    href: '/dashboard#emotion-check-in',
    label: 'Mở Check-in cảm xúc',
  },
  SUPPORT_PLAN: { href: '/support-plan', label: 'Mở Kế hoạch hỗ trợ' },
  SPECIALIST_DISCOVERY: { href: '/specialists', label: 'Tìm chuyên gia' },
}

export function suggestionLink(
  suggestion: CompanionSuggestion | null | undefined,
): { href: string; label: string } | null {
  if (!suggestion) return null
  if (suggestion.destination === 'RESOURCE')
    return suggestion.resourceId && suggestion.resourceTitle
      ? {
          href: `/resources/${encodeURIComponent(suggestion.resourceId)}?from=ai-companion`,
          label: `Mở bài: ${suggestion.resourceTitle}`,
        }
      : null
  return Object.hasOwn(fixed, suggestion.destination)
    ? fixed[suggestion.destination]
    : null
}
