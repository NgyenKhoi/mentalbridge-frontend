'use client'

import { useMemo, useState } from 'react'

import './admin-content-manager.css'

type ContentItem = {
  id: string
  title: string
  meta: string
  status: 'Đã xuất bản' | 'Bản nháp'
  icon: string
  description: string
  audience: string
  updated: string
}

const resources: ContentItem[] = [
  {
    id: 'RS-018',
    title: 'Kỹ thuật thở 4–7–8',
    meta: 'Thở · 5 phút',
    status: 'Đã xuất bản',
    icon: '◌',
    description:
      'Bài thực hành ngắn giúp người dùng điều hòa nhịp thở và làm dịu căng thẳng.',
    audience: 'Tất cả người dùng',
    updated: '26/08/2026 · 09:20',
  },
  {
    id: 'RS-024',
    title: 'Thư giãn cơ trước khi ngủ',
    meta: 'Giấc ngủ · 15 phút',
    status: 'Đã xuất bản',
    icon: '☾',
    description: 'Hướng dẫn thả lỏng từng nhóm cơ để chuẩn bị cho giấc ngủ.',
    audience: 'Người trưởng thành',
    updated: '24/08/2026 · 16:45',
  },
  {
    id: 'RS-031',
    title: 'Viết nhật ký biết ơn',
    meta: 'Nhật ký · 5 phút',
    status: 'Bản nháp',
    icon: '✎',
    description: 'Gợi ý ghi lại những trải nghiệm tích cực nhỏ trong ngày.',
    audience: 'Tất cả người dùng',
    updated: '22/08/2026 · 11:10',
  },
]

