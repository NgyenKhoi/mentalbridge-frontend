'use client'

import React from 'react'
import Link from 'next/link'
import SupportPlanIcon from './SupportPlanIcon'
import SupportPlanScreeningProgress from './SupportPlanScreeningProgress'

interface SupportPlanSidebarCardsProps {
  planStatus?: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  onToggleStatus?: () => void
  onSwitchToManageTab?: () => void
}

export default function SupportPlanSidebarCards({
  planStatus = 'ACTIVE',
  onToggleStatus,
  onSwitchToManageTab,
}: SupportPlanSidebarCardsProps) {
  const handleToggle = () => {
    if (onToggleStatus) {
      onToggleStatus()
    } else {
      const el = document.getElementById('tab-manage')
      el?.click()
    }
  }

  const handleSwitchManage = () => {
    if (onSwitchToManageTab) {
      onSwitchToManageTab()
    } else {
      const el = document.getElementById('tab-manage')
      el?.click()
    }
  }

  const handleExportPdf = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <aside className="support-plan-sidebar-col" aria-label="Thông tin bổ trợ">
      {/* 1. Safety Alert & Care */}
      <section
        className="support-plan-side-card support-plan-safety-card"
        aria-labelledby="support-plan-safety-title"
      >
        <div className="support-plan-side-card-header">
          <div className="support-plan-safety-icon" aria-hidden="true">
            <SupportPlanIcon name="health_and_safety" size={22} />
          </div>
          <div>
            <h4
              id="support-plan-safety-title"
              className="support-plan-side-card-title"
            >
              Nhắc nhở an toàn &amp; Chăm sóc
            </h4>
            <span className="support-plan-side-card-subtitle">
              Luôn có sự lắng nghe 24/7
            </span>
          </div>
        </div>

        <p className="support-plan-side-card-desc">
          Nếu bạn cảm thấy áp lực vượt quá tầm kiểm soát hoặc có suy nghĩ tiêu
          cực, hãy chủ động liên hệ hotline hỗ trợ tâm lý bảo mật ngay tức khắc.
        </p>

        <div className="support-plan-safety-actions">
          <a
            className="support-plan-hotline-btn"
            href="tel:19005999"
            aria-label="Gọi hotline 1900-5999"
          >
            <SupportPlanIcon name="call" size={16} />
            <span>Hotline: 1900-5999</span>
          </a>
          <Link
            className="support-plan-crisis-btn"
            href="/crisis"
            aria-label="Nhắn tin khẩn cấp"
          >
            <SupportPlanIcon name="chat" size={16} />
            <span>Nhắn tin khẩn cấp</span>
          </Link>
        </div>
      </section>

      <SupportPlanScreeningProgress />

      {/* 3. Quick Actions */}
      <section
        className="support-plan-side-card"
        aria-labelledby="support-plan-quick-actions-title"
      >
        <div className="support-plan-side-card-header">
          <div className="support-plan-side-card-icon-tile" aria-hidden="true">
            <SupportPlanIcon name="settings_suggest" size={20} />
          </div>
          <div>
            <h4
              id="support-plan-quick-actions-title"
              className="support-plan-side-card-title"
            >
              Tác vụ nhanh
            </h4>
            <span className="support-plan-side-card-subtitle">
              Tùy chỉnh &amp; báo cáo
            </span>
          </div>
        </div>

        <div className="support-plan-quick-actions-list">
          <button
            type="button"
            className="support-plan-quick-action-btn"
            onClick={handleToggle}
          >
            <SupportPlanIcon
              name={planStatus === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              {planStatus === 'ACTIVE'
                ? 'Tạm dừng kế hoạch (Nghỉ ngơi)'
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
            onClick={handleSwitchManage}
          >
            <SupportPlanIcon
              name="auto_mode"
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              Tạo lại phương án cá nhân mới
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
            onClick={handleExportPdf}
          >
            <SupportPlanIcon
              name="share"
              size={18}
              className="support-plan-quick-action-icon"
            />
            <span className="support-plan-quick-action-label">
              Xuất báo cáo PDF cho chuyên gia
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
