'use client'

import { useMemo, useState } from 'react'
import './admin-moderation-manager.css'

type ModerationType = 'all' | 'review' | 'message'

type ModerationCase = {
  id: string
  type: 'Review' | 'Tin nhắn'
  reason: string
  subject: string
  reported: string
  priority: 'Ưu tiên cao' | 'Thông thường'
  status: 'Chờ xem xét' | 'Đã ẩn tạm thời'
  excerpt: string
  context: string
}

const CASES: ModerationCase[] = [
  { id: 'RV-2841', type: 'Review', reason: 'Nội dung không phù hợp', subject: 'Đánh giá chuyên gia #SP-0184', reported: '12 phút trước', priority: 'Ưu tiên cao', status: 'Chờ xem xét', excerpt: '“…không lắng nghe và đưa ra nhận xét khiến tôi cảm thấy không an toàn…”', context: 'Đánh giá 1/5 sao · Người báo cáo chọn lý do nội dung gây tổn thương.' },
  { id: 'MSG-9812', type: 'Tin nhắn', reason: 'Ngôn từ gây tổn thương', subject: 'Cuộc trò chuyện #CN-2048', reported: '38 phút trước', priority: 'Ưu tiên cao', status: 'Đã ẩn tạm thời', excerpt: '“…bạn đang suy nghĩ quá nhiều, hãy tự kiểm soát cảm xúc của mình…”', context: 'Tin nhắn từ chuyên gia · Đã ẩn khỏi cuộc trò chuyện trong khi xem xét.' },
  { id: 'RV-2836', type: 'Review', reason: 'Thông tin sai lệch', subject: 'Đánh giá chuyên gia #SP-0129', reported: '2 giờ trước', priority: 'Thông thường', status: 'Chờ xem xét', excerpt: '“…chuyên gia này không có chứng chỉ hành nghề hợp lệ…”', context: 'Đánh giá 2/5 sao · Hồ sơ chuyên gia hiện có trạng thái đã xác minh.' },
  { id: 'MSG-9798', type: 'Tin nhắn', reason: 'Quảng cáo ngoài nền tảng', subject: 'Cuộc trò chuyện #CN-1972', reported: 'Hôm qua · 21:14', priority: 'Thông thường', status: 'Chờ xem xét', excerpt: '“…hãy liên hệ với tôi qua kênh cá nhân để được tư vấn thêm…”', context: 'Tin nhắn từ chuyên gia · Người dùng chủ động gửi báo cáo.' },
]

