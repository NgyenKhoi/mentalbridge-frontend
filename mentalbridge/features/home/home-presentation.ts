import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import type { PublicResourceSummary } from '@/features/resources/api/browser-resources'

export function homeResourceTypeLabel(
  category: PublicResourceSummary['category'],
) {
  return {
    BREATHING: 'Bài tập thở',
    MEDITATION: 'Bài tập',
    ARTICLE: 'Bài đọc',
    VIDEO: 'Video',
    JOURNALING: 'Bài tập viết',
    COMMUNITY: 'Cộng đồng',
  }[category]
}

export function homeGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Chào buổi sáng'
  if (hour >= 12 && hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

/** The trail describes the saved journey; it never selects the next action. */
export function homeJourneyTrail(home: HomeNextStep) {
  const { journey, plan } = home
  const step =
    journey.stage === 'ASSESSMENT_REQUIRED'
      ? 0
      : journey.stage === 'GUIDE_REQUIRED'
        ? 1
        : plan || journey.nextAction === 'REVIEW_PLAN_DRAFT'
          ? 2
          : 1
  return [
    'Kiểm tra ban đầu',
    'Hướng dẫn',
    plan
      ? `Kế hoạch${plan.cycleDay != null ? ` · ngày ${plan.cycleDay}` : ''}`
      : 'Kế hoạch (nếu phù hợp)',
  ].map((label, index) => ({
    label,
    status: index < step ? 'done' : index === step ? 'current' : 'upcoming',
  }))
}

export function homeIllustration(
  home: HomeNextStep,
  resourceCategory?: PublicResourceSummary['category'],
) {
  if (home.journey.nextAction === 'REVIEW_SAFETY_SUPPORT') return null
  if (home.journey.stage === 'ASSESSMENT_REQUIRED') return 'questionnaire'
  if (home.journey.stage === 'GUIDE_REQUIRED') return 'book'
  if (home.journey.nextAction === 'FIND_SPECIALIST') return 'person'
  if (home.plan) {
    if (home.plan.focus === 'RESUME_PAUSED') return 'pause'
    if (home.plan.focus === 'REVIEW_DUE') return 'path'
    if (home.plan.focus === 'TODAY_DONE') return 'done'
    switch (home.plan.nextOccurrence?.actionType) {
      case 'JOURNAL':
        return 'journal'
      case 'EMOTION_CHECK_IN':
        return 'face'
      case 'PROFESSIONAL_SUPPORT':
        return 'person'
      case 'REASSESSMENT_SCREENING':
      case 'SELF_REPORT_REVIEW':
        return 'questionnaire'
      case 'RESOURCE':
        if (resourceCategory === 'BREATHING') return 'breath'
        if (resourceCategory === 'JOURNALING') return 'journal'
        if (resourceCategory === 'ARTICLE') return 'book'
        return 'leaf'
    }
    return 'path'
  }
  return 'book'
}
