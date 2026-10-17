'use client'

import React from 'react'
import SupportPlanIcon from './SupportPlanIcon'

export interface WeeklyProgressStats {
  completed: number
  total: number
  percent: number
  remaining: number
}

interface SupportPlanHeroProps {
  stats?: WeeklyProgressStats | null
  doctorName?: string
}

export default function SupportPlanHero({
  stats,
  doctorName = 'ThS. Tâm lý học Nguyễn An Chi',
}: SupportPlanHeroProps) {
  return (
    <section
      className="support-plan-hero"
      aria-label="Giới thiệu kế hoạch hỗ trợ"
    >
      {/* 2 vòng tròn blur mờ trang trí theo thiết kế */}
      <div className="support-plan-hero-blob-1" aria-hidden="true" />
      <div className="support-plan-hero-blob-2" aria-hidden="true" />

      <div className="support-plan-hero-inner">
        <div className="support-plan-hero-content">
          <div className="support-plan-badge-pill" style={{ color: '#ffffff' }}>
            <SupportPlanIcon
              name="star"
              size={14}
              className="support-plan-hero-star"
            />
            <span style={{ color: '#ffffff' }}>
              DÀNH CHO GÓI PLUS &amp; PREMIUM
            </span>
          </div>

          <h1 className="support-plan-hero-title">Kế hoạch hỗ trợ của bạn</h1>

          <p className="support-plan-hero-desc">
            Đồng hành xây dựng thói quen chăm sóc tâm lý mỗi ngày với nhịp độ tự
            nhiên. Bạn hoàn toàn có thể điều chỉnh thời gian, cá nhân hóa nội
            dung hoặc tạm dừng kế hoạch bất kỳ lúc nào mà không bị áp lực.
          </p>

          <div className="support-plan-hero-verifier">
            <SupportPlanIcon
              name="verified_user"
              size={16}
              className="support-plan-hero-verified-icon"
            />
            <span>Phác đồ được cá nhân hóa bởi {doctorName}</span>
          </div>
        </div>

        {/* Thẻ tiến độ tuần: chỉ render khi có dữ liệu thật */}
        {stats && stats.total > 0 && (
          <div
            className="support-plan-hero-mini-card"
            aria-label={`Tiến độ tuần: ${stats.percent}%`}
          >
            <div className="support-plan-mini-card-header">
              <span className="support-plan-mini-card-label">Tiến độ tuần</span>
              <span className="support-plan-mini-card-percent">
                {stats.percent}%
              </span>
            </div>

            <div
              className="support-plan-mini-card-bar-track"
              role="progressbar"
              aria-valuenow={stats.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="support-plan-mini-card-bar-fill"
                style={{ width: `${stats.percent}%` }}
              />
            </div>

            <div className="support-plan-mini-card-footer">
              <span className="support-plan-mini-card-done">
                <span
                  className="support-plan-mini-card-dot"
                  aria-hidden="true"
                />
                {stats.completed} / {stats.total} hoạt động hoàn thành
              </span>
              <span className="support-plan-mini-card-remaining">
                {stats.remaining > 0
                  ? `Còn ${stats.remaining} hoạt động trong tuần`
                  : 'Đã hoàn tất tuần'}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
