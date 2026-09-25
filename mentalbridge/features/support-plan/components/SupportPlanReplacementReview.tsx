import type { SupportPlanReplacementReview as ReplacementReview } from '../api/support-plan-contract'

const stateLabels = {
  AVAILABLE: 'Có dữ liệu',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
  UNAVAILABLE: 'Không thể truy cập dữ liệu',
} as const

const outcomeCopy = {
  CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE: {
    title: 'Kế hoạch hiện tại vẫn phù hợp',
    body: 'Phương án được đề xuất không thay đổi lựa chọn tài nguyên hiện tại, vì vậy không có kế hoạch nào được thay thế.',
  },
  CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE: {
    title: 'Có phương án hỗ trợ khác để cân nhắc',
    body: 'Kế hoạch hiện tại vẫn có thể sử dụng. Bạn chỉ chuyển sang phương án mới khi xác nhận bên dưới.',
  },
  CURRENT_PLAN_NOT_ADMISSIBLE: {
    title: 'Kế hoạch hiện tại không còn đáp ứng điều kiện mới nhất',
    body: 'Kế hoạch hiện tại vẫn được giữ nguyên cho đến khi bạn xác nhận phương án thay thế đã được kiểm tra lại.',
  },
} as const

function dateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}

export default function SupportPlanReplacementReview({
  review,
  busy,
  message,
  onConfirm,
}: Readonly<{
  review: ReplacementReview
  busy: boolean
  message: string
  onConfirm: () => void
}>) {
  const summary = review.reassessmentSummary
  const outcome = outcomeCopy[review.outcome]
  const selfReport = summary.selfReportedExperience
  const activityReflection = summary.activityReflection
  const canReplace =
    review.outcome !== 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'

  return (
    <section
      className="support-plan-replacement"
      aria-labelledby="replacement-review-title"
    >
      <div className="support-plan-replacement-heading">
        <span>Đánh giá lại kế hoạch</span>
        <h2 id="replacement-review-title">{outcome.title}</h2>
        <p>{outcome.body}</p>
        <p className="support-plan-replacement-guardrail">
          Bản đánh giá lại cung cấp bối cảnh cho quyết định này; nó không tự
          động thay đổi kế hoạch và không gộp bốn chiều thành một kết luận
          chung.
        </p>
      </div>

      <div
        className="support-plan-comparison"
        aria-label="So sánh kế hoạch hiện tại và phương án mới"
      >
        {review.comparison.map((item, index) => (
          <article
            key={`${item.currentSlotId ?? 'new'}:${item.proposedSlotId ?? 'removed'}:${index}`}
          >
            <span>
              {item.change === 'UNCHANGED'
                ? 'Giữ nguyên'
                : item.change === 'CHANGED'
                  ? 'Thay đổi'
                  : item.change === 'ADDED'
                    ? 'Bổ sung'
                    : 'Loại khỏi phương án'}
            </span>
            <div>
              <p>
                <b>Hiện tại:</b> {item.currentResource?.title ?? 'Không có'}
              </p>
              <p>
                <b>Phương án mới:</b>{' '}
                {item.proposedResource?.title ?? 'Không có'}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="support-plan-reassessment-periods">
        <p>
          <b>Giai đoạn trước:</b> {dateTime(summary.previousPeriod.startAt)} –{' '}
          {dateTime(summary.previousPeriod.endAt)}
        </p>
        <p>
          <b>Giai đoạn hiện tại:</b> {dateTime(summary.currentPeriod.startAt)} –{' '}
          {dateTime(summary.currentPeriod.endAt)}
        </p>
      </div>

      <div
        className="support-plan-reassessment-grid"
        aria-label="Bốn chiều đánh giá lại riêng biệt"
      >
        <article>
          <span>1. Thay đổi sàng lọc</span>
          <strong>{stateLabels[summary.screening.state]}</strong>
          {summary.screening.trends.map((trend) => (
            <p key={trend.instrument}>
              {trend.instrument}:{' '}
              {trend.state === 'AVAILABLE'
                ? `${trend.current.totalScore} điểm; thay đổi ${trend.rawDelta ?? 0}`
                : stateLabels[trend.state]}
            </p>
          ))}
        </article>
        <article>
          <span>2. Bối cảnh nhật ký</span>
          <strong>{stateLabels[summary.journalContext.state]}</strong>
          {summary.journalContext.changesComparedWithPreviousPeriod.map(
            (change) => (
              <p key={`${change.signal}:${change.direction}`}>
                {change.signal}: {change.direction}
              </p>
            ),
          )}
          {summary.journalContext.unavailableReason && (
            <p>Lý do: {summary.journalContext.unavailableReason}</p>
          )}
        </article>
        <article>
          <span>3. Mức độ tham gia kế hoạch</span>
          <strong>{stateLabels[summary.supportPlanEngagement.state]}</strong>
          <p>
            Giai đoạn trước:{' '}
            {summary.supportPlanEngagement.previousPeriod.completedCount} hoàn
            thành, {summary.supportPlanEngagement.previousPeriod.skippedCount}{' '}
            bỏ qua.
          </p>
          <p>
            Giai đoạn hiện tại:{' '}
            {summary.supportPlanEngagement.currentPeriod.completedCount} hoàn
            thành, {summary.supportPlanEngagement.currentPeriod.skippedCount} bỏ
            qua.
          </p>
        </article>
        <article>
          <span>4. Trải nghiệm tự báo cáo</span>
          <strong>
            {selfReport ? stateLabels[selfReport.state] : 'Chưa đủ dữ liệu'}
          </strong>
          {selfReport?.source && (
            <p>Trải nghiệm hiện tại: {selfReport.source.currentExperience}</p>
          )}
          <p>
            Phản hồi hoạt động:{' '}
            {activityReflection
              ? `${activityReflection.sources.length} nguồn`
              : 'chưa có'}
          </p>
        </article>
      </div>

      <details className="support-plan-provenance">
        <summary>Nguồn và thời điểm kiểm tra</summary>
        <p>Mã bản tổng hợp: {summary.summaryId}</p>
        <p>Phiên bản: {summary.summaryVersion}</p>
        <p>Được tổng hợp: {dateTime(summary.composedAt)}</p>
        <p>Đánh giá kế hoạch: {dateTime(review.reviewedAt)}</p>
        {summary.journalContext.provenance && (
          <p>
            Nguồn phân tích nhật ký:{' '}
            {summary.journalContext.provenance.provider} /{' '}
            {summary.journalContext.provenance.model}
          </p>
        )}
      </details>

      {message && (
        <p className="support-plan-command-message" role="status">
          {message}
        </p>
      )}
      {canReplace && (
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Đang xác nhận…' : 'Xác nhận dùng phương án mới'}
        </button>
      )}
    </section>
  )
}
