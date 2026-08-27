'use client'

import { useMemo, useState } from 'react'
import './admin-specialists-manager.css'

type VerificationStatus = 'Chờ duyệt' | 'Cần bổ sung' | 'Đã xác minh' | 'Tạm khóa'
type SpecialistApplication = {
  id: string
  name: string
  initials: string
  title: string
  specialty: string
  experience: number
  submitted: string
  completeness: number
  status: VerificationStatus
  documents: Array<{ name: string; detail: string; verified: boolean }>
}

type Props = { onNotice: (message: string) => void }

const INITIAL_APPLICATIONS: SpecialistApplication[] = [
  { id: 'SP-1048', name: 'ThS. Lê Minh Phương', initials: 'LP', title: 'Chuyên gia tâm lý lâm sàng', specialty: 'Lo âu · Trầm cảm', experience: 7, submitted: 'Hôm nay, 08:42', completeness: 100, status: 'Chờ duyệt', documents: [{ name: 'Bằng Thạc sĩ Tâm lý học', detail: 'ĐH KHXH&NV · Cấp năm 2018', verified: true }, { name: 'Chứng chỉ hành nghề', detail: 'Còn hiệu lực đến 11/2028', verified: true }, { name: 'Giấy tờ định danh', detail: 'Đã đối chiếu thông tin', verified: true }] },
  { id: 'SP-1051', name: 'BS. Phạm Hải Yến', initials: 'HY', title: 'Bác sĩ chuyên khoa Tâm thần', specialty: 'Rối loạn giấc ngủ', experience: 9, submitted: 'Hôm qua, 16:20', completeness: 82, status: 'Cần bổ sung', documents: [{ name: 'Bằng Bác sĩ chuyên khoa', detail: 'Đã tải lên · Chờ đối chiếu', verified: true }, { name: 'Chứng chỉ hành nghề', detail: 'Thiếu trang thời hạn hiệu lực', verified: false }, { name: 'Giấy tờ định danh', detail: 'Đã đối chiếu thông tin', verified: true }] },
  { id: 'SP-0996', name: 'ThS. Trần Đức Minh', initials: 'DM', title: 'Chuyên gia tham vấn tâm lý', specialty: 'Stress · Công việc', experience: 6, submitted: '24/08/2026', completeness: 100, status: 'Đã xác minh', documents: [{ name: 'Bằng Thạc sĩ Tâm lý học', detail: 'Đã xác minh 25/08/2026', verified: true }, { name: 'Chứng nhận tham vấn', detail: 'Đã xác minh 25/08/2026', verified: true }, { name: 'Giấy tờ định danh', detail: 'Đã đối chiếu thông tin', verified: true }] },
  { id: 'SP-0974', name: 'CN. Nguyễn Bảo Trâm', initials: 'BT', title: 'Chuyên viên tham vấn', specialty: 'Thanh thiếu niên', experience: 4, submitted: '19/08/2026', completeness: 93, status: 'Tạm khóa', documents: [{ name: 'Bằng Cử nhân Tâm lý học', detail: 'Đã xác minh', verified: true }, { name: 'Chứng nhận đào tạo', detail: 'Cần kiểm tra lại đơn vị cấp', verified: false }, { name: 'Giấy tờ định danh', detail: 'Đã đối chiếu thông tin', verified: true }] },
]

const FILTERS: Array<'Tất cả' | VerificationStatus> = ['Tất cả', 'Chờ duyệt', 'Cần bổ sung', 'Đã xác minh', 'Tạm khóa']

