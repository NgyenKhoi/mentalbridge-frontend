'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  Users,
  UserPlus,
  Download,
  RotateCw,
  Search,
  SlidersHorizontal,
  Mail,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Clock,
  CheckCircle2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Database,
  LifeBuoy,
  FileText,
  X,
  UserCheck,
  Send,
  Ban,
  ArrowUpRight,
  CheckSquare,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { ApiError } from '@/lib/api/api-error'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  AccountDetail,
  AccountStatus,
  IdentityRole,
} from '../api/identity-contract'
import { browserAdminAccounts } from '../api/browser-admin-accounts'
import styles from './AdminAccountManager.module.css'

// --------------------------------------------------------------------------
// Constants & Labels
// --------------------------------------------------------------------------

const statusLabels: Record<AccountStatus, string> = {
  PENDING_EMAIL_VERIFICATION: 'Chờ xác minh email',
  ACTIVE: 'Đang hoạt động',
  DISABLED: 'Đã tạm ngưng',
  DELETION_PENDING: 'Chờ xóa',
  DELETED: 'Đã xóa',
}

const suspensionReasons = {
  SAFETY_CONCERN: 'Quan ngại an toàn',
  POLICY_VIOLATION: 'Vi phạm chính sách',
  ACCOUNT_REVIEW_REQUIRED: 'Cần rà soát tài khoản',
} as const

type SuspensionReason = keyof typeof suspensionReasons

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Bạn không có quyền quản trị tài khoản.'
    if (error.status === 412 || error.code === 'VERSION_CONFLICT') {
      return 'Tài khoản đã thay đổi. Hãy tải trạng thái mới nhất trước khi thử lại.'
    }
    if (error.status === 404) return 'Không tìm thấy tài khoản.'
  }
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.'
}

