import { reopenAssessment } from '@/features/assessment/api/browser-care'
import type { SupportGuide } from '../api/support-guide-contract'
import type { SupportGuideScorePair } from './SupportGuideCard'

export async function loadGuideScores(
  guide: SupportGuide,
): Promise<SupportGuideScorePair | null> {
  const phq9Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'PHQ9',
  )
  const gad7Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'GAD7',
  )
  if (!phq9Evidence || !gad7Evidence) return null
  try {
    const [phq9, gad7] = await Promise.all([
      reopenAssessment('authenticated', phq9Evidence.assessmentId),
      reopenAssessment('authenticated', gad7Evidence.assessmentId),
    ])
    if (
      phq9.assessmentId !== phq9Evidence.assessmentId ||
      phq9.instrument !== 'PHQ9' ||
      phq9.result.screeningLevel !== phq9Evidence.screeningLevel ||
      gad7.assessmentId !== gad7Evidence.assessmentId ||
      gad7.instrument !== 'GAD7' ||
      gad7.result.screeningLevel !== gad7Evidence.screeningLevel
    )
      return null
    return {
      phq9: { ...phq9.result, submittedAt: phq9.submittedAt },
      gad7: { ...gad7.result, submittedAt: gad7.submittedAt },
    }
  } catch {
    return null
  }
}