export default function AdminModerationManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [type, setType] = useState<ModerationType>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(CASES[0].id)
  const [note, setNote] = useState('')
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return CASES.filter(item => (type === 'all' || (type === 'review' ? item.type === 'Review' : item.type === 'Tin nhắn')) && (!keyword || `${item.id} ${item.reason} ${item.subject}`.toLocaleLowerCase('vi').includes(keyword)))
  }, [query, type])
  const selected = CASES.find(item => item.id === selectedId) ?? CASES[0]

  return <div className="admin-moderation-manager">
    <div className="role-heading amo-heading">
      <div><span className="eyebrow">Quản trị nền tảng</span><h1>Kiểm duyệt báo cáo</h1><p>Xem đủ ngữ cảnh cần thiết, tránh phơi bày dữ liệu ngoài phạm vi.</p></div>
      <div className="amo-heading-status"><i />Hàng đợi đang được xử lý bình thường</div>
    </div>

    <section className="amo-metrics" aria-label="Tổng quan kiểm duyệt">
      <article className="primary"><span>Đang chờ xem xét</span><strong>34</strong><p>5 báo cáo được ưu tiên</p></article>
      <article><span>Đã xử lý hôm nay</span><strong>18</strong><p>Thời gian trung bình 11 phút</p></article>
      <article><span>Đang ẩn tạm thời</span><strong>6</strong><p>Chờ quyết định cuối cùng</p></article>
      <article><span>Tỷ lệ đúng hạn</span><strong>96,8%</strong><p>Trong mục tiêu phản hồi 24 giờ</p></article>
    </section>

    <nav className="amo-tabs" aria-label="Loại báo cáo">
      <button className={type === 'all' ? 'active' : ''} onClick={() => setType('all')}><span>◉</span><div><strong>Tất cả báo cáo</strong><small>Review và tin nhắn</small></div><b>34</b></button>
      <button className={type === 'review' ? 'active' : ''} onClick={() => setType('review')}><span>☆</span><div><strong>Reviews</strong><small>Đánh giá bị báo cáo</small></div><b>21</b></button>
      <button className={type === 'message' ? 'active' : ''} onClick={() => setType('message')}><span>◇</span><div><strong>Messages</strong><small>Tin nhắn bị báo cáo</small></div><b>13</b></button>
    </nav>

    <section className="amo-workspace">
      <aside className="amo-queue">
        <header><div><span>HÀNG ĐỢI</span><h2>Báo cáo cần xem</h2></div><b>{filtered.length}</b></header>
        <label className="amo-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã báo cáo hoặc lý do..." /></label>
        <div className="amo-case-list">{filtered.map(item => <button key={item.id} className={selected.id === item.id ? 'selected' : ''} onClick={() => { setSelectedId(item.id); setNote('') }}>
          <span className={`amo-case-icon ${item.type === 'Tin nhắn' ? 'message' : ''}`}>{item.type === 'Review' ? '☆' : '◇'}</span>
          <span className="amo-case-copy"><strong>{item.reason}</strong><small>{item.subject}</small><em>{item.id} · {item.reported}</em></span>
          <span className={`amo-priority ${item.priority === 'Ưu tiên cao' ? 'high' : ''}`}><i />{item.priority}</span><b>→</b>
        </button>)}</div>
        {!filtered.length && <div className="amo-empty"><span>⌕</span><strong>Không tìm thấy báo cáo</strong><small>Thử thay đổi loại hoặc từ khóa.</small></div>}
        <footer><i>i</i><p>Hàng đợi được sắp xếp theo rủi ro và thời gian chờ.</p></footer>
      </aside>

      <article className="amo-reviewer">
        <header><div><span>HỒ SƠ KIỂM DUYỆT · {selected.id}</span><h2>{selected.reason}</h2><p>{selected.subject} · Báo cáo {selected.reported}</p></div><b className={selected.priority === 'Ưu tiên cao' ? 'high' : ''}><i />{selected.priority}</b></header>

        <section className="amo-scope"><i>✓</i><p><strong>Đang hiển thị theo phạm vi tối thiểu</strong><span>Chỉ nội dung bị báo cáo và metadata cần thiết được mở cho phiên kiểm duyệt này.</span></p><button onClick={() => onNotice('Phạm vi truy cập chỉ gồm nội dung đang hiển thị.')}>Xem phạm vi →</button></section>

        <section className="amo-content">
          <header><span>01</span><div><h3>Nội dung bị báo cáo</h3><p>{selected.status}</p></div></header>
          <blockquote><span>“</span><p>{selected.excerpt}</p></blockquote>
          <div className="amo-content-meta"><p><small>Loại nội dung</small><strong>{selected.type}</strong></p><p><small>Ngữ cảnh hệ thống</small><strong>{selected.context}</strong></p><p><small>Danh tính người báo cáo</small><strong>Đã ẩn</strong></p></div>
        </section>

        <section className="amo-policy">
          <header><span>02</span><div><h3>Đối chiếu chính sách</h3><p>Đánh giá nội dung theo tiêu chí áp dụng.</p></div></header>
          <div><label><input type="checkbox" /><i>✓</i><span><strong>Ngôn từ gây tổn thương</strong><small>Hạ thấp, phán xét hoặc phủ nhận trải nghiệm của người dùng.</small></span></label><label><input type="checkbox" /><i>✓</i><span><strong>Thông tin sai lệch</strong><small>Tuyên bố không có căn cứ hoặc gây hiểu nhầm.</small></span></label><label><input type="checkbox" /><i>✓</i><span><strong>Vi phạm ranh giới chuyên môn</strong><small>Lôi kéo ra ngoài nền tảng hoặc vượt phạm vi dịch vụ.</small></span></label></div>
        </section>

        <section className="amo-note"><span>03</span><label><strong>Ghi chú quyết định</strong><small>{note.length}/300</small><textarea value={note} onChange={event => setNote(event.target.value.slice(0,300))} placeholder="Ghi căn cứ cho quyết định kiểm duyệt..." rows={3} /></label></section>
        <aside className="amo-warning"><i>!</i><p><strong>Không sử dụng dữ liệu sức khỏe tinh thần ngoài nội dung được báo cáo.</strong><span>Mọi thao tác xem và quyết định đều được ghi vào audit log.</span></p></aside>
        <footer><button className="keep" onClick={() => onNotice(`Đã giữ nguyên nội dung ${selected.id}.`)}>Giữ nguyên</button><button className="request" onClick={() => onNotice(`Đã yêu cầu chỉnh sửa nội dung ${selected.id}.`)}>Yêu cầu chỉnh sửa</button><button className="remove" onClick={() => onNotice(`Đã ẩn nội dung ${selected.id} và lưu quyết định.`)}>Ẩn nội dung</button></footer>
      </article>
    </section>

    <section className="amo-guidance"><div><span>NGUYÊN TẮC KIỂM DUYỆT</span><h2>Quyết định nhất quán, có căn cứ</h2></div><article><i>01</i><p><strong>Tối thiểu dữ liệu</strong><small>Chỉ mở phần cần thiết để đưa ra quyết định.</small></p></article><article><i>02</i><p><strong>Không suy diễn lâm sàng</strong><small>Admin không đánh giá tình trạng tâm lý người dùng.</small></p></article><article><i>03</i><p><strong>Có thể kiểm tra lại</strong><small>Mỗi quyết định cần ghi chú và dấu vết audit.</small></p></article></section>
  </div>
}
