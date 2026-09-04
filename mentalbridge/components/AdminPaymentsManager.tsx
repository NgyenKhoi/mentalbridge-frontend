'use client'

import { useMemo, useState } from 'react'
import './admin-payments-manager.css'

type PaymentTab = 'overview' | 'subscriptions' | 'transactions'

const PLANS = [
  {
    name: 'MentalBridge Free',
    users: '9.168',
    share: 73,
    price: '0đ',
    status: 'Đang cung cấp',
    tone: 'free',
    features: 'Nhật ký, đánh giá cơ bản, tài nguyên giới hạn',
  },
  {
    name: 'MentalBridge Plus',
    users: '2.842',
    share: 23,
    price: '199.000đ / tháng',
    status: 'Đang cung cấp',
    tone: 'plus',
    features: 'Phân tích nâng cao, tài nguyên đầy đủ, AI hỗ trợ',
  },
  {
    name: 'Gói 3 tháng',
    users: '470',
    share: 4,
    price: '749.000đ / kỳ',
    status: 'Đang cung cấp',
    tone: 'quarter',
    features: 'Toàn bộ quyền lợi Plus trong 3 tháng',
  },
]

const TRANSACTIONS = [
  {
    id: 'PAY-260827-1284',
    user: 'Nguyễn Minh Anh',
    plan: 'MentalBridge Plus',
    amount: '199.000đ',
    method: 'MoMo',
    time: '27/08/2026 · 09:12',
    status: 'Thành công',
  },
  {
    id: 'PAY-260827-1279',
    user: 'Phạm Thảo Vy',
    plan: 'Gói 3 tháng',
    amount: '749.000đ',
    method: 'PayOS',
    time: '27/08/2026 · 08:46',
    status: 'Thành công',
  },
  {
    id: 'PAY-260827-1261',
    user: 'Trần Gia Hân',
    plan: 'MentalBridge Plus',
    amount: '199.000đ',
    method: 'VNPay',
    time: '27/08/2026 · 07:58',
    status: 'Thất bại',
  },
  {
    id: 'PAY-260826-1248',
    user: 'Lê Hoàng Nam',
    plan: 'MentalBridge Plus',
    amount: '199.000đ',
    method: 'MoMo',
    time: '26/08/2026 · 21:35',
    status: 'Đang xử lý',
  },
  {
    id: 'PAY-260826-1234',
    user: 'Nguyễn Thu Hương',
    plan: 'MentalBridge Plus',
    amount: '199.000đ',
    method: 'PayOS',
    time: '26/08/2026 · 18:20',
    status: 'Hoàn tiền',
  },
]

