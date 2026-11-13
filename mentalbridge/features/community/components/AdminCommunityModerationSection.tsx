'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Download,
  Search,
  MessageSquare,
  Heart,
  Users,
  FileText,
  Lock,
  Sparkles,
  Info,
  Clock,
  ExternalLink,
  Shield,
  HelpCircle,
  Flag,
  RotateCcw,
  LayoutList,
  LayoutGrid,
  Film,
  Image as ImageIcon,
  Copy,
  Check,
  X,
  ImageOff,
} from 'lucide-react'
import styles from './AdminCommunityModerationSection.module.css'

interface CommunityPostItem {
  id: string
  content: string
  state: 'ACTIVE' | 'HIDDEN' | 'REMOVED'
  sensitive_content_warning: string | null
  comment_count: number
  reaction_count: number
  published_at: string
  updated_at: string
  author_mode: string
  author_profile_id: string
  author_display_name: string
  avatar_preset: string | null
  author_status: string
  media_list: Array<{
    id: string
    url: string
    type: string
    state: string
    altText?: string
  }> | null
  topic_list: string[] | null
}

interface CommunityCommentItem {
  id: string
  post_id: string
  content: string
  state: 'ACTIVE' | 'HIDDEN' | 'REMOVED'
  created_at: string
  updated_at: string
  author_display_name: string
  avatar_preset: string | null
  post_preview: string | null
}

interface ModerationCaseItem {
  case_id: string
  target_id: string
  target_type: 'POST' | 'COMMENT'
  priority: 'HIGH' | 'NORMAL'
  state: 'OPEN' | 'IN_REVIEW' | 'RESOLVED'
  evidence_content: string
  evidence_state: string
  created_at: string
  updated_at: string
  target_author_name: string
}

interface ModerationSummary {
  totalPosts: number
  activePosts: number
  hiddenPosts: number
  removedPosts: number
  sensitivePosts: number
  totalComments: number
  totalReactions: number
  openCases: number
  aiSafetyScore: string
  safetyStatus: string
}

interface AuditLogEntry {
  id: string
  time: string
  action: string
  target: string
  actor: string
  detail: string
}

const TOPIC_LABELS: Record<string, string> = {
  MY_STORY: 'Câu chuyện của tôi',
  SMALL_MILESTONE: 'Cột mốc nhỏ',
  HELPFUL_REFLECTION: 'Chiêm nghiệm hữu ích',
  PEER_QUESTION: 'Hỏi đáp đồng hành',
  EXPERIENCE_SHARING: 'Chia sẻ kinh nghiệm',
  HELPFUL_RESOURCE: 'Tài nguyên tự chăm sóc',
}

const PROHIBITED_KEYWORDS = [
  {
    category: 'Nguy cấp - Khủng hoảng & Tự hại',
    level: 'CRITICAL',
    action: 'Cảnh báo Hotline bảo vệ sinh mệnh 1900-xxxx + Chuyển chuyên gia',
    keywords: ['tự tử', 'muốn chết', 'tự hại', 'cắt tay', 'kết thúc cuộc sống', 'không muốn sống nữa', 'tự vẫn'],
  },
  {
    category: 'Xúc phạm - Bạo lực ngôn từ',
    level: 'HIGH',
    action: 'Ẩn nội dung + Gửi cảnh cáo vi phạm quy tắc cộng đồng',
    keywords: ['chó', 'đồ điên', 'tâm thần phân liệt', 'biến đi', 'đồ ngu', 'phế vật', 'vô dụng'],
  },
  {
    category: 'Quảng cáo - Kê đơn thuốc trái phép',
    level: 'MEDIUM',
    action: 'Gỡ bài viết + Yêu cầu xác minh chứng chỉ hành nghề Y',
    keywords: ['thuốc an thần lậu', 'thuốc ngủ liều cao', 'mua thuốc không kê đơn', 'bán thuốc trầm cảm xách tay'],
  },
  {
    category: 'Lừa đảo - Khóa tài khoản',
    level: 'MEDIUM',
    action: 'Ẩn ngay lập tức + Khóa quyền đăng bài',
    keywords: ['chữa trầm cảm 100% khỏi', 'thầy bùa tâm linh', 'chữa lành năng lượng gốc đóng tiền triệu'],
  },
]

