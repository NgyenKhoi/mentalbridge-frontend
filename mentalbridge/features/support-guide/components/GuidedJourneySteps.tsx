import Link from 'next/link'
import { Check } from 'lucide-react'

import type { GuidedJourney } from '@/features/assessment/api/care-contract'

export default function GuidedJourneySteps({
  journey,
  onRetry,
}: Readonly<{ journey: GuidedJourney; onRetry: () => void }>) {
  return (
    <nav className="support-guide-steps" aria-label="Các bước sau sàng lọc">
      <ol>
        <li className="completed">
          <span className="support-guide-step-marker">
            <Check aria-hidden="true" />
          </span>
          <Link
            href={
              journey.presentationEvaluationId
                ? `/assessments/results/${journey.presentationEvaluationId}`
                : '/initial-check'
            }
          >
            Kết quả
          </Link>
        </li>
        <li className="active" aria-current="step">
          <span className="support-guide-step-marker">2</span>
          <span>Gợi ý hỗ trợ</span>
        </li>
        <li>
          <span className="support-guide-step-marker">3</span>
          <span>Bước tiếp theo</span>
        </li>
      </ol>
      {journey.entitlementStatus === 'UNAVAILABLE' && (
        <p className="support-guide-steps-note" role="status">
          Chưa kiểm tra được quyền lợi gói của bạn, nên MentalBridge gợi ý bắt
          đầu với các bài tập miễn phí.{' '}
          <button type="button" onClick={onRetry}>
            Kiểm tra lại
          </button>
        </p>
      )}
    </nav>
  )
}
