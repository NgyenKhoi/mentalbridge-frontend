'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Star,
  Search,
  Download,
  RotateCw,
  MessageSquareQuote,
  CheckCircle2,
  Clock,
  Sparkles,
  Stethoscope,
  User,
  MessageCircle,
  FileCheck2,
  X,
  Send,
  SlidersHorizontal,
  Database,
  Award,
  AlertCircle,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'
import './admin-feedback-manager.css'

export type FeedbackTarget = 'CLIENT' | 'SPECIALIST'
export type FeedbackStatus = 'RESOLVED' | 'IN_PROGRESS' | 'PENDING'

export interface RealFeedbackItem {
  id: string
  category: FeedbackTarget
  topic: string
  authorName: string
  authorRole: string
  authorEmail?: string | null
  targetSpecialist?: string | null
  sessionId?: string | null
  sessionCode?: string | null
  rating: number
  title: string
  content: string
  tags: string[]
  status: FeedbackStatus
  createdAt: string
  updatedAt?: string
  adminResponse?: string | null
  adminRespondedAt?: string | null
  internalNotes?: string | null
}

export interface SpecialistScorecard {
  id: string
  name: string
  ratingCount: number
  avgRating: number
}

export interface FeedbackKpis {
  overallCsat: number
  totalRatingsCount: number
  clientFeedbackCount: number
  specialistFeedbackCount: number
  pendingActionCount: number
  resolutionRate: number
}

const QUICK_TEMPLATES = [
  {
    label: 'Tiếp nhận & Cảm ơn',
    text: 'Phòng Quản lý Chất lượng EMR & Telehealth MentalBridge chân thành cảm ơn ý kiến đóng góp của bạn. Chúng tôi đã ghi nhận và tiếp thu để nâng cao trải nghiệm dịch vụ.',
    status: 'RESOLVED' as FeedbackStatus,
  },
  {
    label: 'Xác minh đối soát Napas247',
    text: 'Bộ phận Tài chính & Đối soát đã kiểm tra giao dịch qua cổng Napas247/PayOS, các thông số thù lao và khấu trừ minh bạch đã được xác nhận khớp đúng 100%.',
    status: 'RESOLVED' as FeedbackStatus,
  },
  {
    label: 'Xác nhận chất lượng ca tư vấn',
    text: 'Đội ngũ Giám sát lâm sàng đã rà soát hồ sơ phiên tham vấn và xác nhận chất lượng dịch vụ đạt tiêu chuẩn chăm sóc y tế an toàn.',
    status: 'RESOLVED' as FeedbackStatus,
  },
  {
    label: 'Chuyển đội ngũ kỹ thuật',
    text: 'MentalBridge đã ghi nhận vấn đề và chuyển tới đội ngũ kỹ thuật để tối ưu trong phiên bản cập nhật kế tiếp.',
    status: 'IN_PROGRESS' as FeedbackStatus,
  },
]

