'use client'

import { useMemo, useState } from 'react'
import './admin-assessments-manager.css'

type AssessmentStatus = 'Đã xuất bản' | 'Bản nháp' | 'Đang rà soát'
type Assessment = {
  id: string
  name: string
  fullName: string
  purpose: string
  questions: number
  duration: string
  version: string
  updated: string
  completions: number
  status: AssessmentStatus
  owner: string
}

type Props = { onNotice: (message: string) => void }

const INITIAL_ASSESSMENTS: Assessment[] = [
  { id: 'AS-PHQ9', name: 'PHQ-9', fullName: 'Patient Health Questionnaire-9', purpose: 'Sàng lọc triệu chứng trong 14 ngày gần đây; không phải chẩn đoán.', questions: 9, duration: '3–5 phút', version: 'phq9-vi-vn-capstone-v1', updated: '02/09/2026', completions: 0, status: 'Đã xuất bản', owner: 'Care service' },
  { id: 'AS-GAD7', name: 'GAD-7', fullName: 'Generalized Anxiety Disorder-7', purpose: 'Nội dung vi-VN và mapping tự điền chưa hoàn tất publication gate.', questions: 7, duration: 'Chưa khả dụng', version: 'Chưa công bố', updated: '02/09/2026', completions: 0, status: 'Đang rà soát', owner: 'Chưa phân công' },
  { id: 'AS-PSQI', name: 'PSQI', fullName: 'Pittsburgh Sleep Quality Index', purpose: 'Đánh giá chất lượng và thói quen giấc ngủ.', questions: 19, duration: '5–7 phút', version: 'v1.4', updated: '12/08/2026', completions: 1852, status: 'Đang rà soát', owner: 'TS. Nguyễn Thu Hà' },
  { id: 'AS-DASS21', name: 'DASS-21', fullName: 'Depression Anxiety Stress Scales', purpose: 'Sàng lọc ba nhóm biểu hiện: trầm cảm, lo âu và stress.', questions: 21, duration: '7–10 phút', version: 'v0.9', updated: '26/08/2026', completions: 0, status: 'Bản nháp', owner: 'ThS. Lê Minh Phương' },
]

