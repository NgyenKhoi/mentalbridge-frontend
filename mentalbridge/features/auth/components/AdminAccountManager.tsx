'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  AccountDetail,
  AccountStatus,
  IdentityRole,
} from '../api/identity-contract'
import {
  browserAdminAccounts,
  type AccountSearch,
} from '../api/browser-admin-accounts'
import styles from './AdminAccountManager.module.css'

const statusLabels: Record<AccountStatus, string> = {
  PENDING_EMAIL_VERIFICATION: 'Chờ xác minh email',
  ACTIVE: 'Đang hoạt động',
  DISABLED: 'Đã tạm ngưng',
  DELETION_PENDING: 'Chờ xóa',
  DELETED: 'Đã xóa',
}

const roleLabels: Record<IdentityRole, string> = {
  USER: 'Người dùng',
  SPECIALIST: 'Chuyên gia',
  ADMIN: 'Quản trị viên',
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

export default function AdminAccountManager() {
  const { confirm, showActionToast } = useFeedback()
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [items, setItems] = useState<AccountDetail[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>()
  const [selected, setSelected] = useState<AccountDetail | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [reason, setReason] = useState<SuspensionReason>('SAFETY_CONCERN')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError('')
      setConflict(false)
      try {
        const filters: AccountSearch = {
          ...(status ? { status: status as AccountStatus } : {}),
          ...(role ? { role: role as IdentityRole } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(cursor ? { cursor } : {}),
          limit: 20,
        }
        const page = await browserAdminAccounts.search(filters)
        setItems(page.items)
        setNextCursor(page.nextCursor ?? null)
        setCurrentCursor(cursor)
      } catch (cause) {
        setError(errorMessage(cause))
      } finally {
        setLoading(false)
      }
    },
    [email, role, status],
  )

  useEffect(() => {
    let active = true
    browserAdminAccounts
      .search({ limit: 20 })
      .then((page) => {
        if (!active) return
        setItems(page.items)
        setNextCursor(page.nextCursor ?? null)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function inspect(accountId: string) {
    setError('')
    setConflict(false)
    try {
      const result = await browserAdminAccounts.detail(accountId)
      setSelected(result.data)
      setEtag(result.etag)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setCursorHistory([])
    setSelected(null)
    setEtag(null)
    void load()
  }

  function nextPage() {
    if (!nextCursor) return
    setCursorHistory((history) => [...history, currentCursor ?? ''])
    setSelected(null)
    void load(nextCursor)
  }

  function previousPage() {
    const previous = cursorHistory.at(-1)
    if (previous === undefined) return
    setCursorHistory((history) => history.slice(0, -1))
    setSelected(null)
    void load(previous || undefined)
  }

  async function refreshSelected() {
    if (selected) await inspect(selected.accountId)
  }

  async function changeState() {
    if (!selected || !etag || selected.roles.includes('ADMIN')) return
    const restoring = selected.status === 'DISABLED'
    const impact = selected.roles.includes('SPECIALIST')
      ? 'Các phiên đăng nhập hiện tại sẽ bị thu hồi. Trạng thái tài khoản chuyên gia ở các khu vực liên quan có thể cần một khoảng thời gian ngắn để cập nhật.'
      : 'Các phiên đăng nhập hiện tại sẽ bị thu hồi và đăng nhập mới bị chặn cho đến khi tài khoản được khôi phục.'
    const approved = await confirm({
      title: restoring ? 'Khôi phục tài khoản?' : 'Tạm ngưng tài khoản?',
      description: restoring
        ? 'Tài khoản có thể đăng nhập lại theo trạng thái xác minh email hiện tại. Các tác động đã xảy ra ở dịch vụ khác không được tự động hoàn tác.'
        : impact,
      confirmLabel: restoring ? 'Khôi phục' : 'Tạm ngưng',
      tone: restoring ? 'warning' : 'danger',
    })
    if (!approved) return

    setBusy(true)
    setError('')
    setConflict(false)
    try {
      const result = await browserAdminAccounts.changeState(
        selected.accountId,
        restoring
          ? { status: 'ACTIVE', reasonCode: 'REVIEW_COMPLETED' }
          : { status: 'DISABLED', reasonCode: reason },
        etag,
      )
      setSelected(result.data)
      setEtag(result.etag)
      setItems((current) =>
        current.map((item) =>
          item.accountId === result.data.accountId ? result.data : item,
        ),
      )
      showActionToast({
        title: restoring
          ? 'Đã khôi phục tài khoản.'
          : 'Đã tạm ngưng tài khoản.',
        tone: 'success',
      })
    } catch (cause) {
      const stale =
        cause instanceof ApiError &&
        (cause.status === 412 || cause.code === 'VERSION_CONFLICT')
      setConflict(stale)
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const actionable =
    selected &&
    !selected.roles.includes('ADMIN') &&
    ['ACTIVE', 'PENDING_EMAIL_VERIFICATION', 'DISABLED'].includes(
      selected.status,
    )

  return (
    <section className={styles.workspace}>
      <header>
        <span>QUẢN TRỊ TÀI KHOẢN</span>
        <h1>Quản trị trạng thái tài khoản</h1>
        <p>
          Tra cứu thông tin tài khoản cần thiết, tạm ngưng hoặc khôi phục bằng
          phiên bản hiện tại. Không hiển thị dữ liệu sức khỏe hay nội dung hỗ
          trợ riêng tư.
        </p>
      </header>

      <form className={styles.filters} onSubmit={submitSearch}>
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vai trò
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">Tất cả</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Email chính xác
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
          />
        </label>
        <button type="submit" disabled={loading}>
          Tìm tài khoản
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {conflict && selected && (
        <button
          className={styles.refresh}
          onClick={() => void refreshSelected()}
        >
          Tải trạng thái mới nhất
        </button>
      )}

      <div className={styles.layout}>
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h2>Tài khoản</h2>
            <span>{items.length}</span>
          </div>
          {loading ? (
            <p>Đang tải…</p>
          ) : items.length === 0 ? (
            <p>Không tìm thấy tài khoản phù hợp.</p>
          ) : (
            items.map((account) => (
              <button
                key={account.accountId}
                onClick={() => void inspect(account.accountId)}
                aria-pressed={selected?.accountId === account.accountId}
              >
                <strong>{account.email}</strong>
                <span>
                  {account.roles.map((item) => roleLabels[item]).join(', ')}
                </span>
                <small>{statusLabels[account.status]}</small>
              </button>
            ))
          )}
          <div className={styles.pagination}>
            <button
              disabled={cursorHistory.length === 0 || loading}
              onClick={previousPage}
            >
              Trang trước
            </button>
            <button disabled={!nextCursor || loading} onClick={nextPage}>
              Trang sau
            </button>
          </div>
        </div>

        <article className={styles.detail}>
          {!selected ? (
            <div className={styles.empty}>
              <strong>Chọn một tài khoản</strong>
              <p>Chi tiết an toàn và hành động phù hợp sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <small>#{selected.accountId.slice(0, 8)}</small>
                  <h2>{selected.email}</h2>
                </div>
                <span>{statusLabels[selected.status]}</span>
              </div>
              <dl>
                <div>
                  <dt>Vai trò</dt>
                  <dd>
                    {selected.roles.map((item) => roleLabels[item]).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {selected.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                  </dd>
                </div>
                <div>
                  <dt>Phiên bản</dt>
                  <dd>{selected.version}</dd>
                </div>
                <div>
                  <dt>Cập nhật</dt>
                  <dd>
                    {new Date(selected.updatedAt).toLocaleString('vi-VN')}
                  </dd>
                </div>
              </dl>
              {selected.roles.includes('ADMIN') ? (
                <p className={styles.protected}>
                  Tài khoản ADMIN chuyên dụng được bảo vệ và không thể thay đổi
                  tại đây.
                </p>
              ) : actionable ? (
                <div className={styles.actions}>
                  {selected.status !== 'DISABLED' && (
                    <label>
                      Lý do tạm ngưng
                      <select
                        value={reason}
                        onChange={(event) =>
                          setReason(event.target.value as SuspensionReason)
                        }
                      >
                        {Object.entries(suspensionReasons).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  <button
                    className={
                      selected.status === 'DISABLED'
                        ? styles.restore
                        : styles.danger
                    }
                    disabled={busy}
                    onClick={() => void changeState()}
                  >
                    {busy
                      ? 'Đang cập nhật…'
                      : selected.status === 'DISABLED'
                        ? 'Khôi phục tài khoản'
                        : 'Tạm ngưng tài khoản'}
                  </button>
                </div>
              ) : (
                <p className={styles.protected}>
                  Không thể tạm ngưng hoặc khôi phục tài khoản ở trạng thái này.
                </p>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  )
}
