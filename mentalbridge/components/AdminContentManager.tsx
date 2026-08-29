'use client'

import { useMemo, useState } from 'react'
import './admin-content-manager.css'

type ContentTab = 'resources' | 'hotlines'

type ContentItem = {
  id: string
  title: string
  meta: string
  status: 'Đã xuất bản' | 'Bản nháp' | 'Đang hoạt động' | 'Cần kiểm tra'
  icon: string
  description: string
  audience: string
  updated: string
}

const DATA: Record<ContentTab, ContentItem[]> = {
  resources: [
    { id: 'RS-018', title: 'Kỹ thuật thở 4–7–8', meta: 'Thở · 5 phút', status: 'Đã xuất bản', icon: '◌', description: 'Bài thực hành ngắn giúp người dùng điều hòa nhịp thở và làm dịu căng thẳng.', audience: 'Tất cả người dùng', updated: '26/08/2026 · 09:20' },
    { id: 'RS-024', title: 'Thư giãn cơ trước khi ngủ', meta: 'Giấc ngủ · 15 phút', status: 'Đã xuất bản', icon: '☾', description: 'Hướng dẫn thả lỏng từng nhóm cơ để chuẩn bị cho giấc ngủ.', audience: 'Người trưởng thành', updated: '24/08/2026 · 16:45' },
    { id: 'RS-031', title: 'Viết nhật ký biết ơn', meta: 'Nhật ký · 5 phút', status: 'Bản nháp', icon: '✎', description: 'Gợi ý ghi lại những trải nghiệm tích cực nhỏ trong ngày.', audience: 'Tất cả người dùng', updated: '22/08/2026 · 11:10' },
  ],
  hotlines: [
    { id: 'HL-001', title: 'Đường dây Ngày Mai', meta: '096 306 1414 · 24/7', status: 'Đang hoạt động', icon: '☎', description: 'Kênh hỗ trợ khẩn cấp được ưu tiên trong các luồng có dấu hiệu nguy cơ cao.', audience: 'Toàn quốc', updated: '27/08/2026 · 08:40' },
    { id: 'HL-004', title: 'Tư vấn sức khỏe tinh thần', meta: '0909 658 035 · 08:00–22:00', status: 'Đang hoạt động', icon: '＋', description: 'Kênh tư vấn và hướng dẫn tiếp cận hỗ trợ sức khỏe tinh thần.', audience: 'Toàn quốc', updated: '25/08/2026 · 14:15' },
    { id: 'HL-007', title: 'Hỗ trợ tại TP. Hồ Chí Minh', meta: 'Theo khu vực · Giờ hành chính', status: 'Cần kiểm tra', icon: '⌖', description: 'Danh sách đầu mối hỗ trợ tại địa phương đang chờ xác minh lại thông tin.', audience: 'TP. Hồ Chí Minh', updated: '20/08/2026 · 10:05' },
  ],
}