export default function AdminContentManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(resources[0].id)
  const [enabled, setEnabled] = useState(true)
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return keyword
      ? resources.filter((item) =>
          `${item.title} ${item.meta} ${item.status}`
            .toLocaleLowerCase('vi')
            .includes(keyword),
        )
      : resources
  }, [query])
  const selected =
    resources.find((item) => item.id === selectedId) ?? resources[0]

  return (
    <div className="admin-content-manager">
      <div className="role-heading acm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Tài nguyên tự chăm sóc</h1>
          <p>Quản lý nội dung đã được rà soát trước khi công bố.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => onNotice('Đã mở biểu mẫu tạo tài nguyên mới.')}
        >
          + Thêm tài nguyên
        </button>
      </div>

      <section className="acm-overview" aria-label="Tổng quan nội dung">
        <article className="acm-overview-primary">
          <span>Nội dung đang hiển thị</span>
          <strong>15</strong>
          <p>Tài nguyên đã được công bố</p>
        </article>
        <article>
          <span>Chờ xuất bản</span>
          <strong>3</strong>
          <p>Đã hoàn tất kiểm tra nội dung</p>
        </article>
        <article>
          <span>Bản nháp</span>
          <strong>1</strong>
          <p>Chưa hiển thị với người dùng</p>
        </article>
        <aside>
          <i aria-hidden="true">✓</i>
          <div>
            <strong>Nội dung đang hoạt động ổn định</strong>
            <small>Chỉ hiển thị phiên bản đã được rà soát</small>
          </div>
        </aside>
      </section>

      <section className="acm-workspace">
        <nav className="acm-tabs" aria-label="Loại nội dung">
          <button className="active">
            <span aria-hidden="true">▣</span>
            <div>
              <strong>Tài nguyên tự chăm sóc</strong>
              <small>Bài tập và nội dung hướng dẫn</small>
            </div>
            <b>15</b>
          </button>
        </nav>

        <div className="acm-body">
          <aside className="acm-library">
            <header>
              <div>
                <span>DANH SÁCH</span>
                <h2>Thư viện nội dung</h2>
              </div>
              <b>{filtered.length}</b>
            </header>
            <label className="acm-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên hoặc trạng thái..."
              />
            </label>
            <div className="acm-items">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className={selected.id === item.id ? 'selected' : ''}
                  onClick={() => {
                    setSelectedId(item.id)
                    setEnabled(item.status !== 'Bản nháp')
                  }}
                >
                  <span className="acm-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="acm-item-copy">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    <em>
                      {item.id} · Cập nhật {item.updated.split(' · ')[0]}
                    </em>
                  </span>
                  <span
                    className={`acm-status ${item.status === 'Bản nháp' ? 'draft' : ''}`}
                  >
                    <i />
                    {item.status}
                  </span>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
          </aside>

          <article className="acm-editor">
            <header>
              <div>
                <span>CHI TIẾT TÀI NGUYÊN</span>
                <h2>{selected.title}</h2>
                <p>
                  {selected.id} · Cập nhật gần nhất {selected.updated}
                </p>
              </div>
              <label className="acm-visibility">
                <span>
                  <strong>{enabled ? 'Đang hiển thị' : 'Đang ẩn'}</strong>
                  <small>
                    {enabled
                      ? 'Người dùng có thể truy cập'
                      : 'Không hiển thị với người dùng'}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                <i />
              </label>
            </header>

            <div className="acm-editor-summary">
              <span>
                <small>Trạng thái</small>
                <strong>{selected.status}</strong>
              </span>
              <span>
                <small>Danh mục &amp; thời lượng</small>
                <strong>{selected.meta}</strong>
              </span>
              <span>
                <small>Lần kiểm tra tiếp theo</small>
                <strong>05/09/2026</strong>
              </span>
            </div>

            <section className="acm-form">
              <header>
                <span>01</span>
                <div>
                  <h3>Thông tin hiển thị</h3>
                  <p>Nội dung người dùng nhìn thấy trên MentalBridge.</p>
                </div>
              </header>
              <div className="acm-form-grid">
                <label>
                  <span>Tiêu đề</span>
                  <input
                    defaultValue={selected.title}
                    key={`${selected.id}-title`}
                  />
                </label>
                <label>
                  <span>Danh mục</span>
                  <input
                    defaultValue={selected.meta.split(' · ')[0]}
                    key={`${selected.id}-meta`}
                  />
                </label>
                <label className="wide">
                  <span>Mô tả ngắn</span>
                  <textarea
                    defaultValue={selected.description}
                    key={`${selected.id}-description`}
                    rows={3}
                  />
                </label>
              </div>
            </section>

            <section className="acm-safety">
              <header>
                <span>02</span>
                <div>
                  <h3>Kiểm tra an toàn</h3>
                  <p>Đảm bảo thông tin phù hợp trước khi công khai.</p>
                </div>
              </header>
              <div>
                <p>
                  <i>✓</i>
                  <span>
                    <strong>Đã rà soát chuyên môn</strong>
                    <small>
                      Không chứa nội dung chẩn đoán hoặc thay thế điều trị.
                    </small>
                  </span>
                </p>
                <p>
                  <i>✓</i>
                  <span>
                    <strong>Phạm vi hiển thị rõ ràng</strong>
                    <small>{selected.audience}</small>
                  </span>
                </p>
              </div>
            </section>

            <aside className="acm-note">
              <i aria-hidden="true">i</i>
              <p>
                <strong>Nội dung tự chăm sóc không thay thế điều trị.</strong>
                <span>
                  Mọi hướng dẫn cần dùng ngôn ngữ an toàn và tránh đưa ra kết
                  luận lâm sàng.
                </span>
              </p>
            </aside>
            <footer>
              <button
                onClick={() => onNotice('Đã lưu nội dung dưới dạng bản nháp.')}
              >
                Lưu bản nháp
              </button>
              <button
                className="acm-save"
                onClick={() =>
                  onNotice('Đã lưu và cập nhật nội dung thành công.')
                }
              >
                Lưu &amp; cập nhật
              </button>
            </footer>
          </article>
        </div>
      </section>
    </div>
  )
}