export default function AdminPaymentsManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const [tab, setTab] = useState<PaymentTab>('overview')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tất cả')
  const filteredTransactions = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return TRANSACTIONS.filter(
      (item) =>
        (status === 'Tất cả' || item.status === status) &&
        (!keyword ||
          `${item.id} ${item.user} ${item.plan} ${item.method}`
            .toLocaleLowerCase('vi')
            .includes(keyword)),
    )
  }, [query, status])

  return (
    <div className="admin-payments-manager">
      <div className="role-heading apm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Subscriptions &amp; Payments</h1>
          <p>Giám sát gói dịch vụ và giao dịch, không chỉnh sửa payment.</p>
        </div>
        <div className="apm-heading-actions">
          <span>
            <i />
            Đối soát gần nhất 09:10 hôm nay
          </span>
          <button
            className="btn-primary"
            onClick={() => onNotice('Đã bắt đầu xuất báo cáo giao dịch.')}
          >
            ↓ Xuất báo cáo
          </button>
        </div>
      </div>

      <section className="apm-metrics" aria-label="Tổng quan thanh toán">
        <article className="primary">
          <span>Doanh thu tháng 8</span>
          <strong>486,2 triệu</strong>
          <p>
            <b>↑ 12,1%</b> so với tháng trước
          </p>
        </article>
        <article>
          <span>Thuê bao đang hoạt động</span>
          <strong>3.312</strong>
          <p>26,5% tổng tài khoản</p>
        </article>
        <article>
          <span>Giá trị trung bình</span>
          <strong>213.600đ</strong>
          <p>Trên mỗi giao dịch thành công</p>
        </article>
        <article className="attention">
          <span>Giao dịch cần xử lý</span>
          <strong>8</strong>
          <p>3 thất bại · 5 đang chờ</p>
        </article>
      </section>

      <nav className="apm-tabs" aria-label="Quản lý subscription và thanh toán">
        <button
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          <span>⌁</span>
          <div>
            <strong>Tổng quan</strong>
            <small>Doanh thu và tín hiệu</small>
          </div>
        </button>
        <button
          className={tab === 'subscriptions' ? 'active' : ''}
          onClick={() => setTab('subscriptions')}
        >
          <span>▤</span>
          <div>
            <strong>Subscriptions</strong>
            <small>Gói dịch vụ và thuê bao</small>
          </div>
          <b>3</b>
        </button>
        <button
          className={tab === 'transactions' ? 'active' : ''}
          onClick={() => setTab('transactions')}
        >
          <span>↔</span>
          <div>
            <strong>Payments</strong>
            <small>Giao dịch và trạng thái</small>
          </div>
          <b>{TRANSACTIONS.length}</b>
        </button>
      </nav>

      {tab === 'overview' && (
        <section className="apm-overview">
          <article className="apm-revenue">
            <header>
              <div>
                <span>XU HƯỚNG DOANH THU</span>
                <h2>Doanh thu được ghi nhận</h2>
                <p>Chỉ bao gồm giao dịch đã được cổng thanh toán xác nhận.</p>
              </div>
              <select aria-label="Khoảng thời gian" defaultValue="30 ngày">
                <option>7 ngày</option>
                <option>30 ngày</option>
                <option>Quý III</option>
              </select>
            </header>
            <div className="apm-chart">
              <div className="apm-axis">
                <span>80 tr</span>
                <span>60 tr</span>
                <span>40 tr</span>
                <span>20 tr</span>
                <span>0</span>
              </div>
              <div className="apm-bars">
                {[48, 63, 55, 72, 61, 78, 86].map((value, index) => (
                  <div key={index}>
                    <span
                      style={{ '--bar': `${value}%` } as React.CSSProperties}
                    >
                      <i>{value - 18} tr</i>
                    </span>
                    <small>
                      {
                        [
                          '21/08',
                          '22/08',
                          '23/08',
                          '24/08',
                          '25/08',
                          '26/08',
                          '27/08',
                        ][index]
                      }
                    </small>
                  </div>
                ))}
              </div>
            </div>
            <footer>
              <span>
                <i />
                Doanh thu ghi nhận
              </span>
              <strong>Tổng 486.200.000đ</strong>
            </footer>
          </article>

          <aside className="apm-reconcile">
            <header>
              <span>ĐỐI SOÁT HÔM NAY</span>
              <h2>Dòng tiền hệ thống</h2>
            </header>
            <div>
              <p>
                <span>Đã ghi nhận</span>
                <strong>18.420.000đ</strong>
              </p>
              <p>
                <span>Đang chờ xác nhận</span>
                <strong>2.140.000đ</strong>
              </p>
              <p>
                <span>Hoàn tiền</span>
                <strong className="negative">− 398.000đ</strong>
              </p>
            </div>
            <section>
              <i>✓</i>
              <p>
                <strong>Chênh lệch bằng 0đ</strong>
                <small>
                  Số liệu MentalBridge khớp với cổng thanh toán lúc 09:10.
                </small>
              </p>
            </section>
            <button onClick={() => setTab('transactions')}>
              Xem giao dịch hôm nay <span>→</span>
            </button>
          </aside>

          <section className="apm-plan-distribution">
            <header>
              <div>
                <span>PHÂN BỔ GÓI DỊCH VỤ</span>
                <h2>12.480 tài khoản</h2>
              </div>
              <small>Cập nhật theo thời gian thực</small>
            </header>
            <div className="apm-plan-bar">
              <i className="free" />
              <i className="plus" />
              <i className="quarter" />
            </div>
            <div className="apm-plan-legend">
              {PLANS.map((plan) => (
                <p key={plan.name}>
                  <i className={plan.tone} />
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{plan.users} người dùng</small>
                  </span>
                  <b>{plan.share}%</b>
                </p>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === 'subscriptions' && (
        <section className="apm-subscriptions">
          <header>
            <div>
              <span>GÓI DỊCH VỤ</span>
              <h2>Cấu hình subscription</h2>
              <p>
                Theo dõi gói đang cung cấp; thay đổi giá cần quy trình phê duyệt
                riêng.
              </p>
            </div>
            <button
              onClick={() => onNotice('Đã mở lịch sử thay đổi gói dịch vụ.')}
            >
              Xem lịch sử thay đổi
            </button>
          </header>
          <div className="apm-plan-list">
            {PLANS.map((plan, index) => (
              <article
                key={plan.name}
                className={index === 1 ? 'featured' : ''}
              >
                <header>
                  <span className={`apm-plan-symbol ${plan.tone}`}>
                    {index === 0 ? '○' : index === 1 ? '✦' : '◇'}
                  </span>
                  <b>
                    <i />
                    {plan.status}
                  </b>
                </header>
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <p>{plan.features}</p>
                <div>
                  <span>
                    <small>Đang sử dụng</small>
                    <b>{plan.users}</b>
                  </span>
                  <span>
                    <small>Tỷ trọng</small>
                    <b>{plan.share}%</b>
                  </span>
                </div>
                <footer>
                  <button
                    onClick={() => onNotice(`Đã mở chi tiết ${plan.name}.`)}
                  >
                    Xem cấu hình <span>→</span>
                  </button>
                </footer>
              </article>
            ))}
          </div>
          <aside>
            <i>i</i>
            <p>
              <strong>
                Không chỉnh sửa trực tiếp thuê bao hoặc giao dịch đã ghi nhận.
              </strong>
              <span>
                Mọi thay đổi gói chỉ áp dụng cho kỳ thanh toán tiếp theo và phải
                lưu lịch sử kiểm toán.
              </span>
            </p>
          </aside>
        </section>
      )}

      {tab === 'transactions' && (
        <section className="apm-transactions">
          <header>
            <div>
              <span>PAYMENTS</span>
              <h2>Giao dịch gần đây</h2>
              <p>Tra cứu trạng thái được đồng bộ từ cổng thanh toán.</p>
            </div>
            <div className="apm-filters">
              <label>
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Mã giao dịch hoặc người dùng..."
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option>Tất cả</option>
                <option>Thành công</option>
                <option>Đang xử lý</option>
                <option>Thất bại</option>
                <option>Hoàn tiền</option>
              </select>
            </div>
          </header>
          <div className="apm-table-head">
            <span>Giao dịch</span>
            <span>Gói dịch vụ</span>
            <span>Phương thức</span>
            <span>Trạng thái</span>
            <span>Số tiền</span>
            <span />
          </div>
          <div className="apm-transaction-list">
            {filteredTransactions.map((item, index) => (
              <article key={item.id}>
                <span className={`apm-user-mark tone-${index}`}>
                  {item.user
                    .split(' ')
                    .slice(-2)
                    .map((word) => word[0])
                    .join('')}
                </span>
                <div>
                  <strong>{item.user}</strong>
                  <small>{item.id}</small>
                  <em>{item.time}</em>
                </div>
                <span>{item.plan}</span>
                <span>{item.method}</span>
                <b
                  className={item.status
                    .toLocaleLowerCase('vi')
                    .replaceAll(' ', '-')}
                >
                  <i />
                  {item.status}
                </b>
                <strong>{item.amount}</strong>
                <button
                  onClick={() => onNotice(`Đã mở chi tiết ${item.id}.`)}
                  aria-label={`Xem ${item.id}`}
                >
                  →
                </button>
              </article>
            ))}
          </div>
          {!filteredTransactions.length && (
            <div className="apm-empty">
              <span>⌕</span>
              <strong>Không tìm thấy giao dịch</strong>
              <small>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</small>
            </div>
          )}
          <footer>
            <p>
              <i>i</i>
              <span>
                <strong>
                  Dữ liệu thanh toán chỉ dùng cho vận hành và đối soát.
                </strong>
                <small>
                  Không hiển thị đầy đủ thông tin thẻ hoặc tài khoản thanh toán.
                </small>
              </span>
            </p>
            <button onClick={() => onNotice('Đã tải thêm giao dịch.')}>
              Tải thêm giao dịch
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