export default function AdminContentManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<ContentTab>('resources')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(DATA.resources[0].id)
  const [enabled, setEnabled] = useState(true)

  const items = DATA[tab]
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return keyword ? items.filter(item => `${item.title} ${item.meta} ${item.status}`.toLocaleLowerCase('vi').includes(keyword)) : items
  }, [items, query])
  const selected = items.find(item => item.id === selectedId) ?? items[0]

  const changeTab = (nextTab: ContentTab) => {
    setTab(nextTab)
    setSelectedId(DATA[nextTab][0].id)
    setQuery('')
    setEnabled(true)
  }

  return <div className="admin-content-manager">
    <div className="role-heading acm-heading">
      <div>
        <span className="eyebrow">Quản trị nền tảng</span>
        <h1>Tài nguyên &amp; đường dây hỗ trợ</h1>
        <p>Quản lý nội dung tự chăm sóc và thông tin hỗ trợ khẩn cấp.</p>
      </div>
      <button className="btn-primary" onClick={() => onNotice(tab === 'resources' ? 'Đã mở biểu mẫu tạo tài nguyên mới.' : 'Đã mở biểu mẫu thêm đường dây hỗ trợ.')}>+ {tab === 'resources' ? 'Thêm tài nguyên' : 'Thêm đường dây'}</button>
    </div>

    <section className="acm-overview" aria-label="Tổng quan nội dung">
      <article className="acm-overview-primary"><span>Nội dung đang hiển thị</span><strong>18</strong><p>15 tài nguyên · 3 đường dây</p></article>
      <article><span>Chờ xuất bản</span><strong>3</strong><p>Đã hoàn tất kiểm tra nội dung</p></article>
      <article><span>Cần xác minh</span><strong>1</strong><p>Thông tin liên hệ sắp đến hạn</p></article>
      <aside><i aria-hidden="true">✓</i><div><strong>Thông tin khẩn cấp đang ổn định</strong><small>Kiểm tra gần nhất lúc 08:40 hôm nay</small></div></aside>
    </section>

    <section className="acm-workspace">
      <nav className="acm-tabs" aria-label="Loại nội dung">
        <button className={tab === 'resources' ? 'active' : ''} onClick={() => changeTab('resources')}><span aria-hidden="true">▣</span><div><strong>Tài nguyên tự chăm sóc</strong><small>Bài tập và nội dung hướng dẫn</small></div><b>15</b></button>
        <button className={tab === 'hotlines' ? 'active' : ''} onClick={() => changeTab('hotlines')}><span aria-hidden="true">☎</span><div><strong>Đường dây hỗ trợ</strong><small>Kênh hỗ trợ và thông tin khẩn cấp</small></div><b>3</b></button>
      </nav>

      <div className="acm-body">
        <aside className="acm-library">
          <header><div><span>DANH SÁCH</span><h2>{tab === 'resources' ? 'Thư viện nội dung' : 'Kênh đang quản lý'}</h2></div><b>{filtered.length}</b></header>
          <label className="acm-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc trạng thái..." /></label>
          <div className="acm-items">
            {filtered.map(item => <button key={item.id} className={selected.id === item.id ? 'selected' : ''} onClick={() => { setSelectedId(item.id); setEnabled(item.status !== 'Bản nháp') }}>
              <span className="acm-item-icon" aria-hidden="true">{item.icon}</span>
              <span className="acm-item-copy"><strong>{item.title}</strong><small>{item.meta}</small><em>{item.id} · Cập nhật {item.updated.split(' · ')[0]}</em></span>
              <span className={`acm-status ${item.status === 'Cần kiểm tra' ? 'warning' : item.status === 'Bản nháp' ? 'draft' : ''}`}><i />{item.status}</span>
              <b aria-hidden="true">→</b>
            </button>)}
            {!filtered.length && <div className="acm-empty"><span>⌕</span><strong>Không tìm thấy nội dung</strong><small>Thử một từ khóa khác.</small></div>}
          </div>
        </aside>

        <article className="acm-editor">
          <header>
            <div><span>{tab === 'resources' ? 'CHI TIẾT TÀI NGUYÊN' : 'THÔNG TIN ĐƯỜNG DÂY'}</span><h2>{selected.title}</h2><p>{selected.id} · Cập nhật gần nhất {selected.updated}</p></div>
            <label className="acm-visibility"><span><strong>{enabled ? 'Đang hiển thị' : 'Đang ẩn'}</strong><small>{enabled ? 'Người dùng có thể truy cập' : 'Không hiển thị với người dùng'}</small></span><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><i /></label>
          </header>

          <div className="acm-editor-summary">
            <span><small>Trạng thái</small><strong>{selected.status}</strong></span>
            <span><small>{tab === 'resources' ? 'Danh mục & thời lượng' : 'Phạm vi phục vụ'}</small><strong>{tab === 'resources' ? selected.meta : selected.audience}</strong></span>
            <span><small>Lần kiểm tra tiếp theo</small><strong>{tab === 'resources' ? '05/09/2026' : '30/08/2026'}</strong></span>
          </div>

          <section className="acm-form">
            <header><span>01</span><div><h3>Thông tin hiển thị</h3><p>Nội dung người dùng nhìn thấy trên MentalBridge.</p></div></header>
            <div className="acm-form-grid">
              <label><span>Tiêu đề</span><input defaultValue={selected.title} key={`${selected.id}-title`} /></label>
              <label><span>{tab === 'resources' ? 'Danh mục' : 'Số điện thoại'}</span><input defaultValue={tab === 'resources' ? selected.meta.split(' · ')[0] : selected.meta.split(' · ')[0]} key={`${selected.id}-meta`} /></label>
              <label className="wide"><span>Mô tả ngắn</span><textarea defaultValue={selected.description} key={`${selected.id}-description`} rows={3} /></label>
            </div>
          </section>

          <section className="acm-safety">
            <header><span>02</span><div><h3>Kiểm tra an toàn</h3><p>Đảm bảo thông tin phù hợp trước khi công khai.</p></div></header>
            <div>
              <p><i>✓</i><span><strong>{tab === 'resources' ? 'Đã rà soát chuyên môn' : 'Đã gọi xác minh'}</strong><small>{tab === 'resources' ? 'Không chứa nội dung chẩn đoán hoặc thay thế điều trị.' : 'Đầu số và thời gian hoạt động đã được kiểm tra.'}</small></span></p>
              <p><i>✓</i><span><strong>Phạm vi hiển thị rõ ràng</strong><small>{selected.audience}</small></span></p>
              <p className={selected.status === 'Cần kiểm tra' ? 'attention' : ''}><i>{selected.status === 'Cần kiểm tra' ? '!' : '✓'}</i><span><strong>{selected.status === 'Cần kiểm tra' ? 'Cần xác minh lại' : 'Thông tin còn hiệu lực'}</strong><small>{selected.status === 'Cần kiểm tra' ? 'Không nên tiếp tục hiển thị nếu chưa xác minh.' : 'Không phát hiện vấn đề cần xử lý.'}</small></span></p>
            </div>
          </section>

          <aside className="acm-note"><i aria-hidden="true">i</i><p><strong>{tab === 'resources' ? 'Nội dung tự chăm sóc không thay thế điều trị.' : 'Đường dây hỗ trợ phải luôn có phương án dự phòng.'}</strong><span>{tab === 'resources' ? 'Mọi hướng dẫn cần dùng ngôn ngữ an toàn và tránh đưa ra kết luận lâm sàng.' : 'Nếu một kênh ngừng hoạt động, hãy ẩn ngay và cập nhật kênh thay thế.'}</span></p></aside>
          <footer><button onClick={() => onNotice('Đã lưu nội dung dưới dạng bản nháp.')}>Lưu bản nháp</button><button className="acm-save" onClick={() => onNotice('Đã lưu và cập nhật nội dung thành công.')}>Lưu &amp; cập nhật</button></footer>
        </article>
      </div>
    </section>
  </div>
}
