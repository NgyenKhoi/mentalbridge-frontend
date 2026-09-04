'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import './specialist-earnings-manager.css'

type TabKey = 'overview' | 'transactions' | 'payouts'
type TransactionStatus = 'completed' | 'pending' | 'refunded'

type Transaction = {
  id: string
  date: string
  clientName: string
  sessionType: string
  duration: string
  amount: number
  status: TransactionStatus
}

const transactions: Transaction[] = [
  {
    id: 'MB-0826-041',
    date: '2026-08-26',
    clientName: 'Nguyễn Minh Anh',
    sessionType: 'Video call',
    duration: '45 phút',
    amount: 400000,
    status: 'completed',
  },
  {
    id: 'MB-0826-039',
    date: '2026-08-26',
    clientName: 'Phạm Thảo Vy',
    sessionType: 'Video call',
    duration: '45 phút',
    amount: 400000,
    status: 'completed',
  },
  {
    id: 'MB-0825-034',
    date: '2026-08-25',
    clientName: 'Lê Hoàng Nam',
    sessionType: 'Tại phòng tư vấn',
    duration: '60 phút',
    amount: 500000,
    status: 'completed',
  },
  {
    id: 'MB-0824-028',
    date: '2026-08-24',
    clientName: 'Trần Gia Hân',
    sessionType: 'Video call',
    duration: '45 phút',
    amount: 400000,
    status: 'completed',
  },
  {
    id: 'MB-0823-022',
    date: '2026-08-23',
    clientName: 'Nguyễn Thu Hương',
    sessionType: 'Video call',
    duration: '45 phút',
    amount: 400000,
    status: 'pending',
  },
  {
    id: 'MB-0821-017',
    date: '2026-08-21',
    clientName: 'Võ Bảo Ngọc',
    sessionType: 'Tại phòng tư vấn',
    duration: '60 phút',
    amount: 500000,
    status: 'completed',
  },
]

const chartData = [
  { label: '20/08', value: 800000 },
  { label: '21/08', value: 1300000 },
  { label: '22/08', value: 400000 },
  { label: '23/08', value: 900000 },
  { label: '24/08', value: 1200000 },
  { label: '25/08', value: 1500000 },
  { label: '26/08', value: 2100000 },
]

const payouts = [
  {
    id: 'PO-0826-2014',
    period: '01–15/08/2026',
    amount: 8400000,
    sessions: 21,
    status: 'available',
    date: 'Dự kiến 29/08/2026',
  },
  {
    id: 'PO-0726-1842',
    period: '16–31/07/2026',
    amount: 6800000,
    sessions: 17,
    status: 'paid',
    date: '02/08/2026',
  },
  {
    id: 'PO-0706-2184',
    period: '01–15/07/2026',
    amount: 7200000,
    sessions: 18,
    status: 'paid',
    date: '18/07/2026',
  },
] as const

const statusLabel: Record<TransactionStatus, string> = {
  completed: 'Đã ghi nhận',
  pending: 'Chờ đối soát',
  refunded: 'Đã hoàn tiền',
}