export default function AdminFeedbackManager() {
  const [feedbacks, setFeedbacks] = useState<RealFeedbackItem[]>([])
  const [specialists, setSpecialists] = useState<SpecialistScorecard[]>([])
  const [kpis, setKpis] = useState<FeedbackKpis>({
    overallCsat: 4.81,
    totalRatingsCount: 216,
    clientFeedbackCount: 7,
    specialistFeedbackCount: 4,
    pendingActionCount: 2,
    resolutionRate: 82,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asOf, setAsOf] = useState<string>('')

  // Filters & State
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'CLIENT' | 'SPECIALIST' | 'PENDING'
  >('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL')
  const [selectedRating, setSelectedRating] = useState<number | 'ALL'>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | 'ALL'>(
    'ALL',
  )

  // Modal State for Full Detail & Processing Popup
  const [selectedFeedback, setSelectedFeedback] =
    useState<RealFeedbackItem | null>(null)
  const [responseText, setResponseText] = useState('')
  const [responseStatus, setResponseStatus] =
    useState<FeedbackStatus>('RESOLVED')
  const [internalNoteText, setInternalNoteText] = useState('')
  const [savingResponse, setSavingResponse] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch real data from /api/admin/feedback
  const fetchFeedbackData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/feedback', {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error(`Lỗi kết nối máy chủ (${res.status})`)
      }
      const data = await res.json()
      if (data.feedbacks) {
        setFeedbacks(data.feedbacks)
      }
      if (data.kpis) {
        setKpis(data.kpis)
      }
      if (data.specialists) {
        setSpecialists(data.specialists)
      }
      if (data.asOf) {
        setAsOf(new Date(data.asOf).toLocaleTimeString('vi-VN'))
      }
    } catch (err: unknown) {
      console.error('[AdminFeedbackManager] Failed to fetch:', err)
      setError(
        err instanceof Error ? err.message : 'Không thể tải dữ liệu phản hồi.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFeedbackData()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchFeedbackData])

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedFeedback) {
        setSelectedFeedback(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFeedback])

  // Copy helper
  const handleCopyText = (text: string, fieldName = 'text') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  // Available topics for filtering
  const availableTopics = useMemo(() => {
    const set = new Set<string>()
    feedbacks.forEach((f) => {
      if (f.topic) set.add(f.topic)
    })
    return Array.from(set)
  }, [feedbacks])

  // Filtered feedbacks
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      // Tab filter
      if (activeTab === 'CLIENT' && item.category !== 'CLIENT') return false
      if (activeTab === 'SPECIALIST' && item.category !== 'SPECIALIST')
        return false
      if (activeTab === 'PENDING' && item.status === 'RESOLVED') return false

      // Topic filter
      if (selectedTopic !== 'ALL' && item.topic !== selectedTopic) return false

      // Rating filter
      if (selectedRating !== 'ALL') {
        if (selectedRating === 4 && item.rating !== 4) return false
        if (selectedRating === 5 && item.rating !== 5) return false
        if (selectedRating === 3 && item.rating !== 3) return false
        if (selectedRating === 2 && item.rating > 2) return false
      }

      // Status filter
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus)
        return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesContent = item.content.toLowerCase().includes(q)
        const matchesTitle = item.title.toLowerCase().includes(q)
        const matchesAuthor = item.authorName.toLowerCase().includes(q)
        const matchesEmail = item.authorEmail
          ? item.authorEmail.toLowerCase().includes(q)
          : false
        const matchesSpecialist = item.targetSpecialist
          ? item.targetSpecialist.toLowerCase().includes(q)
          : false
        const matchesSession = item.sessionCode
          ? item.sessionCode.toLowerCase().includes(q)
          : false
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q))
        return (
          matchesContent ||
          matchesTitle ||
          matchesAuthor ||
          matchesEmail ||
          matchesSpecialist ||
          matchesSession ||
          matchesTags
        )
      }

      return true
    })
  }, [
    feedbacks,
    activeTab,
    selectedTopic,
    selectedRating,
    selectedStatus,
    searchQuery,
  ])

  // Handle open detail popup
  const handleOpenDetailModal = (item: RealFeedbackItem) => {
    setSelectedFeedback(item)
    setResponseText(item.adminResponse || '')
    setResponseStatus(item.status)
    setInternalNoteText(item.internalNotes || '')
    setCopiedField(null)
  }

  // Handle apply quick template
  const handleApplyTemplate = (
    tmplText: string,
    tmplStatus: FeedbackStatus,
  ) => {
    setResponseText(tmplText)
    setResponseStatus(tmplStatus)
  }

  // Handle save response to real database
  const handleSaveResponse = async () => {
    if (!selectedFeedback) return
    setSavingResponse(true)
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedFeedback.id,
          status: responseStatus,
          adminResponse: responseText.trim() || undefined,
          internalNotes: internalNoteText.trim() || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Lỗi khi lưu phản hồi vào cơ sở dữ liệu')
      }

      const updated = await res.json()
      if (updated.success && updated.feedback) {
        setFeedbacks((prev) =>
          prev.map((item) =>
            item.id === selectedFeedback.id
              ? {
                  ...item,
                  status: updated.feedback.status,
                  adminResponse: updated.feedback.adminResponse,
                  adminRespondedAt: updated.feedback.adminRespondedAt,
                  internalNotes: updated.feedback.internalNotes,
                }
              : item,
          ),
        )
        // Refresh telemetry & KPI
        fetchFeedbackData()
      }
      setSelectedFeedback(null)
    } catch (err: unknown) {
      console.error('Failed to update feedback:', err)
      alert(err instanceof Error ? err.message : 'Không thể lưu phản hồi')
    } finally {
      setSavingResponse(false)
    }
  }

  // Handle CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Mã phản hồi',
      'Phân loại',
      'Chủ đề',
      'Người gửi',
      'Vai trò',
      'Email',
      'Chuyên gia phụ trách',
      'Mã ca khám',
      'Điểm đánh giá',
      'Tiêu đề',
      'Nội dung',
      'Thẻ (Tags)',
      'Trạng thái',
      'Ngày gửi',
      'Phản hồi Admin',
      'Ghi chú nội bộ',
    ]

    const rows = filteredFeedbacks.map((f) => [
      `"${f.id}"`,
      `"${f.category === 'CLIENT' ? 'Khách hàng' : 'Bác sĩ & Chuyên gia'}"`,
      `"${f.topic}"`,
      `"${f.authorName}"`,
      `"${f.authorRole}"`,
      `"${f.authorEmail || ''}"`,
      `"${f.targetSpecialist || 'N/A'}"`,
      `"${f.sessionCode || 'N/A'}"`,
      f.rating,
      `"${f.title.replace(/"/g, '""')}"`,
      `"${f.content.replace(/"/g, '""')}"`,
      `"${f.tags.join(', ')}"`,
      `"${f.status === 'RESOLVED' ? 'Đã giải quyết' : f.status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Đã ghi nhận'}"`,
      `"${f.createdAt}"`,
      `"${(f.adminResponse || '').replace(/"/g, '""')}"`,
      `"${(f.internalNotes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Bao_cao_CSAT_MentalBridge_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-feedback-workspace">
      {/* Real PostgreSQL Authoritative Telemetry Banner */}
      <div className="feedback-telemetry-banner">
        <div className="feedback-telemetry-left">
          <Database size={15} className="telemetry-icon-pulse" />
          <span className="telemetry-badge-dot">●</span>
          <span className="telemetry-strong">
            DỮ LIỆU ĐỐI SOÁT AUTHORITATIVE TỪ POSTGRESQL RDS
          </span>
          <span className="telemetry-divider">|</span>
          <span>
            {kpis.totalRatingsCount} lượt đánh giá lâm sàng tích lũy (
            {specialists.length} chuyên gia)
          </span>
          {asOf && (
            <span className="telemetry-asof">• Cập nhật lúc {asOf}</span>
          )}
        </div>
        <div className="feedback-telemetry-right">
          <button
            onClick={() => fetchFeedbackData(true)}
            className="feedback-sync-btn"
            disabled={refreshing}
            title="Đồng bộ lại dữ liệu trực tiếp từ PostgreSQL"
          >
            <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang đồng bộ...' : 'Làm mới Live Sync'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="admin-feedback-header">
        <div className="feedback-header-titles">
          <div className="feedback-header-pre">
            QUẢN TRỊ TRẢI NGHIỆM & CHẤT LƯỢNG Y TẾ
          </div>
          <h1 className="feedback-header-title">
            Ý kiến & Phản hồi Người dùng
          </h1>
          <p className="feedback-header-desc">
            Giám sát chỉ số hài lòng thực tế (CSAT), phản hồi dịch vụ từ Khách
            hàng và chuyên gia y tế, điều phối xử lý theo tiêu chuẩn an toàn lâm
            sàng.
          </p>
        </div>
        <div className="feedback-header-actions">
          <button
            onClick={handleExportCsv}
            className="feedback-btn-secondary"
            title="Xuất bảng thống kê CSAT ra định dạng CSV"
          >
            <Download size={15} />
            <span>Xuất báo cáo CSAT (CSV)</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="feedback-kpi-grid">
        <div className="feedback-kpi-card csat-card">
          <div className="kpi-top">
            <span className="kpi-title">Điểm CSAT Toàn Nền tảng</span>
            <span className="kpi-icon-pill csat">
              <Star size={16} fill="currentColor" />
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{kpis.overallCsat.toFixed(2)}</span>
            <span className="kpi-max">/ 5.0</span>
          </div>
          <div
            className="kpi-stars"
            aria-label={`Đánh giá ${kpis.overallCsat} sao`}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={16}
                fill={i <= Math.round(kpis.overallCsat) ? '#f59e0b' : 'none'}
                stroke={
                  i <= Math.round(kpis.overallCsat) ? '#f59e0b' : '#cbd5e1'
                }
              />
            ))}
          </div>
          <div className="kpi-subtext">
            Dựa trên {kpis.totalRatingsCount} lượt đánh giá thực tế
          </div>
        </div>

        <div className="feedback-kpi-card client-card">
          <div className="kpi-top">
            <span className="kpi-title">Phản hồi Khách hàng</span>
            <span className="kpi-icon-pill client">
              <User size={16} />
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{kpis.clientFeedbackCount}</span>
            <span className="kpi-unit">lượt</span>
          </div>
          <div className="kpi-progress-bar">
            <div
              className="kpi-progress-fill client"
              style={{
                width: `${(kpis.clientFeedbackCount / (feedbacks.length || 1)) * 100}%`,
              }}
            />
          </div>
          <div className="kpi-subtext">Từ thân chủ & người tham gia tư vấn</div>
        </div>

        <div className="feedback-kpi-card specialist-card">
          <div className="kpi-top">
            <span className="kpi-title">Ý kiến Chuyên gia & Bác sĩ</span>
            <span className="kpi-icon-pill specialist">
              <Stethoscope size={16} />
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{kpis.specialistFeedbackCount}</span>
            <span className="kpi-unit">ý kiến</span>
          </div>
          <div className="kpi-progress-bar">
            <div
              className="kpi-progress-fill specialist"
              style={{
                width: `${(kpis.specialistFeedbackCount / (feedbacks.length || 1)) * 100}%`,
              }}
            />
          </div>
          <div className="kpi-subtext">
            Đóng góp về EMR, Payout & ca lâm sàng
          </div>
        </div>

        <div className="feedback-kpi-card progress-card">
          <div className="kpi-top">
            <span className="kpi-title">Tiến độ Điều phối</span>
            <span className="kpi-icon-pill progress">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{kpis.resolutionRate}%</span>
            <span className="kpi-status-badge">
              {kpis.pendingActionCount === 0
                ? 'Hoàn tất 100%'
                : `${kpis.pendingActionCount} cần xử lý`}
            </span>
          </div>
          <div className="kpi-progress-bar">
            <div
              className="kpi-progress-fill progress"
              style={{ width: `${kpis.resolutionRate}%` }}
            />
          </div>
          <div className="kpi-subtext">
            {kpis.pendingActionCount === 0
              ? 'Tất cả ý kiến đã được phản hồi'
              : `${kpis.pendingActionCount} phản hồi đang trong tiến trình xử lý`}
          </div>
        </div>
      </div>

      {/* Real Specialist Rating Breakdown Cards */}
      {specialists.length > 0 && (
        <div className="specialists-csat-bar">
          <div className="specialists-csat-title">
            <Award size={16} className="text-emerald-700" />
            <span>
              Chỉ số CSAT thực tế theo từng Bác sĩ & Chuyên gia (PostgreSQL
              Aggregates):
            </span>
          </div>
          <div className="specialists-csat-cards">
            {specialists.map((s) => (
              <div key={s.id} className="spec-csat-chip">
                <span className="spec-name">{s.name}</span>
                <span className="spec-score">{s.avgRating.toFixed(2)}★</span>
                <span className="spec-count">({s.ratingCount} đánh giá)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Filter and Tabs Toolbar */}
      <div className="feedback-controls-card">
        {/* Navigation Tabs */}
        <div className="feedback-tabs-row" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'ALL'}
            className={`feedback-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            <MessageSquareQuote size={15} />
            <span>Tất cả phản hồi</span>
            <span className="tab-badge">{feedbacks.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'CLIENT'}
            className={`feedback-tab-btn ${activeTab === 'CLIENT' ? 'active' : ''}`}
            onClick={() => setActiveTab('CLIENT')}
          >
            <User size={15} />
            <span>Khách hàng & Bệnh nhân</span>
            <span className="tab-badge client">{kpis.clientFeedbackCount}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'SPECIALIST'}
            className={`feedback-tab-btn ${activeTab === 'SPECIALIST' ? 'active' : ''}`}
            onClick={() => setActiveTab('SPECIALIST')}
          >
            <Stethoscope size={15} />
            <span>Bác sĩ & Chuyên gia</span>
            <span className="tab-badge specialist">
              {kpis.specialistFeedbackCount}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'PENDING'}
            className={`feedback-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
            onClick={() => setActiveTab('PENDING')}
          >
            <Clock size={15} />
            <span>Cần phản hồi & Xử lý</span>
            {kpis.pendingActionCount > 0 && (
              <span className="tab-badge pending">
                {kpis.pendingActionCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="feedback-filters-bar">
          <div className="feedback-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo nội dung, tên người gửi, email, chuyên gia, mã ca khám..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="feedback-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="search-clear-btn"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="feedback-dropdowns">
            <div className="filter-dropdown-wrapper">
              <label htmlFor="filter-rating" className="filter-label">
                Đánh giá:
              </label>
              <select
                id="filter-rating"
                value={selectedRating}
                onChange={(e) =>
                  setSelectedRating(
                    e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                  )
                }
                className="filter-select"
              >
                <option value="ALL">Tất cả số sao</option>
                <option value="5">5 sao (Xuất sắc)</option>
                <option value="4">4 sao (Rất tốt)</option>
                <option value="3">3 sao (Đạt yêu cầu)</option>
                <option value="2">1-2 sao (Cần cải thiện)</option>
              </select>
            </div>

            <div className="filter-dropdown-wrapper">
              <label htmlFor="filter-topic" className="filter-label">
                Chủ đề:
              </label>
              <select
                id="filter-topic"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">Tất cả chủ đề</option>
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-dropdown-wrapper">
              <label htmlFor="filter-status" className="filter-label">
                Trạng thái:
              </label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as FeedbackStatus | 'ALL')
                }
                className="filter-select"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="RESOLVED">Đã giải quyết</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="PENDING">Chờ xử lý</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Feed List */}
      <div className="feedback-list-section">
        <div className="feedback-list-head">
          <div className="list-count-text">
            Hiển thị <strong>{filteredFeedbacks.length}</strong> /{' '}
            {feedbacks.length} phản hồi từ cơ sở dữ liệu
          </div>
          {(searchQuery ||
            selectedTopic !== 'ALL' ||
            selectedRating !== 'ALL' ||
            selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedTopic('ALL')
                setSelectedRating('ALL')
                setSelectedStatus('ALL')
              }}
              className="feedback-reset-filters-btn"
            >
              <SlidersHorizontal size={13} />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {error && (
          <div className="feedback-error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              onClick={() => fetchFeedbackData(true)}
              className="btn-retry"
            >
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="feedback-loading-card">
            <RotateCw size={24} className="animate-spin text-emerald-700" />
            <p>Đang tải dữ liệu phản hồi từ PostgreSQL RDS...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="feedback-empty-card">
            <MessageSquareQuote size={40} className="empty-icon" />
            <h3>Không tìm thấy phản hồi phù hợp</h3>
            <p>Thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
          </div>
        ) : (
          /* Giao diện danh sách ban đầu HIỂN THỊ GỌN (Compact Card List) */
          <div className="feedback-cards-grid compact-grid">
            {filteredFeedbacks.map((item) => (
              <div
                key={item.id}
                className={`feedback-compact-card ${item.category === 'CLIENT' ? 'client-type' : 'specialist-type'}`}
                onClick={() => handleOpenDetailModal(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpenDetailModal(item)
                  }
                }}
                title="Nhấp để xem chi tiết đầy đủ và xử lý phản hồi"
              >
                {/* Compact Card Header */}
                <div className="compact-card-header">
                  <div className="compact-author-group">
                    <div
                      className={`compact-avatar ${item.category === 'CLIENT' ? 'avatar-client' : 'avatar-specialist'}`}
                    >
                      {item.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="compact-author-details">
                      <div className="compact-name-line">
                        <strong className="compact-author-name">
                          {item.authorName}
                        </strong>
                        <span
                          className={`compact-role-pill ${item.category === 'CLIENT' ? 'role-client' : 'role-specialist'}`}
                        >
                          {item.category === 'CLIENT' ? (
                            <>
                              <User size={11} /> Khách hàng
                            </>
                          ) : (
                            <>
                              <Stethoscope size={11} /> Bác sĩ / Chuyên gia
                            </>
                          )}
                        </span>
                        <span className="compact-dot">•</span>
                        <span className="compact-time">
                          {new Date(item.createdAt).toLocaleDateString(
                            'vi-VN',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            },
                          )}
                        </span>
                      </div>
                      {item.authorEmail && (
                        <div className="compact-email-sub">
                          {item.authorEmail}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="compact-badges-group">
                    {/* Star Rating Badge */}
                    <div
                      className="compact-star-chip"
                      aria-label={`Đánh giá: ${item.rating}/5 sao`}
                    >
                      <span className="star-num">{item.rating}</span>
                      <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                    </div>

                    {/* Admin response badge */}
                    {item.adminResponse ? (
                      <span
                        className="compact-reply-badge replied"
                        title="Đã có phản hồi chính thức từ Admin"
                      >
                        <CheckCircle2 size={11} /> Đã phản hồi
                      </span>
                    ) : (
                      <span
                        className="compact-reply-badge unreplied"
                        title="Chưa có phản hồi từ Admin"
                      >
                        <Clock size={11} /> Chưa phản hồi
                      </span>
                    )}

                    {/* Resolution Status Chip */}
                    <span
                      className={`compact-status-chip ${
                        item.status === 'RESOLVED'
                          ? 'chip-resolved'
                          : item.status === 'IN_PROGRESS'
                            ? 'chip-progress'
                            : 'chip-pending'
                      }`}
                    >
                      {item.status === 'RESOLVED'
                        ? 'Đã giải quyết'
                        : item.status === 'IN_PROGRESS'
                          ? 'Đang xử lý'
                          : 'Chờ xử lý'}
                    </span>
                  </div>
                </div>

                {/* Compact Card Middle: Title & 1-line Excerpt */}
                <div className="compact-content-group">
                  <h4 className="compact-title">{item.title}</h4>
                  <p className="compact-excerpt">{item.content}</p>
                </div>

                {/* Compact Card Footer: Meta tags & Action Hint */}
                <div className="compact-footer-row">
                  <div className="compact-meta-left">
                    <span className="compact-topic-pill">
                      <Sparkles size={11} /> {item.topic}
                    </span>
                    {item.targetSpecialist && (
                      <span className="compact-spec-pill">
                        BS: <strong>{item.targetSpecialist}</strong>
                      </span>
                    )}
                    {item.sessionCode && (
                      <span className="compact-session-pill">
                        Ca: <code>{item.sessionCode}</code>
                      </span>
                    )}
                    {item.tags.length > 0 && (
                      <span className="compact-tag-preview">
                        #{item.tags[0]}{' '}
                        {item.tags.length > 1 ? `+${item.tags.length - 1}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="compact-action-cta">
                    <span>Chi tiết & Xử lý</span>
                    <ChevronRight size={14} className="cta-chevron" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POPUP CHI TIẾT & ĐẦY ĐỦ CÁC THAO TÁC XỬ LÝ (Detail & Processing Modal) */}
      {selectedFeedback && (
        <div
          className="feedback-modal-backdrop"
          onClick={() => setSelectedFeedback(null)}
        >
          <div
            className="feedback-modal-window feedback-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-detail-title"
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-pre-line">
                  <span className="modal-pre-badge">
                    QUẢN TRỊ TRẢI NGHIỆM LÂM SÀNG
                  </span>
                  <span className="modal-id-badge">
                    ID: {selectedFeedback.id}
                  </span>
                  <span className="modal-rds-badge">● Authoritative RDS</span>
                </div>
                <h3 id="feedback-detail-title" className="modal-title">
                  {selectedFeedback.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="modal-close-btn"
                aria-label="Đóng cửa sổ"
                title="Đóng (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="modal-body custom-scrollbar">
              {/* Khối 1: Thông tin người gửi & Bối cảnh ca khám */}
              <div className="modal-section-card profile-context-card">
                <div className="profile-context-header">
                  <div
                    className={`profile-avatar-large ${selectedFeedback.category === 'CLIENT' ? 'avatar-client' : 'avatar-specialist'}`}
                  >
                    {selectedFeedback.authorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="profile-info-col">
                    <div className="profile-name-row">
                      <h4 className="profile-full-name">
                        {selectedFeedback.authorName}
                      </h4>
                      <span
                        className={`compact-role-pill ${selectedFeedback.category === 'CLIENT' ? 'role-client' : 'role-specialist'}`}
                      >
                        {selectedFeedback.category === 'CLIENT' ? (
                          <>
                            <User size={12} /> Khách hàng
                          </>
                        ) : (
                          <>
                            <Stethoscope size={12} /> Bác sĩ / Chuyên gia
                          </>
                        )}
                      </span>
                    </div>
                    <div className="profile-meta-row">
                      <span>{selectedFeedback.authorRole}</span>
                      {selectedFeedback.authorEmail && (
                        <>
                          <span className="dot-sep">•</span>
                          <span className="author-email-link">
                            {selectedFeedback.authorEmail}
                          </span>
                        </>
                      )}
                      <span className="dot-sep">•</span>
                      <span>
                        Gửi lúc:{' '}
                        {new Date(selectedFeedback.createdAt).toLocaleString(
                          'vi-VN',
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="profile-rating-box">
                    <div className="rating-score-big">
                      {selectedFeedback.rating}.0
                    </div>
                    <div className="stars-row-modal">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          fill={
                            star <= selectedFeedback.rating ? '#f59e0b' : 'none'
                          }
                          stroke={
                            star <= selectedFeedback.rating
                              ? '#f59e0b'
                              : '#cbd5e1'
                          }
                        />
                      ))}
                    </div>
                    <div className="rating-label-sub">
                      {selectedFeedback.rating === 5
                        ? 'Rất hài lòng'
                        : selectedFeedback.rating === 4
                          ? 'Hài lòng'
                          : selectedFeedback.rating === 3
                            ? 'Bình thường'
                            : 'Cần cải thiện'}
                    </div>
                  </div>
                </div>

                {/* Context metadata grid */}
                <div className="context-meta-grid">
                  <div className="context-meta-item">
                    <span className="meta-item-label">Chủ đề phản hồi:</span>
                    <span className="meta-item-value topic-badge">
                      <Sparkles size={12} /> {selectedFeedback.topic}
                    </span>
                  </div>
                  {selectedFeedback.targetSpecialist && (
                    <div className="context-meta-item">
                      <span className="meta-item-label">
                        Chuyên gia phụ trách:
                      </span>
                      <span className="meta-item-value font-medium text-slate-800">
                        {selectedFeedback.targetSpecialist}
                      </span>
                    </div>
                  )}
                  {selectedFeedback.sessionCode && (
                    <div className="context-meta-item">
                      <span className="meta-item-label">Mã ca khám:</span>
                      <span className="meta-item-value session-code-value">
                        <code>{selectedFeedback.sessionCode}</code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              selectedFeedback.sessionCode || '',
                              'sessionCode',
                            )
                          }
                          className="btn-copy-mini"
                          title="Sao chép mã ca khám"
                        >
                          {copiedField === 'sessionCode' ? (
                            <Check size={11} className="text-emerald-600" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Khối 2: Nội dung ý kiến nguyên văn đầy đủ */}
              <div className="modal-section-card content-display-card">
                <div className="section-card-title">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={15} className="text-emerald-700" />
                    <span>Nội dung ý kiến đóng góp (Nguyên văn)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(selectedFeedback.content, 'content')
                    }
                    className="btn-copy-text"
                    title="Sao chép nội dung"
                  >
                    {copiedField === 'content' ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">
                          Đã sao chép!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Sao chép nội dung</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="feedback-full-quote">
                  <p className="full-content-text">
                    {selectedFeedback.content}
                  </p>
                </div>

                {selectedFeedback.tags.length > 0 && (
                  <div className="feedback-modal-tags">
                    {selectedFeedback.tags.map((tag, idx) => (
                      <span key={idx} className="modal-tag-pill">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Khối 3: ĐẦY ĐỦ CÁC THAO TÁC XỬ LÝ & ĐIỀU PHỐI */}
              <div className="modal-section-card action-processing-card">
                <div className="section-card-title-main">
                  <SlidersHorizontal size={16} className="text-emerald-700" />
                  <span>Thao tác xử lý & Điều phối phản hồi</span>
                </div>

                {/* Thao tác 1: Chọn trạng thái xử lý */}
                <div className="action-status-selector">
                  <label className="action-sub-label">
                    Trạng thái điều phối:
                  </label>
                  <div className="status-toggle-options">
                    <button
                      type="button"
                      className={`status-toggle-btn pending ${responseStatus === 'PENDING' ? 'active' : ''}`}
                      onClick={() => setResponseStatus('PENDING')}
                    >
                      <Clock size={14} />
                      <span>Chờ xử lý / Đã ghi nhận</span>
                    </button>
                    <button
                      type="button"
                      className={`status-toggle-btn progress ${responseStatus === 'IN_PROGRESS' ? 'active' : ''}`}
                      onClick={() => setResponseStatus('IN_PROGRESS')}
                    >
                      <RotateCw size={14} />
                      <span>Đang xử lý</span>
                    </button>
                    <button
                      type="button"
                      className={`status-toggle-btn resolved ${responseStatus === 'RESOLVED' ? 'active' : ''}`}
                      onClick={() => setResponseStatus('RESOLVED')}
                    >
                      <CheckCircle2 size={14} />
                      <span>Đã giải quyết</span>
                    </button>
                  </div>
                </div>

                {/* Thao tác 2: Mẫu phản hồi nhanh (Quick templates) */}
                <div className="quick-templates-box">
                  <div className="templates-label-row">
                    <span className="templates-title">
                      <Sparkles size={13} className="text-amber-500" />
                      <span>Mẫu phản hồi nhanh 1-Click:</span>
                    </span>
                    <span className="templates-hint">
                      Bấm vào mẫu để tự động điền nội dung
                    </span>
                  </div>
                  <div className="templates-chip-group">
                    {QUICK_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="template-chip-btn"
                        onClick={() =>
                          handleApplyTemplate(tmpl.text, tmpl.status)
                        }
                        title="Bấm để tự động điền mẫu này"
                      >
                        <span>{tmpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thao tác 3: Ô nhập Phản hồi chính thức */}
                <div className="form-field-group">
                  <div className="field-label-row">
                    <label
                      htmlFor="admin-response-input"
                      className="field-label-strong"
                    >
                      Phản hồi chính thức từ Ban Quản trị:
                    </label>
                    <span className="field-badge-public">
                      Hiển thị công khai tới người dùng
                    </span>
                  </div>
                  <textarea
                    id="admin-response-input"
                    rows={4}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Nhập thông điệp hồi đáp thấu cảm, giải pháp hỗ trợ hoặc xác nhận tiếp thu ý kiến đóng góp..."
                    className="action-textarea"
                  />
                  {selectedFeedback.adminRespondedAt && (
                    <div className="previous-response-notice">
                      <FileCheck2 size={12} className="text-emerald-600" />
                      <span>
                        Lần phản hồi gần nhất:{' '}
                        {new Date(
                          selectedFeedback.adminRespondedAt,
                        ).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Thao tác 4: Ghi chú nội bộ lâm sàng */}
                <div className="form-field-group">
                  <div className="field-label-row">
                    <label
                      htmlFor="internal-note-input"
                      className="field-label-strong"
                    >
                      Ghi chú nội bộ lâm sàng & kiểm toán (Bảo mật HIPAA):
                    </label>
                    <span className="field-badge-private">
                      Chỉ lưu hành nội bộ
                    </span>
                  </div>
                  <textarea
                    id="internal-note-input"
                    rows={2}
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    placeholder="Nhập ghi chú kỹ thuật, mã ticket EMR, đối soát kế toán hoặc nhắc nhở theo dõi..."
                    className="action-textarea secondary"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-enhanced">
              <div className="modal-footer-left">
                <span className="footer-status-summary">
                  Trạng thái sẽ lưu:{' '}
                  <strong>
                    {responseStatus === 'RESOLVED'
                      ? 'Đã giải quyết'
                      : responseStatus === 'IN_PROGRESS'
                        ? 'Đang xử lý'
                        : 'Chờ xử lý'}
                  </strong>
                </span>
              </div>

              <div className="modal-footer-right">
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="btn-modal-cancel"
                  disabled={savingResponse}
                >
                  Đóng
                </button>

                {responseStatus !== 'RESOLVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResponseStatus('RESOLVED')
                      if (!responseText.trim()) {
                        setResponseText(
                          'Phòng Quản lý Chất lượng EMR & Telehealth MentalBridge đã rà soát và ghi nhận ý kiến.',
                        )
                      }
                    }}
                    className="btn-modal-quick-resolve"
                    disabled={savingResponse}
                    title="Đổi trạng thái sang Đã giải quyết"
                  >
                    <CheckCircle2 size={14} />
                    <span>Đánh dấu Đã giải quyết</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveResponse}
                  className="btn-modal-save-primary"
                  disabled={savingResponse}
                >
                  {savingResponse ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      <span>Đang lưu vào PostgreSQL...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Lưu xử lý & Phản hồi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
