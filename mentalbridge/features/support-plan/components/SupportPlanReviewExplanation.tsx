import {
  Activity,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  MessageCircleHeart,
  Split,
  UserRound,
} from 'lucide-react'

import type { NativeSupportPlanReplacementReview } from '../api/support-plan-contract'
import { explainSupportPlanReview } from './support-plan-review-companion'

const dimensionIcon = {
  screening: ClipboardCheck,
  journal: BookOpenText,
  engagement: Activity,
  'self-report': UserRound,
  reflection: MessageCircleHeart,
} as const

export default function SupportPlanReviewExplanation({
  review,
  onOpenAdjust,
}: Readonly<{
  review: NativeSupportPlanReplacementReview
  onOpenAdjust: () => void
}>) {
  const explanation = explainSupportPlanReview(review)
  return (
    <div className="support-plan-review-explanation">
      <section aria-labelledby="companion-review-evidence">
        <h3 id="companion-review-evidence">Điều MentalBridge đã ghi nhận</h3>
        <p className="support-plan-review-outcome">{explanation.outcome}</p>
        <ul className="support-plan-review-dimensions">
          {explanation.dimensions.map((dimension) => {
            const Icon = dimensionIcon[dimension.id]
            return (
              <li key={dimension.id} data-state={dimension.state}>
                <Icon size={18} aria-hidden="true" />
                <div>
                  <strong>{dimension.label}</strong>
                  <p>{dimension.summary}</p>
                  {dimension.details.map((detail) => (
                    <small key={detail}>{detail}</small>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {explanation.contradictory && (
        <p className="support-plan-review-contradiction">
          <Split size={18} aria-hidden="true" />
          <span>
            <strong>Các tín hiệu chưa hoàn toàn cùng chiều.</strong> Mỗi nguồn
            vẫn được giữ riêng để bạn cân nhắc, không gộp thành một kết luận
            chung.
          </span>
        </p>
      )}

      <section aria-labelledby="companion-review-options">
        <h3 id="companion-review-options">Bạn có thể chọn</h3>
        <ul className="support-plan-review-options">
          {explanation.options.map((option) => (
            <li key={option.id}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                <strong>{option.title}</strong>
                {option.summary}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="support-plan-review-confirmation">
        Kế hoạch chỉ thay đổi khi bạn xác nhận trong mục Điều chỉnh.
      </p>
      <button
        type="button"
        className="support-plan-review-open-adjust"
        onClick={onOpenAdjust}
      >
        <ListChecks size={18} aria-hidden="true" />
        Xem chi tiết tại mục Điều chỉnh
      </button>
    </div>
  )
}
