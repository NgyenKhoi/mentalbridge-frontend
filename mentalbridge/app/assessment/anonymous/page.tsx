import AssessmentFlow from '@/features/assessment/components/AssessmentFlow'

import './assessment.css'

export default function AnonymousAssessment() {
  return (
    <main className="anonymous-assessment">
      <div className="assessment-breathing-zone" aria-hidden="true" />
      <AssessmentFlow mode="anonymous" instrument="PHQ9" />
    </main>
  )
}