function Icon({
  name,
}: {
  name:
    | 'wallet'
    | 'trend'
    | 'clock'
    | 'calendar'
    | 'bank'
    | 'download'
    | 'search'
    | 'check'
}) {
  const paths = {
    wallet: (
      <>
        <path d="M4 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3h12v5" />
        <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    trend: (
      <>
        <path d="m3 17 6-6 4 4 8-9" />
        <path d="M15 6h6v6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    bank: (
      <>
        <path d="m3 9 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function SpecialistEarningsManager() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [period, setPeriod] = useState('7-days')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('8400000')
  const [confirmed, setConfirmed] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const text =
          `${transaction.clientName} ${transaction.id} ${transaction.sessionType}`.toLocaleLowerCase(
            'vi',
          )
        return (
          text.includes(query.toLocaleLowerCase('vi').trim()) &&
          (status === 'all' || transaction.status === status)
        )
      }),
    [query, status],
  )

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  const openWithdrawal = () => {
    setActiveTab('payouts')
    setWithdrawOpen(true)
    setFormError('')
  }

  const submitWithdrawal = () => {
    const amount = Number(withdrawAmount)
    if (!amount || amount < 500000 || amount > 8400000) {
      setFormError('Số tiền cần từ 500.000 ₫ đến 8.400.000 ₫.')
      return
    }
    if (!confirmed) {
      setFormError('Vui lòng xác nhận thông tin tài khoản nhận tiền.')
      return
    }
    setWithdrawOpen(false)
    showToast('Đã gửi yêu cầu rút tiền. Hệ thống đang xử lý đối soát.')
  }

  return (
    <div className="earnings-manager">
      <header className="earnings-header">
        <div>
          <span className="earnings-eyebrow">Không gian chuyên gia</span>
          <h1>Thu nhập & thanh toán</h1>
          <p>
            Theo dõi doanh thu tư vấn, trạng thái đối soát và các kỳ chuyển tiền
            của bạn.
          </p>
        </div>
        <div className="earnings-header-actions">
          <span>
            <i /> Dữ liệu cập nhật 09:15 hôm nay
          </span>
          <button
            type="button"
            onClick={() =>
              showToast(
                'Báo cáo tài chính đã sẵn sàng để kết nối chức năng xuất dữ liệu.',
              )
            }
          >
            <Icon name="download" /> Xuất báo cáo
          </button>
        </div>
      </header>

      <section className="earnings-summary" aria-label="Tổng quan thu nhập">
        <motion.article
          className="earnings-balance"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="earnings-balance-top">
            <span className="earnings-balance-icon">
              <Icon name="wallet" />
            </span>
            <span className="earnings-verified">
              <Icon name="check" /> Đã đối soát
            </span>
          </div>
          <p>Số dư có thể rút</p>
          <strong>{formatCurrency(8400000)}</strong>
          <small>21 phiên tư vấn đã hoàn tất đối soát</small>
          <button
            type="button"
            className="earnings-withdraw-cta btn-primary"
            onClick={openWithdrawal}
          >
            Yêu cầu rút tiền <span>→</span>
          </button>
        </motion.article>

        <div className="earnings-metrics">
          <article>
            <span className="earnings-metric-icon">
              <Icon name="trend" />
            </span>
            <div>
              <small>Doanh thu tháng 8</small>
              <strong>{formatCurrency(10500000)}</strong>
              <p>
                <b>↑ 12,4%</b> so với tháng 7
              </p>
            </div>
          </article>
          <article>
            <span className="earnings-metric-icon">
              <Icon name="clock" />
            </span>
            <div>
              <small>Đang chờ đối soát</small>
              <strong>{formatCurrency(2100000)}</strong>
              <p>5 phiên · khả dụng sau 48 giờ</p>
            </div>
          </article>
          <article>
            <span className="earnings-metric-icon">
              <Icon name="calendar" />
            </span>
            <div>
              <small>Phiên hoàn thành</small>
              <strong>
                25 <em>phiên</em>
              </strong>
              <p>Trung bình {formatCurrency(420000)} / phiên</p>
            </div>
          </article>
        </div>

        <aside className="earnings-settlement">
          <span>Kỳ thanh toán tiếp theo</span>
          <strong>29 tháng 8</strong>
          <p>
            Chuyển về Vietcombank
            <br />
            •••• 2846
          </p>
          <div>
            <span>Ước tính nhận</span>
            <b>{formatCurrency(8400000)}</b>
          </div>
          <button type="button" onClick={() => setActiveTab('payouts')}>
            Xem lịch thanh toán →
          </button>
        </aside>
      </section>

      <nav className="earnings-tabs" aria-label="Nội dung tài chính">
        {(
          [
            ['overview', 'Tổng quan'],
            ['transactions', 'Giao dịch'],
            ['payouts', 'Rút tiền & đối soát'],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={activeTab === key ? 'active' : ''}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {key === 'transactions' && <span>{transactions.length}</span>}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="earnings-overview">
          <section className="earnings-panel earnings-chart-panel">
            <header className="earnings-panel-header">
              <div>
                <span>Xu hướng doanh thu</span>
                <h2>Thu nhập theo ngày</h2>
                <p>
                  Doanh thu đã ghi nhận, chưa trừ các khoản hoàn tiền phát sinh.
                </p>
              </div>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Khoảng thời gian"
              >
                <option value="7-days">7 ngày qua</option>
                <option value="month">Tháng này</option>
                <option value="3-months">3 tháng qua</option>
              </select>
            </header>
            <div className="earnings-chart">
              <div className="earnings-y-axis">
                <span>2 triệu</span>
                <span>1 triệu</span>
                <span>0</span>
              </div>
              <div className="earnings-plot">
                <div className="earnings-grid-lines">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="earnings-bars">
                  {chartData.map((item, index) => (
                    <div
                      className={`earnings-bar ${index === chartData.length - 1 ? 'is-current' : ''}`}
                      key={item.label}
                    >
                      <span>
                        {formatCurrency(item.value).replace('₫', '').trim()}
                      </span>
                      <i
                        style={{
                          height: `${Math.max(16, item.value / 21000)}%`,
                        }}
                      />
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="earnings-insights">
            <header>
              <span>Đối soát tháng 8</span>
              <strong>Tiền của bạn được tính thế nào?</strong>
            </header>
            <dl>
              <div>
                <dt>Tổng phí tư vấn</dt>
                <dd>{formatCurrency(9240000)}</dd>
              </div>
              <div>
                <dt>Phí nền tảng (9,1%)</dt>
                <dd>− {formatCurrency(840000)}</dd>
              </div>
              <div className="is-total">
                <dt>Số dư thực nhận</dt>
                <dd>{formatCurrency(8400000)}</dd>
              </div>
            </dl>
            <p>
              <span>i</span>Mỗi phiên được đối soát sau khi hoàn thành. Các
              khoản hoàn tiền sẽ hiển thị riêng trong giao dịch.
            </p>
          </aside>

          <section className="earnings-panel earnings-recent">
            <header className="earnings-panel-header">
              <div>
                <span>Hoạt động gần đây</span>
                <h2>Giao dịch mới nhất</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
              >
                Xem tất cả <span>→</span>
              </button>
            </header>
            <div>
              {transactions.slice(0, 4).map((transaction, index) => (
                <motion.article
                  key={transaction.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <span className="earnings-avatar">
                    {transaction.clientName
                      .split(' ')
                      .slice(-2)
                      .map((name) => name[0])
                      .join('')}
                  </span>
                  <div className="earnings-transaction-copy">
                    <strong>{transaction.clientName}</strong>
                    <p>
                      {transaction.sessionType} · {transaction.duration}
                    </p>
                  </div>
                  <time>{formatDate(transaction.date)}</time>
                  <span className={`earnings-status is-${transaction.status}`}>
                    {statusLabel[transaction.status]}
                  </span>
                  <b>{formatCurrency(transaction.amount)}</b>
                  <button
                    type="button"
                    aria-label={`Xem giao dịch ${transaction.id}`}
                    onClick={() =>
                      showToast(
                        `Chi tiết ${transaction.id} đã sẵn sàng để kết nối API.`,
                      )
                    }
                  >
                    →
                  </button>
                </motion.article>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'transactions' && (
        <section className="earnings-panel earnings-transaction-panel">
          <header className="earnings-panel-header">
            <div>
              <span>Sổ giao dịch</span>
              <h2>Tất cả khoản thu</h2>
              <p>
                Theo dõi từng phiên tư vấn và trạng thái đối soát tương ứng.
              </p>
            </div>
            <div className="earnings-table-actions">
              <label>
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm khách hàng hoặc mã GD..."
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Lọc trạng thái"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Đã ghi nhận</option>
                <option value="pending">Chờ đối soát</option>
                <option value="refunded">Đã hoàn tiền</option>
              </select>
            </div>
          </header>
          <div className="earnings-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Giao dịch</th>
                  <th>Khách hàng</th>
                  <th>Phiên tư vấn</th>
                  <th>Trạng thái</th>
                  <th>Số tiền</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <strong>{transaction.id}</strong>
                      <small>{formatDate(transaction.date)}</small>
                    </td>
                    <td>{transaction.clientName}</td>
                    <td>
                      <strong>{transaction.sessionType}</strong>
                      <small>{transaction.duration}</small>
                    </td>
                    <td>
                      <span
                        className={`earnings-status is-${transaction.status}`}
                      >
                        {statusLabel[transaction.status]}
                      </span>
                    </td>
                    <td className="earnings-amount">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          showToast(
                            `Chi tiết ${transaction.id} đã sẵn sàng để kết nối API.`,
                          )
                        }
                        aria-label={`Xem ${transaction.id}`}
                      >
                        →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredTransactions.length && (
              <div className="earnings-empty">
                <span>⌕</span>
                <h3>Không có giao dịch phù hợp</h3>
                <p>Hãy thử thay đổi từ khóa hoặc trạng thái đang lọc.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'payouts' && (
        <div className="earnings-payout-layout">
          <section className="earnings-panel earnings-payout-list">
            <header className="earnings-panel-header">
              <div>
                <span>Lịch sử đối soát</span>
                <h2>Các kỳ thanh toán</h2>
                <p>Kiểm tra số tiền, số phiên và mã giao dịch ngân hàng.</p>
              </div>
            </header>
            <div>
              {payouts.map((payout) => (
                <article
                  key={payout.id}
                  className={
                    payout.status === 'available' ? 'is-available' : ''
                  }
                >
                  <span className="earnings-payout-icon">
                    <Icon
                      name={payout.status === 'available' ? 'wallet' : 'check'}
                    />
                  </span>
                  <div>
                    <small>Kỳ {payout.period}</small>
                    <strong>{formatCurrency(payout.amount)}</strong>
                    <p>
                      {payout.sessions} phiên · {payout.id}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`earnings-payout-badge is-${payout.status}`}
                    >
                      {payout.status === 'available'
                        ? 'Có thể rút'
                        : 'Đã thanh toán'}
                    </span>
                    <time>{payout.date}</time>
                  </div>
                  {payout.status === 'available' ? (
                    <button type="button" onClick={() => setWithdrawOpen(true)}>
                      Rút tiền
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="is-secondary"
                      onClick={() =>
                        showToast(
                          `Biên nhận ${payout.id} đã sẵn sàng để kết nối tải xuống.`,
                        )
                      }
                    >
                      Biên nhận
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          <aside className="earnings-bank">
            <span className="earnings-bank-icon">
              <Icon name="bank" />
            </span>
            <small>TÀI KHOẢN NHẬN TIỀN</small>
            <h2>Vietcombank</h2>
            <strong>•••• •••• •••• 2846</strong>
            <p>NGUYEN THU HA</p>
            <span className="earnings-bank-verified">
              <Icon name="check" /> Đã xác minh
            </span>
            <button
              type="button"
              onClick={() =>
                showToast(
                  'Chức năng cập nhật tài khoản ngân hàng sẽ yêu cầu xác minh danh tính.',
                )
              }
            >
              Cập nhật tài khoản
            </button>
            <div>
              <span>Chu kỳ đối soát</span>
              <b>Hai lần mỗi tháng</b>
            </div>
            <div>
              <span>Thời gian xử lý</span>
              <b>1–3 ngày làm việc</b>
            </div>
          </aside>
        </div>
      )}

      {withdrawOpen && (
        <div className="earnings-modal-layer">
          <button
            className="earnings-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setWithdrawOpen(false)}
          />
          <section
            className="earnings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
          >
            <header>
              <div>
                <span>Yêu cầu thanh toán</span>
                <h2 id="withdraw-title">Rút thu nhập khả dụng</h2>
                <p>Kiểm tra số tiền và tài khoản nhận trước khi gửi yêu cầu.</p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                aria-label="Đóng"
              >
                ×
              </button>
            </header>
            <div className="earnings-modal-body">
              <div className="earnings-modal-balance">
                <span>Số dư có thể rút</span>
                <strong>{formatCurrency(8400000)}</strong>
                <small>Không có phí rút tiền</small>
              </div>
              <label>
                <span>Số tiền muốn rút</span>
                <div>
                  <input
                    type="number"
                    min="500000"
                    max="8400000"
                    step="100000"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                  />
                  <b>₫</b>
                </div>
                <small>Tối thiểu 500.000 ₫</small>
              </label>
              <section>
                <Icon name="bank" />
                <div>
                  <small>Chuyển đến</small>
                  <strong>Vietcombank · •••• 2846</strong>
                  <span>Chủ tài khoản: NGUYEN THU HA</span>
                </div>
                <b>Đã xác minh</b>
              </section>
              <label className="earnings-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  <i>
                    <Icon name="check" />
                  </i>
                  <strong>Tôi xác nhận thông tin nhận tiền là chính xác</strong>
                  <small>
                    Yêu cầu đã gửi không thể tự hủy sau khi bắt đầu xử lý.
                  </small>
                </span>
              </label>
              {formError && (
                <p className="earnings-form-error" role="alert">
                  {formError}
                </p>
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setWithdrawOpen(false)}>
                Quay lại
              </button>
              <button type="button" onClick={submitWithdrawal}>
                Gửi yêu cầu <span>→</span>
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="earnings-toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
    </div>
  )
}
