'use client'

import { useMemo, useState } from 'react'
import './admin-users-manager.css'

type UserStatus = 'Hoạt động' | 'Tạm khóa' | 'Chờ xác minh'
type UserAccount = {
  id: string
  name: string
  initials: string
  email: string
  plan: 'Free' | 'Plus'
  joined: string
  lastActive: string
  status: UserStatus
  sessions: number
}

type UserDetail = {
  id: string
  title: string
  meta: string
  status: string
  detail: string
}

type Props = {
  onSelect: (user: UserDetail) => void
  onNotice: (message: string) => void
}

const INITIAL_USERS: UserAccount[] = [
  {
    id: 'U-1842',
    name: 'Nguyễn Minh Anh',
    initials: 'MA',
    email: 'minhanh@example.com',
    plan: 'Plus',
    joined: '04/04/2026',
    lastActive: '8 phút trước',
    status: 'Hoạt động',
    sessions: 5,
  },
  {
    id: 'U-2110',
    name: 'Trần Gia Hân',
    initials: 'GH',
    email: 'giahan@example.com',
    plan: 'Free',
    joined: '18/06/2026',
    lastActive: '2 ngày trước',
    status: 'Tạm khóa',
    sessions: 2,
  },
  {
    id: 'U-2284',
    name: 'Phạm Thảo Vy',
    initials: 'TV',
    email: 'thaovy@example.com',
    plan: 'Plus',
    joined: '09/07/2026',
    lastActive: '32 phút trước',
    status: 'Hoạt động',
    sessions: 7,
  },
  {
    id: 'U-2361',
    name: 'Lê Hoàng Nam',
    initials: 'HN',
    email: 'hoangnam@example.com',
    plan: 'Free',
    joined: '26/07/2026',
    lastActive: 'Hôm qua, 21:14',
    status: 'Hoạt động',
    sessions: 3,
  },
  {
    id: 'U-2417',
    name: 'Võ Khánh Linh',
    initials: 'KL',
    email: 'khanhlinh@example.com',
    plan: 'Free',
    joined: '08/08/2026',
    lastActive: 'Chưa đăng nhập',
    status: 'Chờ xác minh',
    sessions: 0,
  },
  {
    id: 'U-2453',
    name: 'Đặng Quang Huy',
    initials: 'QH',
    email: 'quanghuy@example.com',
    plan: 'Plus',
    joined: '14/08/2026',
    lastActive: '1 giờ trước',
    status: 'Hoạt động',
    sessions: 4,
  },
]

