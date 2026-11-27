'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { useId, useState, type CSSProperties } from 'react'
import { rememberUpgradeIntent } from './plan-access'
import './locked-plan-preview.css'

/** Reading-order position for the staggered entrance. */
const at = (index: number) => ({ '--lpp-i': index }) as CSSProperties

/**
 * A fixed, generic example of what a paid plan looks like. It never receives
 * the user's plan, screening or IDs, so nothing private can reach the DOM.
 */
export default function LockedPlanPreview({
  expired = false,
  pendingPayment = false,
  next,
}: Readonly<{
  expired?: boolean
  pendingPayment?: boolean
  /** One quiet free continuation, chosen by the workspace from Care's facts. */
  next?: Readonly<{ label: string; href: string }>
}>) {
  const titleId = useId()
  const sampleId = useId()
  // Local only: lets the user feel a day of the plan; nothing is saved.
  const [tried, setTried] = useState(false)
  const doneCount = tried ? 5 : 4

  return (
    <section className="lpp" aria-labelledby={titleId}>
      <div className="lpp-intro lpp-rise" style={at(0)}>
        <h2 id={titleId}>
          {expired
            ? 'Gói của bạn đã hết hạn'
            : 'Kế hoạch 14 ngày có trong gói Plus'}
        </h2>
        <p>
          {expired
            ? 'Gia hạn Plus để tiếp tục có kế hoạch lập từ kết quả kiểm tra của bạn.'
            : 'Với Plus, kế hoạch được lập từ kết quả kiểm tra của chính bạn và được xem lại sau 14 ngày.'}
        </p>
      </div>

      {/* Only the label and steps rise; the frame stays put so opacity never compounds. */}
      <figure className="lpp-sample" aria-labelledby={sampleId}>
        <figcaption id={sampleId} className="lpp-label lpp-rise" style={at(1)}>
          Ví dụ minh hoạ, không phải kế hoạch của bạn
        </figcaption>
        <ol className="lpp-steps">
          <li className="lpp-step lpp-rise" style={at(2)}>
            <h3>Hôm nay</h3>
            <ul className="lpp-today">
              <li>
                <button
                  type="button"
                  className="lpp-task"
                  aria-pressed={tried}
                  onClick={() => setTried((value) => !value)}
                >
                  <span className="lpp-check" aria-hidden="true">
                    <Check size={16} strokeWidth={3} />
                  </span>
                  <span className="lpp-task-text">
                    Đọc một bài ngắn về giấc ngủ
                  </span>
                  <span className="lpp-task-meta">5 phút</span>
                </button>
              </li>
              <li className="lpp-task is-static">
                <span className="lpp-check" aria-hidden="true" />
                <span className="lpp-task-text">Ghi lại cảm xúc buổi tối</span>
                <span className="lpp-task-meta">2 phút</span>
              </li>
            </ul>
            <p className="lpp-hint" aria-live="polite">
              {tried
                ? 'Trong kế hoạch thật, mỗi việc bạn làm được ghi lại như vậy.'
                : 'Chạm vào việc đầu tiên để thử đánh dấu.'}
            </p>
          </li>
          <li className="lpp-step lpp-rise" style={at(3)}>
            <h3>Tiến triển</h3>
            <p>
              Ngày 3 trên 14 ·{' '}
              <span key={doneCount} className="lpp-count">
                {doneCount}
              </span>{' '}
              việc đã làm
            </p>
          </li>
          <li className="lpp-step lpp-rise" style={at(4)}>
            <h3>Xem lại</h3>
            <p>Ngày 14: xem điều gì giúp ích, rồi chọn bước tiếp theo.</p>
          </li>
        </ol>
      </figure>

      <div className="lpp-actions lpp-rise" style={at(5)}>
        {pendingPayment && (
          <p className="lpp-status">
            Giao dịch đang chờ xác nhận. Kế hoạch mở khi thanh toán thành công.
          </p>
        )}
        <div className="mbw-actions">
          <Link
            className="mbw-primary lpp-cta"
            href="/subscription"
            onClick={() => rememberUpgradeIntent()}
          >
            {pendingPayment
              ? 'Xem trạng thái thanh toán'
              : expired
                ? 'Gia hạn Plus'
                : 'Nâng cấp Plus'}
          </Link>
          {next && (
            <Link className="mbw-text-link" href={next.href}>
              {next.label}
            </Link>
          )}
        </div>
        {!pendingPayment && (
          <p className="lpp-note">Giá và quyền lợi có ở trang tiếp theo.</p>
        )}
      </div>
    </section>
  )
}
