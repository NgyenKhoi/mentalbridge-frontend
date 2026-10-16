import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import type { SupportGuide } from '../api/support-guide-contract'

export type GuideContinuation = Readonly<{
  href: string
  label: string
  professional?: boolean
}>

export function isCurrentJourneyGuide(
  journey: GuidedJourney | null,
  guide: SupportGuide,
) {
  return journey?.supportGuideId === guide.supportGuideId
}

export function guideReturnQuery(guide: SupportGuide) {
  return `from=support-guide&supportGuideId=${guide.supportGuideId}`
}

export function guideContinuation(
  journey: GuidedJourney,
  guide: SupportGuide,
): GuideContinuation | null {
  switch (journey.nextAction) {
    case 'REVIEW_SAFETY_SUPPORT':
      return null
    case 'FIND_SPECIALIST':
      return {
        href: `/specialists?${guideReturnQuery(guide)}`,
        label: 'Tìm chuyên gia phù hợp',
        professional: true,
      }
    case 'OPEN_CURRENT_PLAN':
      return { href: '/support-plan', label: 'Tiếp tục kế hoạch hiện tại' }
    case 'REVIEW_PLAN_DRAFT':
      return { href: '/support-plan', label: 'Xem lại kế hoạch đang soạn' }
    case 'START_PLAN_PROPOSAL':
      return {
        href: '/support-plan',
        label: 'Tiếp tục với kế hoạch hỗ trợ',
      }
    default:
      return guide.resources.length > 0
        ? {
            href: '#support-guide-resources',
            label: 'Khám phá bài tập phù hợp',
          }
        : { href: '/resources', label: 'Khám phá thư viện tài nguyên' }
  }
}
