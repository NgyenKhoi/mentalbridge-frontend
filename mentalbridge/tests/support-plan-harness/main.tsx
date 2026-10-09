import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../features/support-plan/components/support-plan.css'

import SupportPlanHero from '@/features/support-plan/components/SupportPlanHero'
import SupportPlanWeekCalendar from '@/features/support-plan/components/SupportPlanWeekCalendar'
import SupportPlanFeaturedActivity from '@/features/support-plan/components/SupportPlanFeaturedActivity'
import SupportPlanActivityRow from '@/features/support-plan/components/SupportPlanActivityRow'
import SupportPlanSidebarCards from '@/features/support-plan/components/SupportPlanSidebarCards'
import SupportPlanFooter from '@/features/support-plan/components/SupportPlanFooter'
import SupportPlanIcon from '@/features/support-plan/components/SupportPlanIcon'
import type { SupportPlanOccurrence } from '@/features/support-plan/api/support-plan-contract'

const mockOccurrences: SupportPlanOccurrence[] = [
  {
    occurrenceId: 'occ-1',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-1',
    scheduleVersion: 1,
    localDate: '2026-10-01',
    localTime: '08:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-10-01T01:00:00Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    version: 0,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'depressive-psychoeducation',
      resourceId: 'res-101',
      contentVersion: '4',
      title: 'Hiểu các dấu hiệu thường gặp của trầm cảm nhẹ',
    },
    updatedAt: '2026-10-01T00:00:00Z',
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: null,
    barrierCode: null,
    reflection: null,
    summaryReuseApproved: false,
    engagementUpdatedAt: null,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
  {
    occurrenceId: 'occ-2',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-2',
    scheduleVersion: 1,
    localDate: '2026-10-01',
    localTime: '10:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-10-01T03:00:00Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    version: 0,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'micro-habit',
      resourceId: 'res-102',
      contentVersion: '2',
      title: 'Bắt đầu bằng một hành động nhỏ: Uống 1 cốc nước ấm và vươn vai',
    },
    updatedAt: '2026-10-01T00:00:00Z',
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: null,
    barrierCode: null,
    reflection: null,
    summaryReuseApproved: false,
    engagementUpdatedAt: null,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
  {
    occurrenceId: 'occ-3',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-3',
    scheduleVersion: 1,
    localDate: '2026-10-01',
    localTime: '14:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-10-01T07:00:00Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    version: 0,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'anxiety-relief',
      resourceId: 'res-103',
      contentVersion: '3',
      title:
        'Chuẩn bị một nhịp ngủ dễ chịu hơn: Giảm ánh sáng xanh & thư giãn cơ tiến triển (PMR)',
    },
    updatedAt: '2026-10-01T00:00:00Z',
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: null,
    barrierCode: null,
    reflection: null,
    summaryReuseApproved: false,
    engagementUpdatedAt: null,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
  {
    occurrenceId: 'occ-4',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-4',
    scheduleVersion: 1,
    localDate: '2026-09-28',
    localTime: '08:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-09-28T01:00:00Z',
    state: 'COMPLETED',
    displayState: 'COMPLETED',
    stateReason: null,
    version: 1,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'breathing',
      resourceId: 'res-104',
      contentVersion: '1',
      title: 'Thở 4-7-8 giúp tĩnh tâm',
    },
    updatedAt: '2026-09-28T00:00:00Z',
    completedAt: '2026-09-28T01:15:00Z',
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: 'HELPFUL',
    barrierCode: null,
    reflection: 'Cảm thấy bình tĩnh hơn nhiều sau bài tập thở.',
    summaryReuseApproved: true,
    engagementUpdatedAt: '2026-09-28T01:15:00Z',
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
  {
    occurrenceId: 'occ-5',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-5',
    scheduleVersion: 1,
    localDate: '2026-09-29',
    localTime: '08:30:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-09-29T01:30:00Z',
    state: 'COMPLETED',
    displayState: 'COMPLETED',
    stateReason: null,
    version: 1,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'stretch',
      resourceId: 'res-105',
      contentVersion: '1',
      title: 'Giãn cơ nhẹ đầu ngày',
    },
    updatedAt: '2026-09-29T00:00:00Z',
    completedAt: '2026-09-29T01:45:00Z',
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: 'VERY_HELPFUL',
    barrierCode: null,
    reflection: null,
    summaryReuseApproved: true,
    engagementUpdatedAt: '2026-09-29T01:45:00Z',
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
  {
    occurrenceId: 'occ-6',
    supportPlanId: 'plan-1',
    scheduleId: 'sch-6',
    scheduleVersion: 1,
    localDate: '2026-09-30',
    localTime: '15:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-09-30T08:00:00Z',
    state: 'COMPLETED',
    displayState: 'COMPLETED',
    stateReason: null,
    version: 1,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'walk',
      resourceId: 'res-106',
      contentVersion: '1',
      title: 'Đi dạo 10 phút ngoài trời',
    },
    updatedAt: '2026-09-30T00:00:00Z',
    completedAt: '2026-09-30T08:15:00Z',
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: 'HELPFUL',
    barrierCode: null,
    reflection: 'Không khí thoáng mát giúp đầu óc nhẹ nhõm hơn.',
    summaryReuseApproved: true,
    engagementUpdatedAt: '2026-09-30T08:15:00Z',
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  },
]

