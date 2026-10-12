'use client'

import Link from 'next/link'

import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon, { type SupportPlanIconName } from './SupportPlanIcon'

type Props = Readonly<{
  occurrences?: SupportPlanOccurrence[]
  planStatus?: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  onToggleStatus?: () => void
  onEndPlan?: () => void
  onSwitchToManageTab?: () => void
}>

const sourceIcons: Record<
  SupportPlanOccurrence['source']['type'],
  SupportPlanIconName
> = {
  RESOURCE: 'menu_book',
  JOURNAL_PROMPT: 'edit_note',
  EMOTION_CHECK_IN_PROMPT: 'sentiment_satisfied',
}

function stateLabel(state: SupportPlanOccurrence['displayState']) {
  return {
    SCHEDULED: 'Sắp tới',
    MISSED: 'Có thể làm lại',
    COMPLETED: 'Đã ghi nhận',
    SKIPPED: 'Đã bỏ qua',
    CANCELLED: 'Đã huỷ',
  }[state]
}

function timeLabel(value: string) {
  return value.slice(0, 5)
}

export default function SupportPlanSidebarCards({
  occurrences = [],
  planStatus = 'ACTIVE',
  onToggleStatus,
  onEndPlan,
  onSwitchToManageTab,
}: Props) {
  const visibleToday = occurrences
    .filter((occurrence) => !occurrence.hidden)
    .sort((left, right) => left.localTime.localeCompare(right.localTime))

  return (
    <aside className="support-plan-sidebar-col" aria-label="Nhịp và hỗ trợ">
      <section
        className="support-plan-side-card support-plan-rhythm-card"
        aria-labelledby="support-plan-rhythm-title"
      >
        <div className="support-plan-side-card-header">
          <div className="support-plan-side-card-icon-tile" aria-hidden="true">
            <SupportPlanIcon name="calendar_today" size={20} />
          </div>
          <div>
            <h3
              id="support-plan-rhythm-title"
              className="support-plan-side-card-title"
            >
              Nhịp hôm nay
            </h3>
            <p className="support-plan-side-card-subtitle">
              {visibleToday.length > 0
                ? `${visibleToday.length} hoạt động trong lịch`
                : 'Một ngày nhẹ cũng là một ngày hợp lệ'}
            </p>
          </div>
        </div>

        {visibleToday.length > 0 ? (
          <ol className="support-plan-rhythm-list">
            {visibleToday.slice(0, 4).map((occurrence) => (
              <li key={occurrence.occurrenceId}>
                <span className="support-plan-rhythm-icon" aria-hidden="true">
                  <SupportPlanIcon
                    name={sourceIcons[occurrence.source.type]}
                    size={16}
                  />
                </span>
                <span className="support-plan-rhythm-copy">
                  <strong>{occurrence.source.title}</strong>
                  <span>
                    {timeLabel(occurrence.localTime)} ·{' '}
                    {stateLabel(occurrence.displayState)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="support-plan-side-card-desc">
            Chưa có hoạt động nào được xếp lịch. Bạn không cần lấp đầy khoảng
            trống để kế hoạch có ý nghĩa.
          </p>
        )}
      </section>

      <section
        className="support-plan-side-card support-plan-care-card"
        aria-labelledby="support-plan-care-title"
      >
        <div className="support-plan-side-card-header">
          <div className="support-plan-safety-icon" aria-hidden="true">
            <SupportPlanIcon name="health_and_safety" size={21} />
          </div>
          <div>
            <h3
              id="support-plan-care-title"
              className="support-plan-side-card-title"
            >
              Khi cần thêm hỗ trợ
            </h3>
            <p className="support-plan-side-card-subtitle">
              Bạn không cần tự xoay xở một mình
            </p>
          </div>
        </div>
        <p className="support-plan-side-card-desc">
          Nếu các hoạt động tự hỗ trợ chưa đủ, bạn có thể tìm chuyên gia phù hợp
          hoặc xem các nguồn trợ giúp an toàn đã được MentalBridge tổng hợp.
        </p>
        <div className="support-plan-care-actions">
          <Link className="btn btn-primary" href="/specialists">
            Tìm chuyên gia
            <SupportPlanIcon name="arrow_forward" size={16} />
          </Link>
          <Link className="support-plan-care-link" href="/safety-directory">
            Xem thư mục hỗ trợ an toàn
          </Link>
        </div>
      </section>

      <section
        className="support-plan-side-card"
        aria-labelledby="support-plan-adjust-rhythm-title"
      >
        <div className="support-plan-side-card-header">
          <div className="support-plan-side-card-icon-tile" aria-hidden="true">
            <SupportPlanIcon name="settings_suggest" size={20} />
          </div>
          <div>
            <h3
              id="support-plan-adjust-rhythm-title"
              className="support-plan-side-card-title"
            >
              Điều chỉnh nhịp
            </h3>
            <p className="support-plan-side-card-subtitle">
              Thay đổi khi kế hoạch không còn vừa sức
            </p>
          </div>
        </div>

        <div className="support-plan-quick-actions-list">
          <button
            type="button"
            className="support-plan-quick-action-btn"
            onClick={onToggleStatus}
            disabled={!onToggleStatus}
          >
            <SupportPlanIcon
              name={planStatus === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              {planStatus === 'ACTIVE'
                ? 'Tạm dừng kế hoạch'
                : 'Tiếp tục kế hoạch'}
            </span>
            <SupportPlanIcon
              name="chevron_right"
              size={18}
              className="support-plan-quick-action-chevron"
            />
          </button>

          <button
            type="button"
            className="support-plan-quick-action-btn"
            onClick={onEndPlan}
            disabled={!onEndPlan}
          >
            <SupportPlanIcon
              name="check_circle"
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              Kết thúc kế hoạch
            </span>
            <SupportPlanIcon
              name="chevron_right"
              size={18}
              className="support-plan-quick-action-chevron"
            />
          </button>

          <button
            type="button"
            className="support-plan-quick-action-btn"
            onClick={onSwitchToManageTab}
            disabled={!onSwitchToManageTab}
          >
            <SupportPlanIcon
              name="settings_suggest"
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              Xem các cách điều chỉnh
            </span>
            <SupportPlanIcon
              name="chevron_right"
              size={18}
              className="support-plan-quick-action-chevron"
            />
          </button>
        </div>
      </section>
    </aside>
  )
}