export default function AdminAssessmentsManager({ onNotice }: Props) {
  const [assessments, setAssessments] = useState(INITIAL_ASSESSMENTS)
  const [selectedId, setSelectedId] = useState(INITIAL_ASSESSMENTS[0].id)
  const [filter, setFilter] = useState<'Tất cả' | AssessmentStatus>('Tất cả')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newAssessment, setNewAssessment] = useState({ name: '', fullName: '', questions: '9', duration: '3–5 phút' })

  const visible = useMemo(() => assessments.filter(item => (filter === 'Tất cả' || item.status === filter) && `${item.name} ${item.fullName} ${item.purpose}`.toLowerCase().includes(query.toLowerCase())), [assessments, filter, query])
  const selected = assessments.find(item => item.id === selectedId) ?? visible[0] ?? assessments[0]

  const updateStatus = (status: AssessmentStatus) => {
    setAssessments(current => current.map(item => item.id === selected.id ? { ...item, status, updated: '27/08/2026' } : item))
    onNotice(`“${selected.name}” đã chuyển sang trạng thái ${status.toLowerCase()}.`)
  }

  const createAssessment = () => {
    if (!newAssessment.name.trim() || !newAssessment.fullName.trim()) return
    const created: Assessment = { id: `AS-${Date.now().toString().slice(-5)}`, name: newAssessment.name.trim().toUpperCase(), fullName: newAssessment.fullName.trim(), purpose: 'Nội dung mô tả sẽ được bổ sung trong bước biên soạn.', questions: Number(newAssessment.questions), duration: newAssessment.duration, version: 'v0.1', updated: '27/08/2026', completions: 0, status: 'Bản nháp', owner: 'Admin MentalBridge' }
    setAssessments(current => [...current, created])
    setSelectedId(created.id)
    setCreateOpen(false)
    setNewAssessment({ name: '', fullName: '', questions: '9', duration: '3–5 phút' })
    onNotice('Bản nháp bài đánh giá mới đã được tạo.')
  }

  return <div className="admin-assessments-manager">
    <header className="aam-heading"><div><span>Quản trị nội dung lâm sàng</span><h1>Quản lý bài đánh giá</h1><p>Quản lý phiên bản, trạng thái phát hành và cấu hình hiển thị của các bộ câu hỏi sàng lọc.</p></div><button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>＋ Tạo bài đánh giá</button></header>

    <section className="aam-stats" aria-label="Tổng quan bài đánh giá"><article className="primary"><span>Đang hoạt động</span><strong>1</strong><p>PHQ-9 hiển thị với người dùng</p></article><article><span>Lượt hoàn thành</span><strong>0</strong><p>Chưa kết nối API thống kê</p></article><article><span>Tỷ lệ hoàn thành</span><strong>—</strong><p>Chưa có dữ liệu thật</p></article><article className="review"><span>Cần rà soát</span><strong>3</strong><p>GAD-7, PSQI và DASS-21</p></article></section>

    <section className="aam-workspace">
      <div className="aam-catalog">
        <header><div><span>Thư viện</span><h2>Bộ câu hỏi</h2></div><b>{visible.length}</b></header>
        <div className="aam-toolbar"><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm bài đánh giá..." /></label><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} aria-label="Lọc trạng thái"><option>Tất cả</option><option>Đã xuất bản</option><option>Bản nháp</option><option>Đang rà soát</option></select></div>
        <div className="aam-list">{visible.map((item, index) => <button type="button" key={item.id} className={selected.id === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><span className={`aam-symbol tone-${index % 4}`}>{item.name.slice(0, 2)}</span><p><strong>{item.name}</strong><small>{item.fullName}</small><em>{item.questions} câu · {item.duration}</em></p><span className={`aam-status ${item.status === 'Đã xuất bản' ? 'published' : item.status === 'Bản nháp' ? 'draft' : 'review'}`}><i />{item.status}</span><b>›</b></button>)}</div>
        {!visible.length && <div className="aam-empty"><span>⌕</span><strong>Không tìm thấy bài đánh giá</strong><button type="button" onClick={() => { setQuery(''); setFilter('Tất cả') }}>Đặt lại bộ lọc</button></div>}
      </div>

      <article className="aam-editor">
        <header><div><span>Assessment configuration · {selected.id}</span><h2>{selected.name}</h2><p>{selected.fullName}</p></div><span className={`aam-editor-status ${selected.status === 'Đã xuất bản' ? 'published' : selected.status === 'Bản nháp' ? 'draft' : 'review'}`}>{selected.status}</span></header>
        <section className="aam-summary"><p>{selected.purpose}</p><div><span><small>Số câu hỏi</small><strong>{selected.questions}</strong></span><span><small>Thời lượng</small><strong>{selected.duration}</strong></span><span><small>Phiên bản</small><strong>{selected.version}</strong></span><span><small>Hoàn thành</small><strong>{selected.completions.toLocaleString('vi-VN')}</strong></span></div></section>
        <nav className="aam-editor-tabs" aria-label="Nội dung cấu hình"><button type="button" className="active">Cấu hình chung</button><button type="button" onClick={() => onNotice('Trình biên soạn câu hỏi đã sẵn sàng để kết nối dữ liệu.')}>Câu hỏi</button><button type="button" onClick={() => onNotice('Cấu hình cách tính điểm đã sẵn sàng để kết nối dữ liệu.')}>Tính điểm</button><button type="button" onClick={() => onNotice('Lịch sử phiên bản đã sẵn sàng để kết nối API.')}>Phiên bản</button></nav>
        <section className="aam-settings"><header><span>Thiết lập phát hành</span><h3>Phạm vi và cách hiển thị</h3></header><div className="aam-setting-grid"><label><span>Tên hiển thị</span><input value={selected.name} readOnly /></label><label><span>Người phụ trách</span><input value={selected.owner} readOnly /></label><label><span>Thời lượng ước tính</span><input value={selected.duration} readOnly /></label><label><span>Cập nhật gần nhất</span><input value={selected.updated} readOnly /></label></div><label className="aam-description"><span>Mục đích sử dụng</span><textarea rows={3} value={selected.purpose} readOnly /></label></section>
        <section className="aam-guardrails"><header><span>Kiểm tra trước phát hành</span><h3>Clinical & safety checklist</h3></header><div><p><i>✓</i><span><strong>Thông báo không thay thế chẩn đoán</strong><small>Hiển thị trước và sau khi người dùng hoàn thành.</small></span></p><p><i>✓</i><span><strong>Ngưỡng điểm đã được rà soát</strong><small>Cách diễn giải kết quả có nguồn tham chiếu.</small></span></p><p><i>✓</i><span><strong>Giới hạn năng lực được ghi rõ</strong><small>Nội dung hỗ trợ chưa có contract sẽ hiển thị là chưa khả dụng.</small></span></p></div></section>
        <aside className="aam-warning"><i>i</i><p><strong>Mọi thay đổi cần tạo phiên bản mới</strong><span>Không chỉnh sửa trực tiếp dữ liệu của các lượt đánh giá đã hoàn thành.</span></p></aside>
        <footer className="aam-actions"><button type="button" onClick={() => onNotice(`Đã tạo bản sao nháp từ ${selected.name}.`)}>Nhân bản</button>{selected.status === 'Đã xuất bản' ? <button type="button" className="unpublish" onClick={() => updateStatus('Đang rà soát')}>Tạm ẩn</button> : <button type="button" className="publish btn-primary" onClick={() => updateStatus('Đã xuất bản')}>Xuất bản phiên bản</button>}</footer>
      </article>
    </section>

    {createOpen && <div className="aam-modal-wrap"><button type="button" className="aam-backdrop" aria-label="Đóng" onClick={() => setCreateOpen(false)} /><section className="aam-modal" role="dialog" aria-modal="true" aria-labelledby="aam-create-title"><header><div><span>Bản nháp mới</span><h2 id="aam-create-title">Tạo bài đánh giá</h2><p>Khởi tạo cấu hình cơ bản trước khi biên soạn câu hỏi và cách tính điểm.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng">×</button></header><div><label><span>Mã viết tắt <b>*</b></span><input value={newAssessment.name} onChange={event => setNewAssessment(current => ({ ...current, name: event.target.value.slice(0, 12) }))} placeholder="Ví dụ: WHO-5" /></label><label><span>Tên đầy đủ <b>*</b></span><input value={newAssessment.fullName} onChange={event => setNewAssessment(current => ({ ...current, fullName: event.target.value.slice(0, 100) }))} placeholder="Tên chính thức của bộ câu hỏi" /></label><div><label><span>Số câu dự kiến</span><input type="number" min="1" max="100" value={newAssessment.questions} onChange={event => setNewAssessment(current => ({ ...current, questions: event.target.value }))} /></label><label><span>Thời lượng</span><select value={newAssessment.duration} onChange={event => setNewAssessment(current => ({ ...current, duration: event.target.value }))}><option>3–5 phút</option><option>5–7 phút</option><option>7–10 phút</option></select></label></div><aside><i>i</i><p>Bài đánh giá mới luôn được tạo ở trạng thái bản nháp và chưa hiển thị với người dùng.</p></aside></div><footer><button type="button" onClick={() => setCreateOpen(false)}>Hủy</button><button type="button" className="btn-primary" disabled={!newAssessment.name.trim() || !newAssessment.fullName.trim()} onClick={createAssessment}>Tạo bản nháp</button></footer></section></div>}
  </div>
}