function SupportPlanPreviewApp() {
  const [activeTab, setActiveTab] = useState<'plan' | 'schedule' | 'manage'>(
    'schedule',
  )
  const [selectedDate, setSelectedDate] = useState('2026-10-01')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const weekDays = [
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
  ]

  const today = '2026-10-01'

  const stats = {
    completed: 3,
    total: 7,
    percent: 43,
    remaining: 4,
  }

  const screeningData = {
    gad7Score: 7,
    gad7Max: 21,
    phq9Score: 5,
    phq9Max: 27,
  }

  const selectedDateItems = mockOccurrences.filter(
    (o) => o.localDate === selectedDate,
  )

  return (
    <div
      style={{
        background: '#f8faf4',
        minHeight: '100vh',
        padding: '1.5rem 2rem',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div className="support-plan-page" style={{ padding: 0 }}>
          {/* 1. Hero Banner */}
          <SupportPlanHero stats={stats} />

          {/* 2. Nav row: Segmented pill tabs & date chip */}
          <div className="support-plan-nav-row">
            <nav
              className="support-plan-tabs"
              role="tablist"
              aria-label="Phân loại kế hoạch hỗ trợ"
            >
              <button
                type="button"
                className={`support-plan-tab-btn ${activeTab === 'plan' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('plan')}
              >
                Kế hoạch
              </button>
              <button
                type="button"
                className={`support-plan-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('schedule')}
              >
                Hoạt động của tôi
              </button>
              <button
                type="button"
                className={`support-plan-tab-btn ${activeTab === 'manage' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('manage')}
              >
                Quản lý &amp; Lịch sử
              </button>
            </nav>

            <div className="support-plan-nav-controls">
              <div className="support-plan-date-chip">
                <span
                  className="material-symbols-outlined text-[16px] text-secondary"
                  aria-hidden="true"
                >
                  calendar_today
                </span>
                <span className="font-semibold text-on-surface">
                  Tháng 10, 2026
                </span>
                <span className="text-outline">·</span>
                <span>Tuần 1</span>
              </div>
            </div>
          </div>

          {/* 3. Schedule View */}
          <section className="support-plan-schedule">
            {/* 7-Day Interactive Calendar */}
            <SupportPlanWeekCalendar
              weekDays={weekDays}
              selectedDate={selectedDate}
              today={today}
              occurrences={mockOccurrences}
              onSelectDate={(d) => setSelectedDate(d)}
              onPrevWeek={() => {}}
              onNextWeek={() => {}}
              weekRangeLabel="28 Tháng 9 - 4 Tháng 10, 2026"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Main 2-Column Grid */}
            <div className="support-plan-content-grid">
              {/* Left Column (8 cols): Activities */}
              <div className="support-plan-activities-col">
                <div className="support-plan-col-header">
                  <div className="flex items-center gap-2">
                    <h4 className="support-plan-section-title">
                      {selectedDate === today
                        ? 'Hoạt động hôm nay (Thứ 5, 01/10)'
                        : `Hoạt động ngày ${selectedDate}`}
                    </h4>
                    <span className="support-plan-count-badge">
                      {selectedDateItems.length} mục
                    </span>
                  </div>
                </div>

                <div className="support-plan-activities-list">
                  {selectedDateItems[0] && (
                    <SupportPlanFeaturedActivity
                      occurrence={selectedDateItems[0]}
                      authoritativePlanStatus="ACTIVE"
                      busy={false}
                      isEditing={false}
                      onStartEditing={() => {}}
                      onReopen={() => {}}
                      onToggleVisibility={() => {}}
                      onRemove={() => {}}
                      renderForm={() => null}
                    />
                  )}

                  {selectedDateItems.length > 1 && (
                    <div className="support-plan-rows-container">
                      {selectedDateItems.slice(1).map((item) => (
                        <SupportPlanActivityRow
                          key={item.occurrenceId}
                          occurrence={item}
                          authoritativePlanStatus="ACTIVE"
                          busy={false}
                          isEditing={false}
                          onStartEditing={() => {}}
                          onReopen={() => {}}
                          onToggleVisibility={() => {}}
                          onRemove={() => {}}
                          renderForm={() => null}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="support-plan-schedule-boundary">
                  <SupportPlanIcon
                    name="info"
                    size={16}
                    className="support-plan-boundary-icon"
                  />
                  <p>
                    Đây là thông tin bạn tự ghi nhận cho riêng mình, không phải
                    đánh giá tuân thủ điều trị, kết quả lâm sàng hay mức độ hồi
                    phục. Chuyên gia không theo dõi trực tiếp danh sách này. Chỉ
                    trạng thái hoạt động mà bạn cho phép và duyệt mới có thể
                    dùng trong bản tóm tắt; ghi chú riêng không được chia sẻ.
                  </p>
                </div>
              </div>

              {/* Right Column (4 cols): Sidebar Cards */}
              <SupportPlanSidebarCards
                planStatus="ACTIVE"
                onToggleStatus={() => {}}
                onSwitchToManageTab={() => setActiveTab('manage')}
              />
            </div>
          </section>

          {/* 4. Footer */}
          <SupportPlanFooter updatedAt="2026-10-01T00:30:00Z" />
        </div>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<SupportPlanPreviewApp />)