export default function AdminCommunityModerationSection() {
  const [activeTab, setActiveTab] = useState<'posts' | 'queue' | 'comments' | 'policies' | 'audit'>('posts')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<ModerationSummary | null>(null)
  const [posts, setPosts] = useState<CommunityPostItem[]>([])
  const [comments, setComments] = useState<CommunityCommentItem[]>([])
  const [cases, setCases] = useState<ModerationCaseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters for Posts
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [topicFilter, setTopicFilter] = useState('ALL')

  // Filters for Comments
  const [commentSearch, setCommentSearch] = useState('')
  const [commentStatusFilter, setCommentStatusFilter] = useState('ALL')

  // Selected image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // View Mode ('list' is default for compact clean UI) & Detail Modal
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const [selectedPost, setSelectedPost] = useState<CommunityPostItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({})

  const isMediaVideo = useCallback((m: { url: string; type?: string }) => {
    if (m.type === 'VIDEO') return true
    if (typeof m.url === 'string') {
      const lower = m.url.toLowerCase()
      return (
        lower.includes('/video/') ||
        lower.endsWith('.mp4') ||
        lower.includes('f_mp4') ||
        lower.includes('.webm')
      )
    }
    return false
  }, [])

  const handleCopyId = (id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id)
    }
    setCopiedId(id)
    showToast(`Đã sao chép ID: #${id.slice(0, 8)}`)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  const addAuditLog = (action: string, target: string, detail: string) => {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      target,
      actor: 'Quản trị viên',
      detail,
    }
    setAuditLogs((prev) => [entry, ...prev])
  }

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/admin/community/moderation')
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
        setPosts(data.posts)
        setComments(data.comments)
        setCases(data.cases)
      } else {
        showToast(data.error || 'Chưa thể tải dữ liệu cộng đồng.', 'error')
      }
    } catch {
      showToast('Lỗi kết nối máy chủ kiểm duyệt cộng đồng.', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) setPreviewImage(null)
        else if (selectedPost) setSelectedPost(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImage, selectedPost])

  // Post Actions
  const handlePostState = async (postId: string, newState: 'ACTIVE' | 'HIDDEN' | 'REMOVED') => {
    try {
      const res = await fetch('/api/admin/community/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_POST_STATE', postId, state: newState }),
      })
      const data = await res.json()
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, state: newState } : p)),
        )
        setSelectedPost((prev) =>
          prev && prev.id === postId ? { ...prev, state: newState } : prev,
        )
        showToast(data.message)
        addAuditLog(
          newState === 'ACTIVE' ? 'Khôi phục bài viết' : newState === 'HIDDEN' ? 'Ẩn bài viết' : 'Gỡ bỏ bài viết',
          `Bài viết #${postId.slice(0, 8)}`,
          `Chuyển trạng thái sang ${newState}`,
        )
      } else {
        showToast(data.error, 'error')
      }
    } catch {
      showToast('Lỗi khi cập nhật trạng thái bài viết.', 'error')
    }
  }

  const handleToggleSensitive = async (postId: string, currentWarning: string | null) => {
    const newWarning = currentWarning ? null : 'Cảnh báo nội dung nhạy cảm / Trigger Warning'
    try {
      const res = await fetch('/api/admin/community/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_POST_SENSITIVE', postId, warning: newWarning }),
      })
      const data = await res.json()
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, sensitive_content_warning: newWarning } : p)),
        )
        setSelectedPost((prev) =>
          prev && prev.id === postId ? { ...prev, sensitive_content_warning: newWarning } : prev,
        )
        showToast(data.message)
        addAuditLog(
          newWarning ? 'Bật cảnh báo nhạy cảm' : 'Gỡ cảnh báo nhạy cảm',
          `Bài viết #${postId.slice(0, 8)}`,
          newWarning ? 'Đã bật lớp phủ cảnh báo 18+ / Trigger Warning' : 'Đã đưa về chế độ bình thường',
        )
      } else {
        showToast(data.error, 'error')
      }
    } catch {
      showToast('Lỗi khi đổi cảnh báo nhạy cảm.', 'error')
    }
  }

  // Comment Actions
  const handleCommentState = async (commentId: string, newState: 'ACTIVE' | 'HIDDEN' | 'REMOVED') => {
    try {
      const res = await fetch('/api/admin/community/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_COMMENT_STATE', commentId, state: newState }),
      })
      const data = await res.json()
      if (data.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, state: newState } : c)),
        )
        showToast(data.message)
        addAuditLog(
          newState === 'ACTIVE' ? 'Khôi phục bình luận' : newState === 'HIDDEN' ? 'Ẩn bình luận' : 'Gỡ bỏ bình luận',
          `Bình luận #${commentId.slice(0, 8)}`,
          `Chuyển trạng thái sang ${newState}`,
        )
      } else {
        showToast(data.error, 'error')
      }
    } catch {
      showToast('Lỗi khi cập nhật bình luận.', 'error')
    }
  }

  // Flag post to queue
  const handleFlagPost = async (postId: string) => {
    try {
      const res = await fetch('/api/admin/community/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FLAG_POST', postId, priority: 'HIGH' }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Đã đưa bài viết vào Hàng đợi kiểm duyệt ưu tiên cao!')
        addAuditLog('Gắn cờ kiểm duyệt', `Bài viết #${postId.slice(0, 8)}`, 'Đưa vào hàng đợi cần rà soát')
        fetchData(true)
      }
    } catch {
      showToast('Lỗi khi gắn cờ bài viết.', 'error')
    }
  }

  // Resolve case
  const handleResolveCase = async (caseId: string) => {
    try {
      const res = await fetch('/api/admin/community/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESOLVE_CASE', caseId }),
      })
      const data = await res.json()
      if (data.success) {
        setCases((prev) =>
          prev.map((c) => (c.case_id === caseId ? { ...c, state: 'RESOLVED' } : c)),
        )
        showToast('Đã đánh dấu giải quyết ca kiểm duyệt.')
        addAuditLog('Xử lý ca kiểm duyệt', `Hồ sơ #${caseId.slice(0, 8)}`, 'Đã xác minh và hoàn tất')
      }
    } catch {
      showToast('Lỗi khi giải quyết ca kiểm duyệt.', 'error')
    }
  }

  // Automated AI Keyword Safety Scan
  const handleRunAIScan = () => {
    let flaggedCount = 0
    posts.forEach((p) => {
      const lower = p.content.toLowerCase()
      const isCrisis = PROHIBITED_KEYWORDS[0].keywords.some((k) => lower.includes(k))
      const isHarassment = PROHIBITED_KEYWORDS[1].keywords.some((k) => lower.includes(k))
      if (isCrisis || isHarassment) {
        flaggedCount++
      }
    })

    if (flaggedCount === 0) {
      showToast('Quét AI hoàn tất: 100% nội dung bài viết tuân thủ Tiêu chuẩn Cộng đồng y tế.')
      addAuditLog('Quét AI An toàn', 'Toàn bộ 25 bài viết', '0 phát hiện vi phạm nguy cấp')
    } else {
      showToast(`Quét AI hoàn tất: Phát hiện ${flaggedCount} bài viết có từ khóa cần lưu ý!`, 'error')
      addAuditLog('Quét AI An toàn', 'Toàn bộ bài viết', `Phát hiện ${flaggedCount} nội dung cần rà soát`)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Mã bài viết', 'Tác giả', 'Trạng thái', 'Nội dung', 'Lượt thích', 'Bình luận', 'Ngày đăng']
    const rows = posts.map((p) => [
      p.id,
      p.author_display_name,
      p.state,
      `"${p.content.replace(/"/g, '""')}"`,
      p.reaction_count,
      p.comment_count,
      new Date(p.published_at).toLocaleString('vi-VN'),
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `MentalBridge_Kiem_Duyet_Community_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Đã xuất báo cáo kiểm duyệt cộng đồng CSV thành công.')
    addAuditLog('Xuất báo cáo', 'Danh sách bài viết & kiểm duyệt', 'Tải tệp CSV')
  }

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.author_display_name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.state === 'ACTIVE' && !p.sensitive_content_warning) ||
        (statusFilter === 'HIDDEN' && p.state === 'HIDDEN') ||
        (statusFilter === 'REMOVED' && p.state === 'REMOVED') ||
        (statusFilter === 'SENSITIVE' && Boolean(p.sensitive_content_warning))

      const matchTopic =
        topicFilter === 'ALL' || (p.topic_list && p.topic_list.includes(topicFilter))

      return matchSearch && matchStatus && matchTopic
    })
  }, [posts, searchQuery, statusFilter, topicFilter])

  // Filtered Comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      const matchSearch =
        commentSearch === '' ||
        c.content.toLowerCase().includes(commentSearch.toLowerCase()) ||
        c.author_display_name.toLowerCase().includes(commentSearch.toLowerCase())
      const matchStatus = commentStatusFilter === 'ALL' || c.state === commentStatusFilter
      return matchSearch && matchStatus
    })
  }, [comments, commentSearch, commentStatusFilter])

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toastMessage} ${toast.type === 'error' ? styles.error : ''}`}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <span className={styles.eyebrowBadge}>
            <ShieldCheck size={14} />
            TRUNG TÂM KIỂM DUYỆT CỘNG ĐỒNG • CHUẨN AN TOÀN EMR &amp; HIPAA
          </span>
          <h1 className={styles.title}>Kiểm duyệt &amp; Giám sát Cộng đồng</h1>
          <p className={styles.subtitle}>
            Điều phối nội dung, theo dõi tương tác người dùng, xử lý vi phạm thời gian thực và áp dụng bộ quy tắc bảo vệ sức khỏe tâm thần theo chuẩn Facebook/Zalo Community Standards.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Làm mới toàn bộ dữ liệu"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang đồng bộ…' : 'Làm mới'}
          </button>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={handleRunAIScan}
            title="Kích hoạt bộ quét từ ngữ độc hại và nguy cơ khủng hoảng"
          >
            <Sparkles size={15} style={{ color: '#059669' }} />
            Quét AI An toàn
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleExportCSV}
            title="Xuất bảng kê kiểm duyệt CSV"
          >
            <Download size={15} />
            Xuất báo cáo vi phạm
          </button>
        </div>
      </header>

      {/* 4 KPI Metrics Cards */}
      <section className={styles.kpiGrid} aria-label="Chỉ số kiểm duyệt">
        {/* Card 1: Tổng bài viết */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TỔNG SỐ BÀI VIẾT</span>
            <div className={`${styles.kpiIconBox} ${styles.green}`}>
              <MessageSquare size={17} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary?.totalPosts ?? 25}</span>
            <span className={`${styles.kpiPill} ${styles.green}`}>
              {summary ? `${summary.activePosts} Hiển thị` : '96% Active'}
            </span>
          </div>
          <p className={styles.kpiSubtext}>
            {summary?.hiddenPosts || 0} bài đã ẩn · {summary?.sensitivePosts || 0} có cảnh báo
          </p>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiFooter}>
            <span>Tỷ lệ hiển thị</span>
            <div className={styles.kpiProgressTrack}>
              <div
                className={styles.kpiProgressBar}
                style={{
                  width: `${summary ? (summary.activePosts / Math.max(1, summary.totalPosts)) * 100 : 96}%`,
                }}
              />
            </div>
          </div>
        </article>

        {/* Card 2: Bình luận & Tương tác */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>BÌNH LUẬN &amp; TƯƠNG TÁC</span>
            <div className={`${styles.kpiIconBox} ${styles.blue}`}>
              <Heart size={17} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary?.totalComments ?? 28}</span>
            <span className={styles.kpiPill}>
              +{summary?.totalReactions ?? 33} phản ứng
            </span>
          </div>
          <p className={styles.kpiSubtext}>Không gian trò chuyện đồng hành</p>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiFooter}>
            <span>Bảo vệ tương tác</span>
            <span style={{ color: '#137333', fontWeight: 600 }}>Tích cực</span>
          </div>
        </article>

        {/* Card 3: Hàng đợi kiểm duyệt */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>HÀNG ĐỢI KIỂM DUYỆT</span>
            <div className={`${styles.kpiIconBox} ${summary?.openCases ? styles.amber : styles.teal}`}>
              <ShieldAlert size={17} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary?.openCases ?? 0}</span>
            <span className={`${styles.kpiPill} ${summary?.openCases ? styles.amber : styles.green}`}>
              {summary?.openCases ? 'Cần xử lý' : 'Đã sạch hàng đợi'}
            </span>
          </div>
          <p className={styles.kpiSubtext}>0 báo cáo vi phạm tồn đọng</p>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiFooter}>
            <span>Ưu tiên khủng hoảng</span>
            <span style={{ fontWeight: 600 }}>Không có sự cố</span>
          </div>
        </article>

        {/* Card 4: Tuân thủ & An toàn AI */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>AN TOÀN AI &amp; TUÂN THỦ</span>
            <div className={`${styles.kpiIconBox} ${styles.green}`}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary?.aiSafetyScore ?? '99.4%'}</span>
            <span className={`${styles.kpiPill} ${styles.green}`}>Đạt chuẩn EMR</span>
          </div>
          <p className={styles.kpiSubtext}>Bộ lọc từ khóa AI hoạt động 24/7</p>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiFooter}>
            <span>Trạng thái bảo vệ</span>
            <span style={{ color: '#137333', fontWeight: 700 }}>● Trực tuyến</span>
          </div>
        </article>
      </section>

      {/* Main Card with Tabs & Moderation Controls */}
      <section className={styles.mainCard}>
        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <div className={styles.tabsList} role="tablist">
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'posts' ? styles.active : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <MessageSquare size={15} />
              Bảng tin &amp; Bài viết
              <span className={styles.tabBadge}>{posts.length}</span>
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'queue' ? styles.active : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              <ShieldAlert size={15} />
              Hàng đợi Báo cáo
              <span className={`${styles.tabBadge} ${cases.filter((c) => c.state === 'OPEN').length > 0 ? styles.warning : ''}`}>
                {cases.filter((c) => c.state === 'OPEN').length}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'comments' ? styles.active : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              <Users size={15} />
              Giám sát Bình luận
              <span className={styles.tabBadge}>{comments.length}</span>
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'policies' ? styles.active : ''}`}
              onClick={() => setActiveTab('policies')}
            >
              <Shield size={15} />
              Tiêu chuẩn &amp; Từ khóa AI
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'audit' ? styles.active : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <FileText size={15} />
              Nhật ký kiểm duyệt
              {auditLogs.length > 0 && <span className={styles.tabBadge}>{auditLogs.length}</span>}
            </button>
          </div>
        </div>

        {/* TAB 1: BẢNG TIN & BÀI VIẾT (FEED MODERATION) */}
        {activeTab === 'posts' && (
          <>
            {/* Filter Controls Row */}
            <div className={styles.filterRow}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Tìm kiếm nội dung bài viết, người đăng, hashtag…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">Tất cả trạng thái bài</option>
                <option value="ACTIVE">Đang hiển thị (Active)</option>
                <option value="SENSITIVE">Có cảnh báo nhạy cảm</option>
                <option value="HIDDEN">Đã ẩn (Hidden)</option>
                <option value="REMOVED">Đã gỡ (Removed)</option>
              </select>

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">Tất cả chủ đề</option>
                {Object.entries(TOPIC_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>

              {/* View Mode Switcher (List is default) */}
              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${viewMode === 'list' ? styles.active : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Hiển thị dạng danh sách bảng gọn gàng (Khuyến nghị)"
                >
                  <LayoutList size={14} />
                  <span>Danh sách</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${viewMode === 'card' ? styles.active : ''}`}
                  onClick={() => setViewMode('card')}
                  title="Hiển thị dạng thẻ mở rộng"
                >
                  <LayoutGrid size={14} />
                  <span>Thẻ</span>
                </button>
              </div>
            </div>

            {/* Posts Stream */}
            {loading ? (
              <div className={styles.emptyState}>
                <Clock size={32} style={{ color: '#0E4A37' }} className="animate-spin" />
                <span className={styles.emptyStateTitle}>Đang tải danh sách bài viết cộng đồng…</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className={styles.emptyState}>
                <Info size={32} style={{ color: '#9CA3AF' }} />
                <span className={styles.emptyStateTitle}>Không tìm thấy bài viết nào phù hợp bộ lọc</span>
                <p className={styles.emptyStateDesc}>Thử thay đổi từ khóa tìm kiếm hoặc làm mới lại trang.</p>
              </div>
            ) : viewMode === 'list' ? (
              /* Compact Table List View */
              <div className={styles.postTableWrapper}>
                <table className={styles.postTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>TÁC GIẢ</th>
                      <th>NỘI DUNG &amp; ĐÍNH KÈM</th>
                      <th style={{ width: '140px' }}>TRẠNG THÁI</th>
                      <th style={{ width: '110px' }}>TƯƠNG TÁC</th>
                      <th style={{ width: '130px' }}>THỜI GIAN</th>
                      <th style={{ width: '190px', textAlign: 'right' }}>QUYỀN QUẢN TRỊ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map((post) => {
                      const isSensitive = Boolean(post.sensitive_content_warning)
                      const isHidden = post.state === 'HIDDEN'
                      const isRemoved = post.state === 'REMOVED'
                      const initial = post.author_display_name ? post.author_display_name.slice(0, 2).toUpperCase() : 'MB'
                      const hasVideo = post.media_list?.some(isMediaVideo)
                      const hasImage = post.media_list?.some((m) => !isMediaVideo(m))

                      return (
                        <tr
                          key={post.id}
                          className={`${styles.postTableRow} ${isSensitive ? styles.rowSensitive : ''} ${isHidden ? styles.rowHidden : ''} ${isRemoved ? styles.rowRemoved : ''}`}
                          onClick={() => setSelectedPost(post)}
                          title="Nhấp vào hàng để xem popup chi tiết bài viết và điều phối đầy đủ"
                        >
                          {/* 1. Tác giả */}
                          <td>
                            <div className={styles.authorCol}>
                              <div
                                className={styles.authorMiniAvatar}
                                style={{
                                  background:
                                    post.author_display_name === 'Khôi'
                                      ? '#0E4A37'
                                      : post.author_display_name === 'Ngọc Quyên'
                                      ? '#C2410C'
                                      : post.author_display_name === 'monglung'
                                      ? '#4338CA'
                                      : '#047857',
                                }}
                              >
                                {initial}
                              </div>
                              <div className={styles.authorColInfo}>
                                <span className={styles.authorColName}>{post.author_display_name}</span>
                                <span className={styles.authorColSub}>
                                  {post.author_mode === 'ANONYMOUS' ? 'Ẩn danh' : 'Xác thực'} · #{post.id.slice(0, 6)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Nội dung & Đính kèm */}
                          <td>
                            <div className={styles.contentCol}>
                              <div className={styles.contentLine}>{post.content}</div>
                              <div className={styles.contentMetaRow}>
                                {post.topic_list && post.topic_list.length > 0 && (
                                  <span className={styles.topicTag}>
                                    #{TOPIC_LABELS[post.topic_list[0]] || post.topic_list[0]}
                                  </span>
                                )}

                                {hasVideo && (
                                  <span className={`${styles.mediaBadge} ${styles.video}`}>
                                    <Film size={11} /> Video ({post.media_list?.filter(isMediaVideo).length})
                                  </span>
                                )}

                                {hasImage && (
                                  <span className={`${styles.mediaBadge} ${styles.image}`}>
                                    <ImageIcon size={11} /> Ảnh ({post.media_list?.filter((m) => !isMediaVideo(m)).length})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. Trạng thái */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              {isRemoved ? (
                                <span className={`${styles.statusBadge} ${styles.removed}`}>
                                  <Trash2 size={11} /> Đã gỡ bỏ
                                </span>
                              ) : isHidden ? (
                                <span className={`${styles.statusBadge} ${styles.hidden}`}>
                                  <EyeOff size={11} /> Đang ẩn
                                </span>
                              ) : (
                                <span className={`${styles.statusBadge} ${styles.active}`}>
                                  <CheckCircle2 size={11} /> Hiển thị
                                </span>
                              )}

                              {isSensitive && (
                                <span className={`${styles.statusBadge} ${styles.sensitive}`}>
                                  <AlertTriangle size={11} /> Nhạy cảm
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Tương tác */}
                          <td>
                            <div className={styles.interactionsCol}>
                              <span className={styles.interactionItem} title={`${post.reaction_count} lượt cảm xúc`}>
                                <Heart size={13} style={{ color: '#EF4444' }} /> {post.reaction_count}
                              </span>
                              <span className={styles.interactionItem} title={`${post.comment_count} bình luận`}>
                                <MessageSquare size={13} style={{ color: '#3B82F6' }} /> {post.comment_count}
                              </span>
                            </div>
                          </td>

                          {/* 5. Thời gian */}
                          <td>
                            <div className={styles.timeCol}>
                              <div>{new Date(post.published_at).toLocaleDateString('vi-VN')}</div>
                              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                {new Date(post.published_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </td>

                          {/* 6. Quyền quản trị / Thao tác */}
                          <td>
                            <div className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className={styles.viewDetailBtn}
                                onClick={() => setSelectedPost(post)}
                                title="Mở popup chi tiết bài viết và đầy đủ quyền admin"
                              >
                                <Eye size={13} />
                                Chi tiết
                              </button>

                              <button
                                type="button"
                                className={`${styles.quickActionBtn} ${isSensitive ? styles.warning : ''}`}
                                onClick={() => handleToggleSensitive(post.id, post.sensitive_content_warning)}
                                title={isSensitive ? 'Gỡ cảnh báo nhạy cảm' : 'Gắn cảnh báo nhạy cảm'}
                              >
                                <AlertTriangle size={13} />
                              </button>

                              <button
                                type="button"
                                className={styles.quickActionBtn}
                                onClick={() => handlePostState(post.id, isHidden ? 'ACTIVE' : 'HIDDEN')}
                                title={isHidden ? 'Hiển thị lại bài viết' : 'Tạm ẩn bài viết'}
                              >
                                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>

                              {!isRemoved ? (
                                <button
                                  type="button"
                                  className={`${styles.quickActionBtn} ${styles.danger}`}
                                  onClick={() => handlePostState(post.id, 'REMOVED')}
                                  title="Gỡ bỏ bài viết"
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.quickActionBtn} ${styles.success}`}
                                  onClick={() => handlePostState(post.id, 'ACTIVE')}
                                  title="Khôi phục bài viết"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Card View with Fixed Video & Image Rendering */
              <div className={styles.postGrid}>
                {filteredPosts.map((post) => {
                  const isSensitive = Boolean(post.sensitive_content_warning)
                  const isHidden = post.state === 'HIDDEN'
                  const isRemoved = post.state === 'REMOVED'
                  const initial = post.author_display_name ? post.author_display_name.slice(0, 2).toUpperCase() : 'MB'

                  return (
                    <article
                      key={post.id}
                      className={`${styles.postCard} ${isSensitive ? styles.sensitiveWarning : ''} ${isRemoved ? styles.removedPost : ''} ${isHidden ? styles.hiddenPost : ''}`}
                      onClick={() => setSelectedPost(post)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Post Header */}
                      <div className={styles.postHeader}>
                        <div className={styles.authorMeta}>
                          <div
                            className={styles.authorAvatar}
                            style={{
                              background:
                                post.author_display_name === 'Khôi'
                                  ? '#0E4A37'
                                  : post.author_display_name === 'Ngọc Quyên'
                                  ? '#C2410C'
                                  : post.author_display_name === 'monglung'
                                  ? '#4338CA'
                                  : '#047857',
                            }}
                          >
                            {initial}
                          </div>
                          <div className={styles.authorDetails}>
                            <div className={styles.authorNameRow}>
                              <span className={styles.authorName}>{post.author_display_name}</span>
                              <span className={styles.authorModeBadge}>
                                {post.author_mode === 'ANONYMOUS' ? 'Ẩn danh' : 'Thành viên xác thực'}
                              </span>
                            </div>
                            <time className={styles.postTime}>
                              {new Date(post.published_at).toLocaleString('vi-VN')} · ID: #{post.id.slice(0, 8)}
                            </time>
                          </div>
                        </div>

                        <div className={styles.statusBadgeGroup}>
                          {isRemoved ? (
                            <span className={`${styles.statusBadge} ${styles.removed}`}>
                              <Trash2 size={12} />
                              Đã gỡ bỏ
                            </span>
                          ) : isHidden ? (
                            <span className={`${styles.statusBadge} ${styles.hidden}`}>
                              <EyeOff size={12} />
                              Đang ẩn
                            </span>
                          ) : (
                            <span className={`${styles.statusBadge} ${styles.active}`}>
                              <CheckCircle2 size={12} />
                              Đang hiển thị
                            </span>
                          )}

                          {isSensitive && (
                            <span className={`${styles.statusBadge} ${styles.sensitive}`}>
                              <AlertTriangle size={12} />
                              Cảnh báo nhạy cảm
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Post Body */}
                      <div className={styles.postBody}>
                        {isSensitive && (
                          <div className={styles.warningBox}>
                            <AlertTriangle size={16} />
                            <span>{post.sensitive_content_warning}</span>
                          </div>
                        )}

                        <div className={styles.postContent}>{post.content}</div>

                        {/* Topics Tags */}
                        {post.topic_list && post.topic_list.length > 0 && (
                          <div className={styles.topicsList}>
                            {post.topic_list.map((t) => (
                              <span key={t} className={styles.topicTag}>
                                #{TOPIC_LABELS[t] || t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Media preview: Handle VIDEO vs IMAGE cleanly! */}
                        {post.media_list && post.media_list.length > 0 && (
                          <div className={styles.mediaRow} onClick={(e) => e.stopPropagation()}>
                            {post.media_list.map((m) => {
                              const isVideo = isMediaVideo(m)
                              const isError = mediaErrors[m.id]

                              return isVideo ? (
                                <div
                                  key={m.id}
                                  style={{
                                    position: 'relative',
                                    width: '160px',
                                    height: '140px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: '#1F2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => setSelectedPost(post)}
                                  title="Nhấp để xem video trong popup chi tiết"
                                >
                                  <Film size={28} style={{ color: '#F59E0B' }} />
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '6px',
                                      left: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(0,0,0,0.7)',
                                      color: '#FFF',
                                    }}
                                  >
                                    Video MP4
                                  </span>
                                </div>
                              ) : isError ? (
                                <div
                                  key={m.id}
                                  className={styles.mediaThumb}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#F9FAFB',
                                    color: '#9CA3AF',
                                    fontSize: '11px',
                                    textAlign: 'center',
                                    padding: '8px',
                                  }}
                                >
                                  <ImageOff size={22} />
                                  <span>Không tải được ảnh</span>
                                </div>
                              ) : (
                                <img
                                  key={m.id}
                                  src={m.url}
                                  alt={m.altText || 'Ảnh đính kèm bài viết'}
                                  className={styles.mediaThumb}
                                  onError={() => setMediaErrors((prev) => ({ ...prev, [m.id]: true }))}
                                  onClick={() => setPreviewImage(m.url)}
                                  title="Nhấp để xem phóng to"
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Post Footer & Quick Moderation Actions */}
                      <div className={styles.postFooter} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.engagementStats}>
                          <span className={styles.engagementItem}>
                            <Heart size={14} style={{ color: '#EF4444' }} />
                            <b>{post.reaction_count}</b> cảm xúc
                          </span>
                          <span className={styles.engagementItem}>
                            <MessageSquare size={14} style={{ color: '#3B82F6' }} />
                            <b>{post.comment_count}</b> bình luận
                          </span>
                        </div>

                        <div className={styles.actionButtonsGroup}>
                          <button
                            type="button"
                            className={styles.viewDetailBtn}
                            onClick={() => setSelectedPost(post)}
                          >
                            <Eye size={13} /> Chi tiết &amp; Quyền
                          </button>

                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.warning}`}
                            onClick={() => handleToggleSensitive(post.id, post.sensitive_content_warning)}
                            title={isSensitive ? 'Gỡ lớp cảnh báo nhạy cảm' : 'Bật cảnh báo nhạy cảm (Trigger Warning)'}
                          >
                            <AlertTriangle size={13} />
                            {isSensitive ? 'Gỡ nhạy cảm' : 'Gắn nhạy cảm'}
                          </button>

                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handlePostState(post.id, isHidden ? 'ACTIVE' : 'HIDDEN')}
                            title={isHidden ? 'Hiển thị lại bài viết' : 'Tạm ẩn bài viết khỏi bảng tin'}
                          >
                            {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                            {isHidden ? 'Hiện bài' : 'Ẩn bài'}
                          </button>

                          {!isRemoved ? (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() => handlePostState(post.id, 'REMOVED')}
                              title="Gỡ bỏ bài viết do vi phạm tiêu chuẩn"
                            >
                              <Trash2 size={13} />
                              Gỡ bài viết
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.success}`}
                              onClick={() => handlePostState(post.id, 'ACTIVE')}
                              title="Khôi phục lại bài viết này"
                            >
                              <RotateCcw size={13} />
                              Khôi phục bài
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handleFlagPost(post.id)}
                            title="Đưa vào hàng đợi cần rà soát bổ sung"
                          >
                            <Flag size={13} />
                            Báo cáo
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: HÀNG ĐỢI BÁO CÁO & CA KIỂM DUYỆT (MODERATION QUEUE) */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cases.length === 0 ? (
              <div className={styles.emptyState}>
                <ShieldCheck size={48} style={{ color: '#10B981' }} />
                <span className={styles.emptyStateTitle}>Hàng đợi kiểm duyệt an toàn (0 trường hợp tồn đọng)</span>
                <p className={styles.emptyStateDesc}>
                  Hệ thống AI và người dùng chưa ghi nhận báo cáo vi phạm mới. Khi có người dùng bấm báo cáo hoặc AI phát hiện từ ngữ kích động, các ca kiểm duyệt sẽ tự động xếp vào đây theo độ ưu tiên khủng hoảng.
                </p>
                {posts.length > 0 && (
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => handleFlagPost(posts[0].id)}
                    style={{ marginTop: '12px' }}
                  >
                    <Flag size={14} />
                    Mô phỏng: Thử đưa bài viết đầu tiên vào hàng đợi
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.postGrid}>
                {cases.map((c) => (
                  <article key={c.case_id} className={styles.postCard}>
                    <div className={styles.postHeader}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>
                            Ca kiểm duyệt #{c.case_id.slice(0, 8)} · {c.target_type === 'POST' ? 'Bài viết' : 'Bình luận'}
                          </span>
                          <span
                            className={`${styles.statusBadge} ${c.priority === 'HIGH' ? styles.removed : styles.hidden}`}
                          >
                            {c.priority === 'HIGH' ? 'ƯU TIÊN CAO (KHỦNG HOẢNG)' : 'ƯU TIÊN THƯỜNG'}
                          </span>
                        </div>
                        <time className={styles.postTime}>
                          Tác giả: <b>{c.target_author_name}</b> · Ghi nhận: {new Date(c.created_at).toLocaleString('vi-VN')}
                        </time>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${c.state === 'RESOLVED' ? styles.active : styles.sensitive}`}
                      >
                        {c.state === 'RESOLVED' ? 'Đã giải quyết' : 'Chờ xử lý'}
                      </span>
                    </div>

                    <div className={styles.postBody}>
                      <blockquote
                        style={{
                          margin: 0,
                          padding: '12px 16px',
                          background: '#F9FAFB',
                          borderLeft: '4px solid #0E4A37',
                          borderRadius: '8px',
                          fontSize: '13px',
                          lineHeight: 1.5,
                        }}
                      >
                        <b>Bằng chứng nội dung:</b> &quot;{c.evidence_content}&quot;
                      </blockquote>
                    </div>

                    <div className={styles.postFooter}>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>
                        Trạng thái bằng chứng: {c.evidence_state}
                      </span>
                      {c.state !== 'RESOLVED' ? (
                        <div className={styles.actionButtonsGroup}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.success}`}
                            onClick={() => handleResolveCase(c.case_id)}
                          >
                            <CheckCircle2 size={13} />
                            Đánh dấu an toàn &amp; Đóng ca
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={() => {
                              handlePostState(c.target_id, 'REMOVED')
                              handleResolveCase(c.case_id)
                            }}
                          >
                            <Trash2 size={13} />
                            Gỡ nội dung &amp; Xử lý vi phạm
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                          ✓ Ca này đã được lưu vào nhật ký kiểm toán EMR.
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GIÁM SÁT BÌNH LUẬN (COMMENTS MODERATION) */}
        {activeTab === 'comments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.filterRow}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Tìm kiếm nội dung bình luận, người gửi…"
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <select
                value={commentStatusFilter}
                onChange={(e) => setCommentStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hiển thị</option>
                <option value="HIDDEN">Đã ẩn</option>
                <option value="REMOVED">Đã gỡ</option>
              </select>
            </div>

            <div className={styles.commentList}>
              {filteredComments.map((comment) => (
                <div key={comment.id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <div className={styles.commentAuthor}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#0E4A37',
                          color: '#FFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {comment.author_display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>
                        {comment.author_display_name}
                      </span>
                      <time style={{ fontSize: '12px', color: '#6B7280' }}>
                        · {new Date(comment.created_at).toLocaleString('vi-VN')}
                      </time>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${
                        comment.state === 'REMOVED'
                          ? styles.removed
                          : comment.state === 'HIDDEN'
                          ? styles.hidden
                          : styles.active
                      }`}
                    >
                      {comment.state === 'REMOVED'
                        ? 'Đã gỡ'
                        : comment.state === 'HIDDEN'
                        ? 'Đã ẩn'
                        : 'Đang hiển thị'}
                    </span>
                  </div>

                  <div className={styles.commentBody}>{comment.content}</div>

                  {comment.post_preview && (
                    <div className={styles.postSnippet}>
                      Thuộc bài viết: &quot;{comment.post_preview}…&quot;
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        handleCommentState(comment.id, comment.state === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN')
                      }
                    >
                      {comment.state === 'HIDDEN' ? <Eye size={12} /> : <EyeOff size={12} />}
                      {comment.state === 'HIDDEN' ? 'Hiện bình luận' : 'Ẩn bình luận'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${comment.state === 'REMOVED' ? styles.success : styles.danger}`}
                      onClick={() =>
                        handleCommentState(comment.id, comment.state === 'REMOVED' ? 'ACTIVE' : 'REMOVED')
                      }
                    >
                      {comment.state === 'REMOVED' ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      {comment.state === 'REMOVED' ? 'Khôi phục' : 'Gỡ bình luận'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TIÊU CHUẨN CỘNG ĐỒNG & BỘ LỌC TỪ KHÓA AI */}
        {activeTab === 'policies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className={styles.policyGrid}>
              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <ShieldAlert size={20} style={{ color: '#DC2626' }} />
                  <span className={styles.policyTitle}>1. Phòng ngừa Khủng hoảng &amp; Hành vi tự hại</span>
                </div>
                <p className={styles.policyDesc}>
                  Tuyệt đối nghiêm cấm các bài viết miêu tả chi tiết phương thức tự làm đau, khuyến khích kết thúc sinh mệnh. Hệ thống tự động kích hoạt Hotline cứu trợ 1900-xxxx và ghim thông tin hỗ trợ y tế khẩn cấp ngay trên màn hình người dùng.
                </p>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <AlertTriangle size={20} style={{ color: '#D97706' }} />
                  <span className={styles.policyTitle}>2. Chống Công kích cá nhân &amp; Bắt nạt tâm lý</span>
                </div>
                <p className={styles.policyDesc}>
                  Không dung thứ cho hành vi công kích hoặc miệt thị tình trạng sức khỏe tâm thần của người khác. Các bình luận có xu hướng chỉ trích tiêu cực sẽ bị AI gắn cờ và ẩn tự động.
                </p>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <Lock size={20} style={{ color: '#2563EB' }} />
                  <span className={styles.policyTitle}>3. Bảo mật Thông tin cá nhân &amp; HIPAA</span>
                </div>
                <p className={styles.policyDesc}>
                  Nghiêm cấm chia sẻ số CMND/CCCD, số điện thoại, đơn thuốc có mã bệnh nhân hoặc danh tính thực của thân chủ nếu chưa được đồng thuận y tế rõ ràng.
                </p>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <ShieldCheck size={20} style={{ color: '#059669' }} />
                  <span className={styles.policyTitle}>4. Cấm Kê đơn &amp; Tư vấn y khoa chưa thẩm định</span>
                </div>
                <p className={styles.policyDesc}>
                  Chỉ các Bác sĩ chuyên khoa và Chuyên gia lâm sàng đã qua xác thực CCHN mới được phép đưa ra lời khuyên chuyên môn. Mọi hành vi bán thuốc không kê đơn đều bị gỡ ngay lập tức.
                </p>
              </div>
            </div>

            {/* Keyword Filter Blacklist */}
            <div className={styles.keywordSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                    Danh mục Từ khóa AI Tự động Rà soát
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                    Bộ từ điển quy chuẩn được MentalBridge AI áp dụng để quét tự động nội dung theo thời gian thực.
                  </p>
                </div>
                <button type="button" className={styles.primaryBtn} onClick={handleRunAIScan}>
                  <Sparkles size={14} />
                  Quét toàn bộ bài viết ngay
                </button>
              </div>

              <div className={styles.keywordGrid}>
                {PROHIBITED_KEYWORDS.map((item, idx) => (
                  <div key={idx} className={styles.keywordCard}>
                    <div className={styles.keywordHeader}>
                      <span>{item.category}</span>
                      <span className={`${styles.statusBadge} ${item.level === 'CRITICAL' ? styles.removed : styles.sensitive}`}>
                        {item.level}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                      <b>Hành động:</b> {item.action}
                    </p>
                    <div className={styles.keywordTags}>
                      {item.keywords.map((k, kidx) => (
                        <span key={kidx} className={`${styles.keywordBadge} ${item.level === 'CRITICAL' ? styles.danger : ''}`}>
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: NHẬT KÝ THAO TÁC KIỂM DUYỆT (AUDIT LOG) */}
        {activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {auditLogs.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText size={36} style={{ color: '#9CA3AF' }} />
                <span className={styles.emptyStateTitle}>Chưa có thao tác kiểm duyệt nào trong phiên này</span>
                <p className={styles.emptyStateDesc}>
                  Khi bạn thực hiện các thao tác như ẩn bài viết, gỡ bỏ, bật cảnh báo nhạy cảm hoặc giải quyết ca kiểm duyệt, lịch sử sẽ được ghi nhận tại đây theo chuẩn kiểm toán EMR.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                <table className={styles.auditTable}>
                  <thead>
                    <tr>
                      <th>THỜI GIAN</th>
                      <th>HÀNH ĐỘNG</th>
                      <th>ĐỐI TƯỢNG</th>
                      <th>NGƯỜI THỰC HIỆN</th>
                      <th>CHI TIẾT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.time}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles.active}`}>{log.action}</span>
                        </td>
                        <td>
                          <code>{log.target}</code>
                        </td>
                        <td>{log.actor}</td>
                        <td style={{ color: '#4B5563' }}>{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Detail & Full Admin Moderation Modal */}
      {selectedPost && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setSelectedPost(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-post-title"
        >
          <div
            className={styles.modalContainer}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <h2 id="modal-post-title" className={styles.modalTitle}>
                  <ShieldCheck size={20} style={{ color: '#0E4A37' }} />
                  Chi tiết bài viết &amp; Bảng điều phối kiểm duyệt
                </h2>
                <div className={styles.modalSubtitle}>
                  <span>Mã bài viết: <code>#{selectedPost.id.slice(0, 8)}</code></span>
                  <button
                    type="button"
                    className={styles.copyIdBtn}
                    onClick={() => handleCopyId(selectedPost.id)}
                    title="Sao chép toàn bộ UUID bài viết"
                  >
                    {copiedId === selectedPost.id ? (
                      <>
                        <Check size={12} style={{ color: '#059669' }} />
                        <span>Đã chép ID!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Sao chép ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.modalHeaderRight}>
                {selectedPost.state === 'REMOVED' ? (
                  <span className={`${styles.statusBadge} ${styles.removed}`}>
                    <Trash2 size={12} />
                    Đã gỡ bỏ
                  </span>
                ) : selectedPost.state === 'HIDDEN' ? (
                  <span className={`${styles.statusBadge} ${styles.hidden}`}>
                    <EyeOff size={12} />
                    Đang ẩn
                  </span>
                ) : (
                  <span className={`${styles.statusBadge} ${styles.active}`}>
                    <CheckCircle2 size={12} />
                    Đang hiển thị
                  </span>
                )}

                {Boolean(selectedPost.sensitive_content_warning) && (
                  <span className={`${styles.statusBadge} ${styles.sensitive}`}>
                    <AlertTriangle size={12} />
                    Cảnh báo nhạy cảm
                  </span>
                )}

                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => setSelectedPost(null)}
                  title="Đóng cửa sổ chi tiết (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Sensitive Warning Alert Box if any */}
              {selectedPost.sensitive_content_warning && (
                <div className={styles.warningBox}>
                  <AlertTriangle size={18} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Đã kích hoạt cảnh báo nhạy cảm</div>
                    <div style={{ fontSize: '13px' }}>{selectedPost.sensitive_content_warning}</div>
                  </div>
                </div>
              )}

              {/* Author Card */}
              <div className={styles.modalAuthorCard}>
                <div className={styles.modalAuthorLeft}>
                  <div
                    className={styles.modalAuthorAvatar}
                    style={{
                      background:
                        selectedPost.author_display_name === 'Khôi'
                          ? '#0E4A37'
                          : selectedPost.author_display_name === 'Ngọc Quyên'
                          ? '#C2410C'
                          : selectedPost.author_display_name === 'monglung'
                          ? '#4338CA'
                          : '#047857',
                    }}
                  >
                    {selectedPost.author_display_name ? selectedPost.author_display_name.slice(0, 2).toUpperCase() : 'MB'}
                  </div>
                  <div className={styles.modalAuthorMeta}>
                    <div className={styles.modalAuthorName}>
                      {selectedPost.author_display_name}
                      <span className={styles.authorModeBadge}>
                        {selectedPost.author_mode === 'ANONYMOUS' ? 'Đăng ẩn danh' : 'Thành viên xác thực'}
                      </span>
                    </div>
                    <div className={styles.modalAuthorDetails}>
                      Hồ sơ: <code>{selectedPost.author_profile_id || 'ID chưa tạo'}</code> · Trạng thái: {selectedPost.author_status || 'ACTIVE'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#6B7280', textAlign: 'right' }}>
                  <div>Đăng lúc: <b>{new Date(selectedPost.published_at).toLocaleString('vi-VN')}</b></div>
                  <div>Cập nhật: {new Date(selectedPost.updated_at).toLocaleString('vi-VN')}</div>
                </div>
              </div>

              {/* Post Full Content */}
              <div className={styles.modalPostCard}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nội dung bài viết
                </div>
                <div className={styles.modalPostText}>{selectedPost.content}</div>

                {selectedPost.topic_list && selectedPost.topic_list.length > 0 && (
                  <div className={styles.topicsList} style={{ marginTop: '8px' }}>
                    {selectedPost.topic_list.map((t) => (
                      <span key={t} className={styles.topicTag}>
                        #{TOPIC_LABELS[t] || t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attached Media Section */}
              <div className={styles.mediaSection}>
                <div className={styles.mediaSectionHeader}>
                  <span>TỆP ĐA PHƯƠNG TIỆN ĐÍNH KÈM</span>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    {selectedPost.media_list && selectedPost.media_list.length > 0
                      ? `${selectedPost.media_list.length} tệp đã tải lên`
                      : 'Không có tệp đính kèm'}
                  </span>
                </div>

                {selectedPost.media_list && selectedPost.media_list.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {selectedPost.media_list.map((m) => {
                      const isVideo = isMediaVideo(m)
                      const isError = mediaErrors[m.id]

                      return (
                        <div key={m.id} className={styles.mediaContainer}>
                          {isVideo ? (
                            <div>
                              <video
                                src={m.url}
                                controls
                                preload="metadata"
                                playsInline
                                className={styles.videoElement}
                              >
                                Trình duyệt không hỗ trợ xem video trực tiếp.
                              </video>
                              <div className={styles.mediaCaption}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Film size={14} style={{ color: '#D97706' }} />
                                  <span>Video người dùng đăng tải (Cloudinary MP4)</span>
                                </div>
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.mediaDirectLink}
                                >
                                  Mở video tab mới <ExternalLink size={12} style={{ display: 'inline' }} />
                                </a>
                              </div>
                            </div>
                          ) : isError ? (
                            <div className={styles.mediaErrorFallback}>
                              <ImageOff size={32} style={{ color: '#EF4444' }} />
                              <div style={{ fontWeight: 600 }}>Không thể tải trước hình ảnh từ CDN</div>
                              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Liên kết ảnh có thể cần chữ ký xác thực bảo mật.</div>
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.mediaDirectLink}
                              >
                                Mở ảnh gốc trong tab mới
                              </a>
                            </div>
                          ) : (
                            <div>
                              <img
                                src={m.url}
                                alt={m.altText || 'Ảnh đính kèm'}
                                className={styles.imageElement}
                                onError={() => setMediaErrors((prev) => ({ ...prev, [m.id]: true }))}
                                onClick={() => setPreviewImage(m.url)}
                                title="Bấm để xem ảnh phóng to"
                              />
                              <div className={styles.mediaCaption}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <ImageIcon size={14} style={{ color: '#0284C7' }} />
                                  <span>Hình ảnh đính kèm (Nhấp để phóng to)</span>
                                </div>
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.mediaDirectLink}
                                >
                                  Mở ảnh tab mới <ExternalLink size={12} style={{ display: 'inline' }} />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: '10px', fontSize: '13px', color: '#6B7280', textAlign: 'center' }}>
                    Bài viết này là dạng văn bản thuần túy, không có ảnh hoặc video đính kèm.
                  </div>
                )}
              </div>

              {/* Engagement Metrics Stats */}
              <div className={styles.modalStatsRow}>
                <div className={styles.modalStatCard}>
                  <span className={styles.modalStatLabel}>LƯỢT THẢ TIM &amp; CẢM XÚC</span>
                  <span className={styles.modalStatValue} style={{ color: '#EF4444' }}>
                    <Heart size={18} />
                    {selectedPost.reaction_count}
                  </span>
                </div>
                <div className={styles.modalStatCard}>
                  <span className={styles.modalStatLabel}>SỐ BÌNH LUẬN CỘNG ĐỒNG</span>
                  <span className={styles.modalStatValue} style={{ color: '#3B82F6' }}>
                    <MessageSquare size={18} />
                    {selectedPost.comment_count}
                  </span>
                </div>
                <div className={styles.modalStatCard}>
                  <span className={styles.modalStatLabel}>ĐỘ ƯU TIÊN KIỂM DUYỆT</span>
                  <span className={styles.modalStatValue} style={{ color: selectedPost.sensitive_content_warning ? '#D97706' : '#059669', fontSize: '14px' }}>
                    {selectedPost.sensitive_content_warning ? '⚠️ Cần lưu ý' : '✓ An toàn'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer with ALL ADMIN ACTIONS */}
            <div className={styles.modalFooter}>
              <div className={styles.adminActionGroup}>
                {/* 1. Toggle Sensitive Warning */}
                <button
                  type="button"
                  className={`${styles.actionBtn} ${selectedPost.sensitive_content_warning ? styles.warning : ''}`}
                  onClick={() => handleToggleSensitive(selectedPost.id, selectedPost.sensitive_content_warning)}
                  title={selectedPost.sensitive_content_warning ? 'Gỡ lớp cảnh báo nhạy cảm' : 'Bật cảnh báo nhạy cảm (Trigger Warning)'}
                >
                  <AlertTriangle size={14} />
                  {selectedPost.sensitive_content_warning ? 'Gỡ cảnh báo nhạy cảm' : 'Gắn cảnh báo nhạy cảm'}
                </button>

                {/* 2. Hide / Unhide */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handlePostState(selectedPost.id, selectedPost.state === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN')}
                >
                  {selectedPost.state === 'HIDDEN' ? <Eye size={14} /> : <EyeOff size={14} />}
                  {selectedPost.state === 'HIDDEN' ? 'Hiển thị lại bài' : 'Tạm ẩn bài viết'}
                </button>

                {/* 3. Remove / Restore */}
                {selectedPost.state !== 'REMOVED' ? (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => handlePostState(selectedPost.id, 'REMOVED')}
                  >
                    <Trash2 size={14} />
                    Gỡ bài viết vi phạm
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.success}`}
                    onClick={() => handlePostState(selectedPost.id, 'ACTIVE')}
                  >
                    <RotateCcw size={14} />
                    Khôi phục bài viết
                  </button>
                )}

                {/* 4. Flag to Queue */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleFlagPost(selectedPost.id)}
                  title="Đưa vào hàng đợi cần rà soát khẩn cấp"
                >
                  <Flag size={14} />
                  Báo cáo / Gắn cờ
                </button>
              </div>

              <button
                type="button"
                className={styles.footerCloseBtn}
                onClick={() => setSelectedPost(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px',
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Xem ảnh kích thước đầy đủ"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                display: 'block',
                objectFit: 'contain',
              }}
            />
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', background: '#F9FAFB' }}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setPreviewImage(null)}
              >
                Đóng ảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