const FILTERS: Array<{ key: 'all' | UserStatus; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Hoạt động', label: 'Đang hoạt động' },
  { key: 'Tạm khóa', label: 'Tạm khóa' },
  { key: 'Chờ xác minh', label: 'Chờ xác minh' },
]

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4 4" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AdminUsersManager({ onSelect, onNotice }: Props) {
  const [users, setUsers] = useState(INITIAL_USERS)
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] =
    useState<(typeof FILTERS)[number]['key']>('all')
  const [planFilter, setPlanFilter] = useState<'all' | UserAccount['plan']>(
    'all',
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const visibleUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery = `${user.name} ${user.email} ${user.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
        const matchesStatus =
          activeFilter === 'all' || user.status === activeFilter
        const matchesPlan = planFilter === 'all' || user.plan === planFilter
        return matchesQuery && matchesStatus && matchesPlan
      }),
    [activeFilter, planFilter, query, users],
  )

  const selectAll = () => {
    const visibleIds = visibleUsers.map((user) => user.id)
    setSelectedIds((current) =>
      visibleIds.every((id) => current.includes(id))
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    )
  }

  const updateSelectedStatus = (status: UserStatus) => {
    setUsers((current) =>
      current.map((user) =>
        selectedIds.includes(user.id) ? { ...user, status } : user,
      ),
    )
    onNotice(
      `Đã cập nhật ${selectedIds.length} tài khoản sang trạng thái “${status}”.`,
    )
    setSelectedIds([])
  }

  const openUser = (user: UserAccount) =>
    onSelect({
      id: user.id,
      title: user.name,
      meta: `${user.email} · ${user.plan} · Tham gia ${user.joined}`,
      status: user.status,
      detail: `Mã tài khoản ${user.id}. Hoạt động gần nhất: ${user.lastActive}. Đã hoàn thành ${user.sessions} phiên tư vấn. Dữ liệu đánh giá tâm lý và nhật ký không hiển thị trong khu vực quản trị.`,
    })

  return (
    <div className="admin-users-manager">
      <header className="admin-users-heading">
        <div>
          <span className="admin-users-eyebrow">Quản trị nền tảng</span>
          <h1>Quản lý người dùng</h1>
          <p>
            Tra cứu tài khoản, theo dõi trạng thái truy cập và xử lý các trường
            hợp cần hỗ trợ.
          </p>
        </div>
        <div className="admin-users-heading-actions">
          <span>
            <i /> Dữ liệu cập nhật lúc 10:24
          </span>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              onNotice('Báo cáo người dùng đang được chuẩn bị để tải xuống.')
            }
          >
            <DownloadIcon /> Xuất báo cáo
          </button>
        </div>
      </header>

      <section className="admin-users-stats" aria-label="Tổng quan người dùng">
        <article className="is-primary">
          <span>Tổng người dùng</span>
          <strong>12.480</strong>
          <p>
            <b>↑ 8,4%</b> so với tháng trước
          </p>
          <i>01</i>
        </article>
        <article>
          <span>Đang hoạt động</span>
          <strong>11.926</strong>
          <p>95,6% tổng tài khoản</p>
          <i>02</i>
        </article>
        <article>
          <span>Đăng ký trong tháng</span>
          <strong>734</strong>
          <p>Trung bình 27 tài khoản/ngày</p>
          <i>03</i>
        </article>
        <article className="is-attention">
          <span>Cần kiểm tra</span>
          <strong>18</strong>
          <p>7 tạm khóa · 11 chờ xác minh</p>
          <i>04</i>
        </article>
      </section>

      <section className="admin-users-panel">
        <header className="admin-users-panel-head">
          <nav aria-label="Lọc trạng thái tài khoản">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={activeFilter === filter.key ? 'active' : ''}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
                {filter.key !== 'all' && (
                  <small>
                    {users.filter((user) => user.status === filter.key).length}
                  </small>
                )}
              </button>
            ))}
          </nav>
          <p>
            <i /> Chỉ hiển thị dữ liệu quản trị tài khoản
          </p>
        </header>

        <div className="admin-users-toolbar">
          <label>
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, email hoặc mã tài khoản..."
            />
          </label>
          <select
            value={planFilter}
            onChange={(event) =>
              setPlanFilter(event.target.value as typeof planFilter)
            }
            aria-label="Lọc theo gói dịch vụ"
          >
            <option value="all">Tất cả gói</option>
            <option value="Plus">Gói Plus</option>
            <option value="Free">Gói Free</option>
          </select>
          <button
            type="button"
            className="admin-users-clear"
            onClick={() => {
              setQuery('')
              setPlanFilter('all')
              setActiveFilter('all')
            }}
          >
            Đặt lại bộ lọc
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="admin-users-bulk" role="status">
            <p>
              <strong>{selectedIds.length} tài khoản đã chọn</strong>
              <span>Chọn thao tác áp dụng cho các tài khoản này.</span>
            </p>
            <div>
              <button
                type="button"
                onClick={() => updateSelectedStatus('Hoạt động')}
              >
                Mở lại truy cập
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => updateSelectedStatus('Tạm khóa')}
              >
                Tạm khóa
              </button>
              <button type="button" onClick={() => setSelectedIds([])}>
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>
                  <label className="admin-users-check">
                    <input
                      type="checkbox"
                      checked={
                        visibleUsers.length > 0 &&
                        visibleUsers.every((user) =>
                          selectedIds.includes(user.id),
                        )
                      }
                      onChange={selectAll}
                      aria-label="Chọn tất cả tài khoản đang hiển thị"
                    />
                    <i />
                  </label>
                </th>
                <th>Người dùng</th>
                <th>Gói dịch vụ</th>
                <th>Ngày tham gia</th>
                <th>Hoạt động gần nhất</th>
                <th>Trạng thái</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr
                  key={user.id}
                  className={selectedIds.includes(user.id) ? 'selected' : ''}
                >
                  <td>
                    <label className="admin-users-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() =>
                          setSelectedIds((current) =>
                            current.includes(user.id)
                              ? current.filter((id) => id !== user.id)
                              : [...current, user.id],
                          )
                        }
                        aria-label={`Chọn tài khoản ${user.name}`}
                      />
                      <i />
                    </label>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-users-identity"
                      onClick={() => openUser(user)}
                    >
                      <span>
                        {user.initials}
                        <i />
                      </span>
                      <p>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                        <em>{user.id}</em>
                      </p>
                    </button>
                  </td>
                  <td>
                    <span
                      className={`admin-users-plan is-${user.plan.toLowerCase()}`}
                    >
                      {user.plan}
                    </span>
                  </td>
                  <td>
                    <strong className="admin-users-date">{user.joined}</strong>
                  </td>
                  <td>
                    <span className="admin-users-last-active">
                      {user.lastActive}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-users-status is-${user.status === 'Hoạt động' ? 'active' : user.status === 'Tạm khóa' ? 'locked' : 'pending'}`}
                    >
                      <i />
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-users-open"
                      onClick={() => openUser(user)}
                      aria-label={`Xem tài khoản ${user.name}`}
                    >
                      →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleUsers.length && (
            <div className="admin-users-empty">
              <span>⌕</span>
              <h2>Không tìm thấy tài khoản</h2>
              <p>Hãy thử từ khóa khác hoặc đặt lại bộ lọc hiện tại.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setPlanFilter('all')
                  setActiveFilter('all')
                }}
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </div>

        <footer className="admin-users-footer">
          <p>
            Hiển thị <strong>{visibleUsers.length}</strong> trong 12.480 tài
            khoản
          </p>
          <div>
            <button type="button" disabled aria-label="Trang trước">
              ←
            </button>
            <button type="button" className="active">
              1
            </button>
            <button type="button">2</button>
            <button type="button">3</button>
            <span>…</span>
            <button type="button">2080</button>
            <button type="button" aria-label="Trang tiếp theo">
              →
            </button>
          </div>
        </footer>
      </section>

      <aside className="admin-users-privacy">
        <i>◎</i>
        <p>
          <strong>Giới hạn truy cập dữ liệu</strong>
          <span>
            Quản trị viên chỉ được xem thông tin tài khoản và lịch sử thao tác
            quản trị. Nhật ký, kết quả đánh giá và nội dung phiên tư vấn không
            xuất hiện tại đây.
          </span>
        </p>
        <button
          type="button"
          onClick={() =>
            onNotice('Đã mở chính sách quyền riêng tư dành cho quản trị viên.')
          }
        >
          Xem chính sách →
        </button>
      </aside>
    </div>
  )
}