export default function AdminSpecialistsManager({ onNotice }: Props) {
  const [applications, setApplications] = useState(INITIAL_APPLICATIONS)
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('Tất cả')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(INITIAL_APPLICATIONS[0].id)
  const [reviewNote, setReviewNote] = useState('')

  const visible = useMemo(() => applications.filter(item => (activeFilter === 'Tất cả' || item.status === activeFilter) && `${item.name} ${item.id} ${item.specialty}`.toLowerCase().includes(query.toLowerCase())), [activeFilter, applications, query])
  const selected = applications.find(item => item.id === selectedId) ?? visible[0] ?? applications[0]

  const updateStatus = (status: VerificationStatus) => {
    setApplications(current => current.map(item => item.id === selected.id ? { ...item, status } : item))
    const messages: Record<VerificationStatus, string> = { 'Chờ duyệt': 'Hồ sơ đã được đưa lại vào hàng đợi duyệt.', 'Cần bổ sung': 'Đã gửi yêu cầu bổ sung hồ sơ cho chuyên gia.', 'Đã xác minh': 'Hồ sơ chuyên gia đã được xác minh và phê duyệt.', 'Tạm khóa': 'Quyền hoạt động của chuyên gia đã được tạm khóa.' }
    onNotice(messages[status])
    setReviewNote('')
  }

  return <div className="admin-specialists-manager">
    <header className="asv-heading"><div><span>Quản trị nền tảng</span><h1>Quản lý chuyên gia</h1><p>Xác minh năng lực, giấy tờ hành nghề và trạng thái hoạt động trước khi hồ sơ được công khai.</p></div><aside><i /><p><strong>Quy trình đang hoạt động</strong><small>Đối chiếu thủ công · Có audit log</small></p></aside></header>

    <section className="asv-stats" aria-label="Tổng quan xác minh chuyên gia">
      <article className="primary"><span>Chờ xác minh</span><strong>6</strong><p>2 hồ sơ cần xử lý hôm nay</p></article>
      <article><span>Đã xác minh</span><strong>122</strong><p>95,3% chuyên gia đang hoạt động</p></article>
      <article><span>Thời gian xử lý</span><strong>1,8 ngày</strong><p>Trung bình trong 30 ngày</p></article>
      <article className="warning"><span>Cần bổ sung</span><strong>3</strong><p>Thiếu hoặc hết hạn giấy tờ</p></article>
    </section>

    <section className="asv-workspace">
      <div className="asv-queue">
        <header><div><span>Hàng đợi xác minh</span><h2>Hồ sơ chuyên gia</h2></div><b>{visible.length}</b></header>
        <label className="asv-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, mã hoặc chuyên môn..." /></label>
        <nav aria-label="Lọc hồ sơ xác minh">{FILTERS.map(filter => <button type="button" key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</nav>
        <div className="asv-list">{visible.map(item => <button type="button" key={item.id} className={selected.id === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}>
          <span className="asv-avatar">{item.initials}</span><p><strong>{item.name}</strong><small>{item.title}</small><em>{item.id} · {item.submitted}</em></p><span className={`asv-status ${item.status === 'Đã xác minh' ? 'verified' : item.status === 'Cần bổ sung' ? 'missing' : item.status === 'Tạm khóa' ? 'locked' : 'pending'}`}><i />{item.status}</span><b>›</b>
        </button>)}</div>
        {!visible.length && <div className="asv-empty"><span>⌕</span><strong>Không có hồ sơ phù hợp</strong><button type="button" onClick={() => { setQuery(''); setActiveFilter('Tất cả') }}>Đặt lại bộ lọc</button></div>}
      </div>

      <article className="asv-review">
        <header className="asv-review-head"><div><span>Manage specialist verification</span><h2>{selected.name}</h2><p>{selected.title} · {selected.specialty}</p></div><span className={`asv-review-badge ${selected.status === 'Đã xác minh' ? 'verified' : selected.status === 'Cần bổ sung' ? 'missing' : selected.status === 'Tạm khóa' ? 'locked' : 'pending'}`}>{selected.status}</span></header>
        <section className="asv-profile-summary"><div><span className="asv-large-avatar">{selected.initials}<i>✓</i></span><p><small>Mã hồ sơ</small><strong>{selected.id}</strong></p><p><small>Kinh nghiệm</small><strong>{selected.experience} năm</strong></p><p><small>Hoàn thiện hồ sơ</small><strong>{selected.completeness}%</strong></p></div><span><i style={{ width: `${selected.completeness}%` }} /></span></section>

        <section className="asv-checklist"><header><div><span>Bước 01</span><h3>Đối chiếu giấy tờ</h3></div><small>{selected.documents.filter(document => document.verified).length}/{selected.documents.length} hợp lệ</small></header><div>{selected.documents.map(document => <article key={document.name} className={document.verified ? 'verified' : 'missing'}><i>{document.verified ? '✓' : '!'}</i><p><strong>{document.name}</strong><span>{document.detail}</span></p><button type="button" onClick={() => onNotice(`Đã mở bản xem trước “${document.name}”.`)}>Xem giấy tờ ↗</button></article>)}</div></section>

        <section className="asv-scope"><header><span>Bước 02</span><h3>Phạm vi kiểm tra</h3></header><div><p><i>✓</i><span><strong>Thông tin định danh</strong><small>Họ tên, ngày sinh và giấy tờ trùng khớp</small></span></p><p><i>✓</i><span><strong>Năng lực chuyên môn</strong><small>Bằng cấp và chuyên môn phù hợp dịch vụ</small></span></p><p><i>✓</i><span><strong>Thiết lập công khai</strong><small>Giới thiệu, phí và hình thức tư vấn đầy đủ</small></span></p></div></section>

        <label className="asv-note"><span>Ghi chú thẩm định <small>Chỉ admin nhìn thấy</small></span><textarea rows={3} value={reviewNote} onChange={event => setReviewNote(event.target.value.slice(0, 300))} placeholder="Ghi lại điểm cần đối chiếu hoặc nội dung yêu cầu bổ sung..." /><small>{reviewNote.length}/300</small></label>
        <aside className="asv-safety"><i>◎</i><p><strong>Quyết định sẽ được ghi vào audit log</strong><span>Chỉ phê duyệt khi toàn bộ giấy tờ bắt buộc hợp lệ và còn hiệu lực.</span></p></aside>
        <footer className="asv-actions"><button type="button" className="reject" onClick={() => updateStatus('Tạm khóa')}>{selected.status === 'Đã xác minh' ? 'Tạm khóa hồ sơ' : 'Từ chối'}</button><button type="button" className="request" onClick={() => updateStatus('Cần bổ sung')}>Yêu cầu bổ sung</button><button type="button" className="approve btn-primary" disabled={selected.documents.some(document => !document.verified)} onClick={() => updateStatus('Đã xác minh')}>✓ Xác minh & phê duyệt</button></footer>
      </article>
    </section>
  </div>
}