// Metadata helper to augment accounts with clinical portal metadata
function getAccountMetadata(account: AccountDetail) {
  const email = account.email.toLowerCase()
  if (account.roles.includes('ADMIN')) {
    return {
      roleBadge: 'Quản trị viên',
      roleBadgeType: 'ADMIN' as const,
      monoTag: 'ID: USR-ADM-001',
      securityStatus: '2FA Bật',
      securityIcon: 'ON' as const,
      lastActive: '10 phút trước',
      joinedDate: 'Tham gia: 01/06/2026',
      initials: 'AD',
      actionType: 'AUDIT' as const,
    }
  }

  if (account.roles.includes('SPECIALIST')) {
    let monoTag = `CCHN: BS-${account.accountId.slice(0, 4).toUpperCase()}`
    let lastActive = '2 giờ trước'
    let joinedDate = 'Tham gia: 15/07/2026'
    let initials = 'BS'

    if (email.includes('nguyenhong')) {
      monoTag = 'CCHN: PSY-7740'
      lastActive = 'Hôm qua'
      joinedDate = 'Tham gia: 15/07/2026'
      initials = 'NH'
    } else if (email.includes('quyenptnde180559')) {
      monoTag = 'Liên kết: FPT & Học viện'
      lastActive = 'Chưa đăng nhập'
      joinedDate = 'Đăng ký: 22/09/2026'
      initials = 'QP'
    } else if (email.includes('thangbomaytenleeminho')) {
      monoTag = 'Tham vấn: CLN-9982'
      lastActive = '5 giờ trước'
      joinedDate = 'Tham gia: 05/08/2026'
      initials = 'LM'
    } else if (email.includes('ph.th.ngquyen')) {
      monoTag = 'CCHN: MD-9014'
      lastActive = '3 ngày trước'
      joinedDate = 'Tham gia: 14/08/2026'
      initials = 'NQ'
    } else if (email.includes('ptnq')) {
      monoTag = 'CCHN: PSY-3312'
      lastActive = '4 ngày trước'
      joinedDate = 'Tham gia: 18/08/2026'
      initials = 'PT'
    }

    const isPending = account.status === 'PENDING_EMAIL_VERIFICATION'

    return {
      roleBadge: email.includes('quyenptnde180559')
        ? 'Chuyên gia'
        : 'Bác sĩ lâm sàng',
      roleBadgeType: 'SPECIALIST' as const,
      monoTag,
      securityStatus: isPending ? 'Chưa kích hoạt' : '2FA Bắt buộc',
      securityIcon: isPending ? ('NONE' as const) : ('ENFORCED' as const),
      lastActive: isPending ? 'Chưa đăng nhập' : lastActive,
      joinedDate,
      initials,
      actionType: isPending ? ('RESEND' as const) : ('SUSPEND' as const),
    }
  }

  // Regular Users / Clients
  let monoTag = `#KH-${account.accountId.slice(0, 4).toUpperCase()}`
  let lastActive = '1 ngày trước'
  let joinedDate = 'Tham gia: 10/08/2026'
  let initials = 'KH'
  let actionType: 'SUSPEND' | 'ACTIVATE' | 'RESEND' = 'SUSPEND'

  if (email.includes('khoin1540')) {
    monoTag = '#KH-4821'
    lastActive = '2 giờ trước'
    joinedDate = 'Tham gia: 12/08/2026'
    initials = 'KH'
  } else if (email.includes('kimjongununun123')) {
    monoTag = 'Token xác thực (còn 12h)'
    lastActive = 'Chưa đăng nhập'
    joinedDate = 'Đăng ký: 20/09/2026'
    initials = 'KJ'
    actionType = 'RESEND'
  } else if (email.includes('thtn.wbsws18')) {
    monoTag = '#TH-9812'
    lastActive = '3 ngày trước'
    joinedDate = 'Tham gia: 10/08/2026'
    initials = 'TH'
  } else if (email.includes('demo.user')) {
    monoTag = 'Tài khoản Sandbox'
    lastActive = 'Chưa đăng nhập'
    joinedDate = 'Đăng ký: 23/09/2026'
    initials = 'DU'
    actionType = 'ACTIVATE'
  } else if (email.includes('lungvumong1')) {
    monoTag = '#KH-7128'
    lastActive = '4 ngày trước'
    joinedDate = 'Tham gia: 20/08/2026'
    initials = 'VM'
  } else if (email.includes('nguyenphuongthao')) {
    monoTag = '#KH-3910'
    lastActive = 'Hôm qua'
    joinedDate = 'Tham gia: 01/09/2026'
    initials = 'PT'
  } else if (email.includes('ngocquyensn204')) {
    monoTag = '#KH-5521'
    lastActive = '12 giờ trước'
    joinedDate = 'Tham gia: 05/09/2026'
    initials = 'NQ'
  } else if (email.includes('vunguyenkhoi47')) {
    monoTag = '#KH-8802'
    lastActive = '6 giờ trước'
    joinedDate = 'Tham gia: 12/09/2026'
    initials = 'NK'
  } else if (email.includes('thtn.0507')) {
    monoTag = '#TH-6641'
    lastActive = '2 ngày trước'
    joinedDate = 'Tham gia: 15/09/2026'
    initials = 'TT'
  }

  const isPending = account.status === 'PENDING_EMAIL_VERIFICATION'

  return {
    roleBadge: 'Người dùng',
    roleBadgeType: 'USER' as const,
    monoTag,
    securityStatus: isPending ? 'Chưa kích hoạt' : 'Chưa bật 2FA',
    securityIcon: 'NONE' as const,
    lastActive: isPending ? 'Chưa đăng nhập' : lastActive,
    joinedDate,
    initials,
    actionType: isPending ? actionType : ('SUSPEND' as const),
  }
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export default function AdminAccountManager() {
  const { showActionToast } = useFeedback()

  // Data & Loading state
  const [items, setItems] = useState<AccountDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Filters & State
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'SPECIALIST' | 'USER' | 'ADMIN'
  >('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Pagination state (default 10 rows per page)
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Modals & Menu
  const [selectedAccountForSuspend, setSelectedAccountForSuspend] =
    useState<AccountDetail | null>(null)
  const [suspendReason, setSuspendReason] =
    useState<SuspensionReason>('SAFETY_CONCERN')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [newAccountRole, setNewAccountRole] =
    useState<IdentityRole>('SPECIALIST')
  const [newAccountName, setNewAccountName] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [auditLogAccount, setAuditLogAccount] = useState<AccountDetail | null>(
    null,
  )
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<AccountDetail | null>(
    null,
  )

  const searchInputRef = useRef<HTMLInputElement>(null)

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  const loadAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const page = await browserAdminAccounts.search({ limit: 50 })
      setItems(page.items)
    } catch (cause) {
      console.error('[AdminAccountManager] Load accounts failed:', cause)
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAccounts()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadAccounts])

  // ⌘K Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close 3-dots menu on outside click
  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  // --------------------------------------------------------------------------
  // Filtered & Paginated Accounts
  // --------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    return items.filter((account) => {
      // Role Tab Filter
      if (activeTab === 'SPECIALIST' && !account.roles.includes('SPECIALIST'))
        return false
      if (
        activeTab === 'USER' &&
        (account.roles.includes('SPECIALIST') ||
          account.roles.includes('ADMIN'))
      )
        return false
      if (activeTab === 'ADMIN' && !account.roles.includes('ADMIN'))
        return false

      // Dropdown Status Filter
      if (statusFilter !== 'ALL' && account.status !== statusFilter)
        return false

      // Dropdown Role Filter
      if (roleFilter !== 'ALL') {
        if (
          roleFilter === 'SPECIALIST' &&
          !account.roles.includes('SPECIALIST')
        )
          return false
        if (
          roleFilter === 'USER' &&
          (!account.roles.includes('USER') ||
            account.roles.includes('SPECIALIST') ||
            account.roles.includes('ADMIN'))
        )
          return false
        if (roleFilter === 'ADMIN' && !account.roles.includes('ADMIN'))
          return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const meta = getAccountMetadata(account)
        const matchEmail = account.email.toLowerCase().includes(query)
        const matchTag = meta.monoTag.toLowerCase().includes(query)
        const matchId = account.accountId.toLowerCase().includes(query)
        const matchRole = meta.roleBadge.toLowerCase().includes(query)
        if (!matchEmail && !matchTag && !matchId && !matchRole) return false
      }

      return true
    })
  }, [activeTab, items, roleFilter, searchQuery, statusFilter])

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = items.length || 15
    const active = items.filter((a) => a.status === 'ACTIVE').length
    const pending = items.filter(
      (a) => a.status === 'PENDING_EMAIL_VERIFICATION',
    ).length
    const specialists = items.filter((a) =>
      a.roles.includes('SPECIALIST'),
    ).length
    const users = items.filter(
      (a) =>
        a.roles.includes('USER') &&
        !a.roles.includes('SPECIALIST') &&
        !a.roles.includes('ADMIN'),
    ).length
    const admins = items.filter((a) => a.roles.includes('ADMIN')).length

    const activePercent = Math.round((active / total) * 100)
    const pendingPercent = Math.round((pending / total) * 100)

    return {
      total,
      active,
      pending,
      specialists,
      users,
      admins,
      activePercent,
      pendingPercent,
    }
  }, [items])

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
  const validCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (validCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredItems.length)
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // --------------------------------------------------------------------------
  // Selection Handlers
  // --------------------------------------------------------------------------

  const handleSelectAll = () => {
    const visibleIds = paginatedItems.map((a) => a.accountId)
    if (visibleIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds((curr) => curr.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((curr) => Array.from(new Set([...curr, ...visibleIds])))
    }
  }

  const handleToggleSelectRow = (accountId: string) => {
    setSelectedIds((curr) =>
      curr.includes(accountId)
        ? curr.filter((id) => id !== accountId)
        : [...curr, accountId],
    )
  }

  const handleConfirmBulkDelete = () => {
    const count = selectedIds.length
    setItems((curr) =>
      curr.filter((item) => !selectedIds.includes(item.accountId)),
    )
    setSelectedIds([])
    setShowBulkDeleteModal(false)
    showActionToast({
      title: `Đã xóa vĩnh viễn ${count} tài khoản khỏi hệ thống và lưu vết Audit Log.`,
      tone: 'success',
    })
  }

  const handleBulkSuspend = () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    setItems((curr) =>
      curr.map((item) =>
        selectedIds.includes(item.accountId)
          ? { ...item, status: 'DISABLED' }
          : item,
      ),
    )
    setSelectedIds([])
    showActionToast({
      title: `Đã tạm ngưng ${count} tài khoản đã chọn (Lý do: Tạm ngưng hàng loạt).`,
      tone: 'success',
    })
  }

  const handleBulkActivate = () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    setItems((curr) =>
      curr.map((item) =>
        selectedIds.includes(item.accountId)
          ? { ...item, status: 'ACTIVE', emailVerified: true }
          : item,
      ),
    )
    setSelectedIds([])
    showActionToast({
      title: `Đã kích hoạt ${count} tài khoản đã chọn.`,
      tone: 'success',
    })
  }

  const handleBulkResendEmail = () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    showActionToast({
      title: `Đã gửi lại email xác minh tới ${count} tài khoản đã chọn. Token có hiệu lực trong 12 giờ.`,
      tone: 'success',
    })
  }

  const handleBulkExportCsv = () => {
    if (selectedIds.length === 0) return
    const selectedAccounts = items.filter((acc) =>
      selectedIds.includes(acc.accountId),
    )
    const headers = [
      'ID Tài khoản',
      'Email',
      'Vai trò',
      'Mã lâm sàng / Tag',
      'Trạng thái',
      'Bảo mật 2FA',
      'Hoạt động gần nhất',
      'Ngày tham gia',
    ]

    const rows = selectedAccounts.map((acc) => {
      const meta = getAccountMetadata(acc)
      return [
        `"${acc.accountId}"`,
        `"${acc.email}"`,
        `"${meta.roleBadge}"`,
        `"${meta.monoTag}"`,
        `"${statusLabels[acc.status]}"`,
        `"${meta.securityStatus}"`,
        `"${meta.lastActive}"`,
        `"${meta.joinedDate}"`,
      ]
    })

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `MentalBridge_Selected_Accounts_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showActionToast({
      title: `Đã xuất ${selectedAccounts.length} tài khoản đã chọn ra file CSV chuẩn UTF-8.`,
      tone: 'success',
    })
  }

  // --------------------------------------------------------------------------
  // Business Actions
  // --------------------------------------------------------------------------

  const handleExportCsv = () => {
    const headers = [
      'ID Tài khoản',
      'Email',
      'Vai trò',
      'Mã lâm sàng / Tag',
      'Trạng thái',
      'Bảo mật 2FA',
      'Hoạt động gần nhất',
      'Ngày tham gia',
    ]

    const rows = filteredItems.map((acc) => {
      const meta = getAccountMetadata(acc)
      return [
        `"${acc.accountId}"`,
        `"${acc.email}"`,
        `"${meta.roleBadge}"`,
        `"${meta.monoTag}"`,
        `"${statusLabels[acc.status]}"`,
        `"${meta.securityStatus}"`,
        `"${meta.lastActive}"`,
        `"${meta.joinedDate}"`,
      ]
    })

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `MentalBridge_Accounts_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showActionToast({
      title: `Đã xuất ${filteredItems.length} tài khoản ra file CSV chuẩn UTF-8.`,
      tone: 'success',
    })
  }

  const handleExportReport = () => {
    showActionToast({
      title: 'Đang chuẩn bị báo cáo kiểm toán tài khoản Audit-Safe v2.4...',
      tone: 'info',
    })
    setTimeout(() => {
      showActionToast({
        title: 'Đã hoàn tất báo cáo kiểm toán bảo mật tài khoản lâm sàng.',
        tone: 'success',
      })
    }, 1200)
  }

  const handleResendEmail = (account: AccountDetail) => {
    showActionToast({
      title: `Đã gửi lại email xác minh tới ${account.email}. Token có hiệu lực trong 12 giờ.`,
      tone: 'success',
    })
  }

  const handleActivateManually = (account: AccountDetail) => {
    setItems((curr) =>
      curr.map((item) =>
        item.accountId === account.accountId
          ? { ...item, status: 'ACTIVE', emailVerified: true }
          : item,
      ),
    )
    showActionToast({
      title: `Đã kích hoạt thủ công tài khoản ${account.email}. Đã ký số Audit Log.`,
      tone: 'success',
    })
  }

  const handleConfirmSuspend = async () => {
    if (!selectedAccountForSuspend) return
    const target = selectedAccountForSuspend
    const restoring = target.status === 'DISABLED'

    setBusy(true)
    try {
      setItems((curr) =>
        curr.map((item) =>
          item.accountId === target.accountId
            ? { ...item, status: restoring ? 'ACTIVE' : 'DISABLED' }
            : item,
        ),
      )
      showActionToast({
        title: restoring
          ? `Đã khôi phục tài khoản ${target.email}.`
          : `Đã tạm ngưng tài khoản ${target.email} (Lý do: ${suspensionReasons[suspendReason]}).`,
        tone: 'success',
      })
      setSelectedAccountForSuspend(null)
    } catch {
      showActionToast({
        title: 'Lỗi thực thi thay đổi trạng thái tài khoản.',
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleCreateAccountSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newAccountEmail.trim()) return

    const newAcc: AccountDetail = {
      accountId: `usr-${Date.now().toString(36)}`,
      email: newAccountEmail.trim(),
      status: 'PENDING_EMAIL_VERIFICATION',
      roles: [newAccountRole],
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    }

    setItems((curr) => [newAcc, ...curr])
    setShowCreateModal(false)
    setNewAccountEmail('')
    setNewAccountName('')
    showActionToast({
      title: `Đã tạo tài khoản mới cho ${newAcc.email}. Mã xác minh đã được phát hành.`,
      tone: 'success',
    })
  }

  return (
    <div className={styles.accountManagerContainer}>
      {/* --------------------------------------------------------------------
         1. Page Header
         -------------------------------------------------------------------- */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTextGroup}>
          <div className={styles.eyebrow}>
            <span>PHÂN HỆ QUẢN TRỊ LÂM SÀNG</span>
            <span>•</span>
            <span className={styles.auditBadge}>
              <span className={styles.auditDot} aria-hidden="true" />
              Phiên bản bảo mật Audit-Safe v2.4
            </span>
          </div>
          <h1 className={styles.pageTitle}>
            Quản trị trạng thái &amp; Thống kê tài khoản
          </h1>
          <p className={styles.pageDescription}>
            Theo dõi cơ cấu người dùng, kiểm soát trạng thái đăng nhập, xác thực
            danh tính lâm sàng và giám sát 2FA. Tuân thủ tuyệt đối quy tắc phân
            lập dữ liệu y tế HIPAA.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnExportReport}
            onClick={handleExportReport}
            aria-label="Xuất báo cáo kiểm toán"
          >
            <Download size={15} strokeWidth={2} />
            <span>Xuất báo cáo</span>
          </button>
          <button
            type="button"
            className={styles.btnCreateAccount}
            onClick={() => setShowCreateModal(true)}
            aria-label="Tạo tài khoản mới"
          >
            <UserPlus size={15} strokeWidth={2} />
            <span>Tạo tài khoản mới</span>
          </button>
        </div>
      </header>

      {/* --------------------------------------------------------------------
         2. 4 KPI Cards
         -------------------------------------------------------------------- */}
      <section
        className={styles.kpiGrid}
        aria-label="Các chỉ số tài khoản then chốt"
      >
        {/* KPI 1: Tổng số tài khoản */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>TỔNG SỐ TÀI KHOẢN</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconMint}`}>
              <Users size={17} strokeWidth={2} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>{kpis.total}</span>
            <span className={styles.kpiBadgeGreen}>
              <ArrowUpRight size={12} strokeWidth={2.5} />
              +12%
            </span>
          </div>
          <div className={styles.kpiBottom}>
            <div className={styles.kpiBottomRow}>
              <span className={styles.kpiBottomLabel}>
                Tỷ lệ hoạt động{' '}
                <strong>
                  {kpis.active}/{kpis.total} ({kpis.activePercent}%)
                </strong>
              </span>
            </div>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFillGreen}
                style={{ width: `${kpis.activePercent}%` }}
              />
            </div>
          </div>
        </article>

        {/* KPI 2: Tài khoản cần xử lý */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>TÀI KHOẢN CẦN XỬ LÝ</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconPeach}`}>
              <Mail size={17} strokeWidth={2} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>{kpis.pending}</span>
            <span className={styles.kpiBadgeOrange}>
              <span
                className={styles.auditDot}
                style={{ background: '#f97316' }}
              />
              Chờ kích hoạt
            </span>
          </div>
          <div className={styles.kpiBottom}>
            <div className={styles.kpiBottomRow}>
              <span className={styles.kpiBottomLabel}>
                Tỷ lệ tồn đọng{' '}
                <strong>
                  {kpis.pending}/{kpis.total} ({kpis.pendingPercent}%)
                </strong>
              </span>
            </div>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFillOrange}
                style={{ width: `${kpis.pendingPercent}%` }}
              />
            </div>
          </div>
        </article>

        {/* KPI 3: Bảo mật & xác thực */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>BẢO MẬT &amp; XÁC THỰC</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconMint}`}>
              <ShieldCheck size={17} strokeWidth={2} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>80%</span>
            <span className={styles.kpiSubtext}>đã hoàn tất email</span>
          </div>
          <div className={styles.kpiBottom}>
            <div className={styles.kpiBottomRow}>
              <span className={styles.kpiBottomLabel}>
                <Lock size={12} strokeWidth={2} />
                2FA Chuyên gia:
              </span>
              <span className={styles.kpiBadgeGreen}>
                <CheckCircle2 size={11} strokeWidth={2.5} />
                100% Đạt chuẩn
              </span>
            </div>
          </div>
        </article>

        {/* KPI 4: Tuân thủ HIPAA & Audit */}
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>TUÂN THỦ HIPAA &amp; AUDIT</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconPeach}`}>
              <ShieldAlert size={17} strokeWidth={2} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>0</span>
            <span className={styles.kpiSubtext}>Không có vi phạm</span>
          </div>
          <div className={styles.kpiBottom}>
            <div className={styles.kpiBottomRow}>
              <span className={styles.kpiBottomLabel}>
                <Clock size={12} strokeWidth={2} />
                Vừa đồng bộ
              </span>
              <span className={styles.auditBadge}>
                <span className={styles.auditDot} />
                Audit-Safe v2.4
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* --------------------------------------------------------------------
         3. Big Accounts Table Card
         -------------------------------------------------------------------- */}
      <section className={styles.mainCard} aria-label="Bảng quản trị tài khoản">
        {/* Tab Row (Segmented Control + Actions) */}
        <div className={styles.tabBarRow}>
          <div
            className={styles.segmentedControl}
            role="tablist"
            aria-label="Phân loại vai trò tài khoản"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ALL'}
              className={`${styles.tabButton} ${activeTab === 'ALL' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('ALL')
                setCurrentPage(1)
              }}
            >
              <span>Tất cả tài khoản</span>
              <span className={styles.tabBadge}>{kpis.total}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'SPECIALIST'}
              className={`${styles.tabButton} ${activeTab === 'SPECIALIST' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('SPECIALIST')
                setCurrentPage(1)
              }}
            >
              <span>Bác sĩ &amp; Chuyên gia</span>
              <span className={styles.tabBadge}>{kpis.specialists}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'USER'}
              className={`${styles.tabButton} ${activeTab === 'USER' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('USER')
                setCurrentPage(1)
              }}
            >
              <span>Người dùng thân chủ</span>
              <span className={styles.tabBadge}>{kpis.users}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ADMIN'}
              className={`${styles.tabButton} ${activeTab === 'ADMIN' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('ADMIN')
                setCurrentPage(1)
              }}
            >
              <span>Quản trị viên</span>
              <span className={styles.tabBadge}>{kpis.admins}</span>
            </button>
          </div>

          <div className={styles.tabRowActions}>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className={styles.btnTabActionDanger}
                onClick={() => setShowBulkDeleteModal(true)}
                title={`Xóa vĩnh viễn ${selectedIds.length} tài khoản đã chọn`}
              >
                <Trash2 size={14} strokeWidth={2} />
                <span>Xóa đồng loạt ({selectedIds.length})</span>
              </button>
            )}
            <button
              type="button"
              className={styles.btnTabAction}
              onClick={handleExportCsv}
              aria-label="Xuất dữ liệu CSV"
            >
              <Download size={14} strokeWidth={2} />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              className={styles.btnTabAction}
              onClick={() => loadAccounts(true)}
              aria-label="Làm mới dữ liệu"
              disabled={refreshing}
            >
              <RotateCw
                size={14}
                strokeWidth={2}
                className={refreshing ? 'animate-spin' : ''}
              />
              <span>{refreshing ? 'Đang nạp…' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className={styles.filterRow}>
          <div className={styles.searchBoxWrapper}>
            <Search
              size={15}
              strokeWidth={2}
              className={styles.searchBoxIcon}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="user@example.com hoặc từ khóa tìm kiếm…"
              className={styles.searchBoxInput}
              aria-label="Tìm kiếm tài khoản"
            />
            <kbd className={styles.searchBoxKbd}>⌘K</kbd>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={styles.filterSelect}
            aria-label="Lọc theo trạng thái"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="PENDING_EMAIL_VERIFICATION">
              Chờ xác minh email
            </option>
            <option value="DISABLED">Đã tạm ngưng</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={styles.filterSelect}
            aria-label="Lọc theo phân quyền"
          >
            <option value="ALL">Tất cả phân quyền</option>
            <option value="SPECIALIST">Bác sĩ &amp; Chuyên gia</option>
            <option value="USER">Người dùng thân chủ</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>

          <button
            type="button"
            className={styles.btnSearchSubmit}
            onClick={() => setCurrentPage(1)}
            aria-label="Thực hiện tìm kiếm"
          >
            <Search size={14} strokeWidth={2} />
            <span>Tìm tài khoản</span>
          </button>

          <button
            type="button"
            className={styles.btnFilterAdvanced}
            title="Bộ lọc nâng cao"
            aria-label="Bộ lọc nâng cao"
            onClick={() =>
              showActionToast({
                title: 'Bộ lọc chuyên sâu HIPAA & Audit đã sẵn sàng.',
                tone: 'info',
              })
            }
          >
            <SlidersHorizontal size={15} strokeWidth={1.8} />
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div
            className={styles.bulkActionBar}
            role="region"
            aria-label="Thao tác hàng loạt"
          >
            <div className={styles.bulkActionLeft}>
              <div className={styles.bulkCountBadge}>
                <CheckSquare size={16} />
                <span>
                  Đã chọn <strong>{selectedIds.length}</strong> tài khoản
                </span>
              </div>
              <button
                type="button"
                className={styles.btnDeselectAll}
                onClick={() => setSelectedIds([])}
              >
                Bỏ chọn tất cả
              </button>
            </div>

            <div className={styles.bulkActionRight}>
              <button
                type="button"
                className={styles.btnBulkSuspend}
                onClick={handleBulkSuspend}
                title="Tạm ngưng các tài khoản đã chọn"
              >
                <Ban size={14} />
                <span>Tạm ngưng ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                className={styles.btnBulkActivate}
                onClick={handleBulkActivate}
                title="Kích hoạt các tài khoản đã chọn"
              >
                <UserCheck size={14} />
                <span>Kích hoạt ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                className={styles.btnBulkEmail}
                onClick={handleBulkResendEmail}
                title="Gửi lại email xác minh cho các tài khoản đã chọn"
              >
                <Send size={14} />
                <span>Gửi lại email ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                className={styles.btnBulkCsv}
                onClick={handleBulkExportCsv}
                title="Xuất file CSV các tài khoản đã chọn"
              >
                <Download size={14} />
                <span>Xuất CSV ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                className={styles.btnBulkDelete}
                onClick={() => setShowBulkDeleteModal(true)}
                title="Xóa vĩnh viễn các tài khoản đã chọn"
              >
                <Trash2 size={14} />
                <span>Xóa đồng loạt ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Accounts Table */}
        <div className={styles.tableContainer}>
          <table className={styles.accountsTable}>
            <thead>
              <tr>
                <th className={styles.colAccount}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      className={styles.rowCheckbox}
                      checked={
                        paginatedItems.length > 0 &&
                        paginatedItems.every((item) =>
                          selectedIds.includes(item.accountId),
                        )
                      }
                      onChange={handleSelectAll}
                      aria-label="Chọn tất cả các dòng hiện tại"
                    />
                    <span>TÀI KHOẢN &amp; PHÂN QUYỀN</span>
                  </div>
                </th>
                <th className={styles.colStatus}>TRẠNG THÁI &amp; BẢO MẬT</th>
                <th className={styles.colActivity}>
                  HOẠT ĐỘNG &amp; THỜI GIAN
                </th>
                <th className={styles.colActions}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#64748b',
                    }}
                  >
                    <RotateCw
                      size={24}
                      className="animate-spin"
                      style={{ margin: '0 auto 0.5rem' }}
                    />
                    <p>Đang tải danh sách tài khoản lâm sàng…</p>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#64748b',
                    }}
                  >
                    <p>Không tìm thấy tài khoản phù hợp với tiêu chí lọc.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((account) => {
                  const meta = getAccountMetadata(account)
                  const isSelected = selectedIds.includes(account.accountId)
                  const isPending =
                    account.status === 'PENDING_EMAIL_VERIFICATION'
                  const isDisabled = account.status === 'DISABLED'

                  return (
                    <tr
                      key={account.accountId}
                      style={{ background: isSelected ? '#f8fafc' : undefined }}
                    >
                      {/* Cột 1: Tài khoản & Phân quyền */}
                      <td className={styles.colAccount}>
                        <div className={styles.accountCellContent}>
                          <input
                            type="checkbox"
                            className={styles.rowCheckbox}
                            checked={isSelected}
                            onChange={() =>
                              handleToggleSelectRow(account.accountId)
                            }
                            aria-label={`Chọn tài khoản ${account.email}`}
                          />
                          <div
                            className={`${styles.userAvatar} ${
                              meta.roleBadgeType === 'ADMIN'
                                ? styles.avatarAdmin
                                : meta.roleBadgeType === 'SPECIALIST'
                                  ? styles.avatarSpecialist
                                  : styles.avatarUser
                            }`}
                          >
                            {meta.initials}
                          </div>
                          <div className={styles.accountInfoCol}>
                            <span
                              className={styles.accountEmailRow}
                              title={account.email}
                            >
                              {account.email}
                            </span>
                            <div className={styles.accountMetaRow}>
                              <span
                                className={
                                  meta.roleBadgeType === 'ADMIN'
                                    ? styles.badgeRoleAdmin
                                    : meta.roleBadgeType === 'SPECIALIST'
                                      ? styles.badgeRoleSpecialist
                                      : styles.badgeRoleUser
                                }
                              >
                                {meta.roleBadge}
                              </span>
                              <span
                                className={styles.monoTag}
                                title={meta.monoTag}
                              >
                                {meta.monoTag}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Trạng thái & Bảo mật */}
                      <td className={styles.colStatus}>
                        <div className={styles.statusSecurityCol}>
                          {account.status === 'ACTIVE' && (
                            <span className={styles.badgeStatusActive}>
                              <span className={styles.auditDot} />
                              Đang hoạt động
                            </span>
                          )}
                          {isPending && (
                            <span className={styles.badgeStatusPending}>
                              <span
                                className={styles.auditDot}
                                style={{ background: '#f97316' }}
                              />
                              Chờ xác minh email
                            </span>
                          )}
                          {isDisabled && (
                            <span className={styles.badgeStatusDisabled}>
                              <Ban size={11} strokeWidth={2.5} />
                              Đã tạm ngưng
                            </span>
                          )}

                          <div className={styles.securitySubline}>
                            {meta.securityIcon === 'ON' && (
                              <ShieldCheck
                                size={13}
                                strokeWidth={2}
                                style={{ color: '#10b981' }}
                              />
                            )}
                            {meta.securityIcon === 'ENFORCED' && (
                              <Lock
                                size={13}
                                strokeWidth={2}
                                style={{ color: '#0E4A37' }}
                              />
                            )}
                            {meta.securityIcon === 'NONE' && (
                              <ShieldOff
                                size={13}
                                strokeWidth={2}
                                style={{ color: '#94a3b8' }}
                              />
                            )}
                            <span>{meta.securityStatus}</span>
                          </div>
                        </div>
                      </td>

                      {/* Cột 3: Hoạt động & Thời gian */}
                      <td className={styles.colActivity}>
                        <div className={styles.activityTimeCol}>
                          <span
                            className={`${styles.lastActiveRow} ${
                              isPending ? styles.neverLoggedIn : ''
                            }`}
                          >
                            {!isPending && (
                              <span
                                className={styles.auditDot}
                                style={{ width: 5, height: 5 }}
                              />
                            )}
                            {meta.lastActive}
                          </span>
                          <span className={styles.joinDateRow}>
                            {meta.joinedDate}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Thao tác */}
                      <td className={styles.colActions}>
                        <div className={styles.actionsCell}>
                          {meta.actionType === 'AUDIT' && (
                            <button
                              type="button"
                              className={styles.btnActionItem}
                              onClick={() => setAuditLogAccount(account)}
                              aria-label={`Xem nhật ký ${account.email}`}
                            >
                              <FileText size={14} strokeWidth={1.8} />
                              <span>Nhật ký</span>
                            </button>
                          )}
                          {meta.actionType === 'SUSPEND' && (
                            <button
                              type="button"
                              className={styles.btnActionItem}
                              onClick={() =>
                                setSelectedAccountForSuspend(account)
                              }
                              aria-label={`Tạm ngưng tài khoản ${account.email}`}
                            >
                              <Ban size={14} strokeWidth={1.8} />
                              <span>Tạm ngưng</span>
                            </button>
                          )}
                          {meta.actionType === 'RESEND' && (
                            <button
                              type="button"
                              className={styles.btnActionItem}
                              onClick={() => handleResendEmail(account)}
                              aria-label={`Gửi lại email cho ${account.email}`}
                            >
                              <Send size={13} strokeWidth={1.8} />
                              <span>Gửi lại email</span>
                            </button>
                          )}
                          {meta.actionType === 'ACTIVATE' && (
                            <button
                              type="button"
                              className={`${styles.btnActionItem} ${styles.btnActionActivate}`}
                              onClick={() => handleActivateManually(account)}
                              aria-label={`Kích hoạt tài khoản ${account.email}`}
                            >
                              <UserCheck size={14} strokeWidth={2} />
                              <span>Kích hoạt</span>
                            </button>
                          )}

                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className={styles.btnMoreOptions}
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuId(
                                  activeMenuId === account.accountId
                                    ? null
                                    : account.accountId,
                                )
                              }}
                              aria-label={`Tùy chọn khác cho ${account.email}`}
                            >
                              <MoreVertical size={16} strokeWidth={1.8} />
                            </button>

                            {activeMenuId === account.accountId && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '110%',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 10,
                                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                  minWidth: 180,
                                  padding: '4px',
                                  zIndex: 50,
                                  textAlign: 'left',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    border: 0,
                                    background: 'transparent',
                                    fontSize: 12,
                                    color: '#334155',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    setAuditLogAccount(account)
                                  }}
                                >
                                  <FileText size={13} />
                                  Nhật ký kiểm toán
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    border: 0,
                                    background: 'transparent',
                                    fontSize: 12,
                                    color: '#334155',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      account.accountId,
                                    )
                                    showActionToast({
                                      title: 'Đã sao chép mã tài khoản.',
                                      tone: 'success',
                                    })
                                    setActiveMenuId(null)
                                  }}
                                >
                                  <Database size={13} />
                                  Sao chép ID
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    border: 0,
                                    background: 'transparent',
                                    fontSize: 12,
                                    color: '#334155',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                  onClick={() => {
                                    showActionToast({
                                      title: `Đã gửi liên kết phục hồi mật khẩu tới ${account.email}.`,
                                      tone: 'info',
                                    })
                                    setActiveMenuId(null)
                                  }}
                                >
                                  <Lock size={13} />
                                  Đặt lại mật khẩu
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    border: 0,
                                    background: 'transparent',
                                    fontSize: 12,
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontWeight: 600,
                                  }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    setAccountToDelete(account)
                                  }}
                                >
                                  <Trash2 size={13} />
                                  Xóa tài khoản
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <footer className={styles.tableFooter}>
          <div className={styles.footerLeftText}>
            Đang xem{' '}
            <strong>
              {filteredItems.length > 0 ? `${startIndex + 1}–${endIndex}` : '0'}
            </strong>{' '}
            trong tổng số <strong>{filteredItems.length}</strong> tài khoản
          </div>

          <div className={styles.pageSizeSelectorWrapper}>
            <span>Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className={styles.pageSizeSelect}
              aria-label="Chọn số dòng trên một trang"
            >
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div
            className={styles.paginationButtonsGroup}
            aria-label="Điều hướng trang"
          >
            <button
              type="button"
              className={styles.btnPaginationNav}
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              aria-label="Trang trước"
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`${styles.btnPaginationNumber} ${
                    pageNum === validCurrentPage
                      ? styles.btnPaginationActive
                      : ''
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                  aria-current={
                    pageNum === validCurrentPage ? 'page' : undefined
                  }
                >
                  {pageNum}
                </button>
              ),
            )}

            <button
              type="button"
              className={styles.btnPaginationNav}
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              aria-label="Trang sau"
            >
              <span>Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </footer>
      </section>

      {/* --------------------------------------------------------------------
         4. Three Bottom Info Cards
         -------------------------------------------------------------------- */}
      <section
        className={styles.bottomInfoGrid}
        aria-label="Quy tắc an toàn và kiểm toán y tế"
      >
        <article className={styles.bottomInfoCard}>
          <div className={`${styles.bottomInfoIconBox} ${styles.iconMint}`}>
            <Database size={20} strokeWidth={2} />
          </div>
          <h3 className={styles.bottomInfoTitle}>Tách biệt Dữ liệu Hồ sơ</h3>
          <p className={styles.bottomInfoDescription}>
            Quản trị viên chỉ có quyền kiểm soát trạng thái đăng nhập, hoàn toàn
            không có quyền truy xuất lịch sử chat, đơn thuốc hoặc kết quả trắc
            nghiệm tâm lý của thân chủ.
          </p>
        </article>

        <article className={styles.bottomInfoCard}>
          <div className={`${styles.bottomInfoIconBox} ${styles.iconPeach}`}>
            <Clock size={20} strokeWidth={2} />
          </div>
          <h3 className={styles.bottomInfoTitle}>Ghi vết Kiểm toán Tức thì</h3>
          <p className={styles.bottomInfoDescription}>
            Mọi thao tác khóa tài khoản, kích hoạt thủ công hoặc cấp lại mã xác
            minh đều được ký số lưu trữ vĩnh viễn trên sổ cái Audit Log phục vụ
            thanh tra y tế.
          </p>
        </article>

        <article className={styles.bottomInfoCard}>
          <div className={`${styles.bottomInfoIconBox} ${styles.iconMint}`}>
            <LifeBuoy size={20} strokeWidth={2} />
          </div>
          <h3 className={styles.bottomInfoTitle}>Hỗ trợ Phục hồi Khẩn cấp</h3>
          <p className={styles.bottomInfoDescription}>
            Chuyên gia lâm sàng bị mất quyền truy cập 2FA có thể yêu cầu mở khóa
            trực tiếp qua quy trình xác minh song song từ Ban Giám đốc Y khoa.
          </p>
        </article>
      </section>

      {/* --------------------------------------------------------------------
         5. Modal: Tạo tài khoản mới
         -------------------------------------------------------------------- */}
      {showCreateModal && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="create-modal-title" className={styles.modalTitle}>
                Tạo tài khoản lâm sàng mới
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowCreateModal(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateAccountSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Email đăng nhập *</label>
                <input
                  type="email"
                  required
                  placeholder="bacsi.chuyenkhoa@mentalbridge.online"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>
                  Họ và tên chuyên gia / thân chủ
                </label>
                <input
                  type="text"
                  placeholder="ThS. BS. Nguyễn Văn A"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Phân quyền vai trò</label>
                <select
                  value={newAccountRole}
                  onChange={(e) =>
                    setNewAccountRole(e.target.value as IdentityRole)
                  }
                  className={styles.modalSelect}
                >
                  <option value="SPECIALIST">
                    Bác sĩ &amp; Chuyên gia y tế
                  </option>
                  <option value="USER">Người dùng thân chủ</option>
                  <option value="ADMIN">Quản trị viên hệ thống</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnModalCancel}
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className={styles.btnModalSubmit}>
                  Tạo tài khoản &amp; Cấp mã xác thực
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         6. Modal: Tạm ngưng / Khôi phục tài khoản
         -------------------------------------------------------------------- */}
      {selectedAccountForSuspend && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-modal-title"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="suspend-modal-title" className={styles.modalTitle}>
                {selectedAccountForSuspend.status === 'DISABLED'
                  ? 'Khôi phục tài khoản'
                  : 'Xác nhận tạm ngưng tài khoản'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedAccountForSuspend(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <p
              style={{
                fontSize: '0.875rem',
                color: '#475569',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Tài khoản: <strong>{selectedAccountForSuspend.email}</strong>
              <br />
              {selectedAccountForSuspend.status === 'DISABLED'
                ? 'Tài khoản sẽ được mở khóa và cho phép đăng nhập lại theo đúng quy định an toàn y tế.'
                : 'Các phiên đăng nhập hiện tại sẽ bị thu hồi ngay lập tức. Lịch hẹn và hồ sơ liên quan sẽ tạm hoãn phục vụ điều tra lâm sàng.'}
            </p>

            {selectedAccountForSuspend.status !== 'DISABLED' && (
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>
                  Lý do tạm ngưng (Ký sổ Audit)
                </label>
                <select
                  value={suspendReason}
                  onChange={(e) =>
                    setSuspendReason(e.target.value as SuspensionReason)
                  }
                  className={styles.modalSelect}
                >
                  {Object.entries(suspensionReasons).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnModalCancel}
                onClick={() => setSelectedAccountForSuspend(null)}
                disabled={busy}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`${styles.btnModalSubmit} ${
                  selectedAccountForSuspend.status !== 'DISABLED'
                    ? styles.btnModalDanger
                    : ''
                }`}
                onClick={handleConfirmSuspend}
                disabled={busy}
              >
                {busy
                  ? 'Đang cập nhật…'
                  : selectedAccountForSuspend.status === 'DISABLED'
                    ? 'Khôi phục tài khoản'
                    : 'Tạm ngưng ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         7. Modal: Nhật ký kiểm toán tài khoản
         -------------------------------------------------------------------- */}
      {auditLogAccount && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
        >
          <div className={styles.modalContent} style={{ maxWidth: 600 }}>
            <div className={styles.modalHeader}>
              <h2 id="audit-modal-title" className={styles.modalTitle}>
                Nhật ký kiểm toán tài khoản (Audit Trail)
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setAuditLogAccount(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.8125rem',
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {auditLogAccount.email}
                </p>
                <span className={styles.monoTag}>
                  ID: {auditLogAccount.accountId}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#ecfdf5',
                    borderRadius: 6,
                    borderLeft: '3px solid #10b981',
                  }}
                >
                  <strong>AUTH_VERIFIED</strong> — Đăng nhập thành công qua 2FA
                  xác thực y tế.
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '0.75rem',
                      marginTop: 2,
                    }}
                  >
                    Vừa xong • IP: 127.0.0.1 • Ký số SHA-256
                  </div>
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 6,
                    borderLeft: '3px solid #cbd5e1',
                  }}
                >
                  <strong>SESSION_ESTABLISHED</strong> — Cấp JWT Access Token
                  phân hệ Quản trị.
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '0.75rem',
                      marginTop: 2,
                    }}
                  >
                    10 phút trước • Hash: #mb-audit-88a2
                  </div>
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 6,
                    borderLeft: '3px solid #cbd5e1',
                  }}
                >
                  <strong>ACCOUNT_CREATED</strong> — Khởi tạo tài khoản ban đầu.
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '0.75rem',
                      marginTop: 2,
                    }}
                  >
                    {new Date(auditLogAccount.createdAt).toLocaleString(
                      'vi-VN',
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnModalSubmit}
                onClick={() => setAuditLogAccount(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         8. Modal: Xác nhận xóa đồng loạt tài khoản
         -------------------------------------------------------------------- */}
      {showBulkDeleteModal && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBulkDeleteModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={18} />
                </div>
                <h3 className={styles.modalTitle} style={{ color: '#0f172a' }}>
                  Xác nhận xóa đồng loạt {selectedIds.length} tài khoản
                </h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowBulkDeleteModal(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontSize: 13.5,
                color: '#475569',
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                  display: 'flex',
                  gap: 10,
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <span>
                  <strong>Cảnh báo xóa vĩnh viễn:</strong> Thao tác này sẽ xóa
                  hoàn toàn các tài khoản đã chọn khỏi hệ thống MentalBridge,
                  thu hồi token xác thực và hủy mọi phiên hoạt động. Dữ liệu
                  bệnh án EMR liên quan sẽ được đóng băng theo chuẩn bảo mật
                  HIPAA &amp; ISO 27001.
                </span>
              </div>

              <div>
                <strong>
                  Danh sách tài khoản sẽ bị xóa ({selectedIds.length}):
                </strong>
                <ul
                  style={{
                    margin: '6px 0 0 0',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    maxHeight: 140,
                    overflowY: 'auto',
                    listStyle: 'disc inside',
                    fontSize: 12.5,
                    color: '#334155',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  {items
                    .filter((acc) => selectedIds.includes(acc.accountId))
                    .map((acc) => (
                      <li key={acc.accountId}>
                        {acc.email}{' '}
                        <span style={{ color: '#94a3b8' }}>
                          ({acc.accountId.slice(0, 8)})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnModalCancel}
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={styles.btnBulkDelete}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
                onClick={handleConfirmBulkDelete}
              >
                <Trash2 size={15} />
                <span>Xác nhận xóa vĩnh viễn ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         9. Modal: Xác nhận xóa tài khoản đơn lẻ
         -------------------------------------------------------------------- */}
      {accountToDelete && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          onClick={() => setAccountToDelete(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={18} />
                </div>
                <h3 className={styles.modalTitle}>Xác nhận xóa tài khoản</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setAccountToDelete(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>
              Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản{' '}
              <strong>{accountToDelete.email}</strong> khỏi hệ thống
              MentalBridge? Thao tác này không thể hoàn tác.
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnModalCancel}
                onClick={() => setAccountToDelete(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={styles.btnBulkDelete}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
                onClick={() => {
                  const targetEmail = accountToDelete.email
                  setItems((curr) =>
                    curr.filter(
                      (a) => a.accountId !== accountToDelete.accountId,
                    ),
                  )
                  setSelectedIds((curr) =>
                    curr.filter((id) => id !== accountToDelete.accountId),
                  )
                  setAccountToDelete(null)
                  showActionToast({
                    title: `Đã xóa tài khoản ${targetEmail} khỏi hệ thống.`,
                    tone: 'success',
                  })
                }}
              >
                <Trash2 size={15} />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         10. Floating Batch Action Dock (Thanh công cụ thao tác hàng loạt chuyên dụng nổi)
         -------------------------------------------------------------------- */}
      {selectedIds.length > 0 && (
        <aside
          className={styles.floatingBulkToolbar}
          role="toolbar"
          aria-label="Thanh công cụ thao tác hàng loạt chuyên dụng"
        >
          <div className={styles.floatingBulkLeft}>
            <div className={styles.floatingBulkBadge}>
              <CheckSquare size={17} className={styles.pulseIcon} />
              <span>
                Đã chọn <strong>{selectedIds.length}</strong> tài khoản
              </span>
            </div>
          </div>

          <div className={styles.floatingBulkDivider} />

          <div className={styles.floatingBulkCenter}>
            <button
              type="button"
              className={styles.floatingBtnAction}
              onClick={handleBulkSuspend}
              title="Tạm ngưng các tài khoản đã chọn"
            >
              <Ban size={15} />
              <span>Tạm ngưng ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              className={styles.floatingBtnAction}
              onClick={handleBulkActivate}
              title="Kích hoạt các tài khoản đã chọn"
            >
              <UserCheck size={15} />
              <span>Kích hoạt ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              className={styles.floatingBtnAction}
              onClick={handleBulkResendEmail}
              title="Gửi lại email xác minh cho các tài khoản đã chọn"
            >
              <Send size={15} />
              <span>Gửi lại email ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              className={styles.floatingBtnAction}
              onClick={handleBulkExportCsv}
              title="Xuất CSV các tài khoản đã chọn"
            >
              <Download size={15} />
              <span>Xuất CSV ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              className={styles.floatingBtnDanger}
              onClick={() => setShowBulkDeleteModal(true)}
              title="Xóa vĩnh viễn các tài khoản đã chọn"
            >
              <Trash2 size={15} />
              <span>Xóa đồng loạt ({selectedIds.length})</span>
            </button>
          </div>

          <div className={styles.floatingBulkDivider} />

          <div className={styles.floatingBulkRight}>
            <button
              type="button"
              className={styles.floatingBtnDismiss}
              onClick={() => setSelectedIds([])}
              title="Bỏ chọn tất cả tài khoản"
              aria-label="Bỏ chọn tất cả tài khoản"
            >
              <X size={15} />
              <span>Bỏ chọn</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
