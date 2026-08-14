'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import './role-workspace.css'

type Role = 'specialist' | 'admin'
type Row = { id: string; title: string; meta: string; status: string; detail: string }
type Section = { label: string; description: string; rows: Row[]; tabs?: string[] }

const specialistSections: Record<string, Section> = {
  dashboard: { label: 'Tổng quan chuyên gia', description: 'Lịch làm việc, tin nhắn và các việc cần theo dõi hôm nay.', rows: [
    { id: 's1', title: 'Lịch hẹn hôm nay', meta: '3 phiên tư vấn · Phiên tiếp theo 10:30', status: 'Đang hoạt động', detail: 'Lịch làm việc được tổng hợp từ các cuộc hẹn đã xác nhận.' },
    { id: 's2', title: 'Yêu cầu đang chờ', meta: '2 yêu cầu đặt lịch mới', status: 'Cần xử lý', detail: 'Chỉ yêu cầu đang chờ mới có thể chấp nhận hoặc từ chối.' },
    { id: 's3', title: 'Theo dõi khách hàng', meta: '4 check-in cần xem lại', status: 'Hôm nay', detail: 'Các phản hồi được chia sẻ trong phạm vi người dùng đã đồng ý.' },
  ]},
  appointments: { label: 'Quản lý lịch hẹn', description: 'Xử lý yêu cầu và theo dõi phiên tư vấn theo trạng thái.', rows: [
    { id: 'a1', title: 'Nguyễn Minh Anh', meta: 'Hôm nay · 10:30–11:15 · Video call', status: 'Đã xác nhận', detail: 'Phiên tư vấn 45 phút. Có thể yêu cầu đổi lịch hoặc đánh dấu hoàn thành sau phiên.' },
    { id: 'a2', title: 'Trần Gia Hân', meta: 'Ngày mai · 14:00–14:45', status: 'Chờ xác nhận', detail: 'Yêu cầu mới. Hãy xem ghi chú trước khi chấp nhận hoặc từ chối.' },
    { id: 'a3', title: 'Lê Hoàng Nam', meta: '12/08/2026 · 09:00', status: 'Hoàn thành', detail: 'Phiên đã hoàn thành. Các hành động hủy và đổi lịch đã được ẩn.' },
  ], tabs: ['Sắp tới', 'Chờ xác nhận', 'Lịch sử'] },
  availability: { label: 'Lịch khả dụng', description: 'Quản lý khung giờ nhận tư vấn theo lịch tuần.', rows: [
    { id: 'v1', title: 'Thứ Hai, 17/08', meta: '09:00–12:00 · 3 khung giờ', status: 'Còn trống', detail: 'Bạn có thể cập nhật hoặc xóa các khung giờ chưa được đặt.' },
    { id: 'v2', title: 'Thứ Tư, 19/08', meta: '13:30–17:00 · 4 khung giờ', status: '2 đã đặt', detail: 'Khung giờ đã có lịch hẹn sẽ không thể xóa.' },
  ], tabs: ['Lịch tuần', 'Danh sách'] },
  clients: { label: 'Khách hàng đồng ý chia sẻ', description: 'Chỉ hiển thị dữ liệu nằm trong phạm vi consent hiện hành.', rows: [
    { id: 'c1', title: 'Nguyễn Minh Anh', meta: 'Được xem: Assessment, xu hướng cảm xúc', status: 'Đã cấp quyền', detail: 'Access granted by user · Không có quyền xem nội dung nhật ký riêng tư.' },
    { id: 'c2', title: 'Trần Gia Hân', meta: 'Được xem: Tổng quan, follow-up', status: 'Đã cấp quyền', detail: 'Access granted by user · Quyền có thể bị người dùng thu hồi bất kỳ lúc nào.' },
  ], tabs: ['Tổng quan', 'Assessments', 'Xu hướng cảm xúc', 'Nhật ký', 'Follow-up'] },
  messages: { label: 'Tin nhắn tư vấn', description: 'Trao đổi chuyên nghiệp, bảo mật với khách hàng.', rows: [
    { id: 'm1', title: 'Nguyễn Minh Anh', meta: '“Em đã hoàn thành bài tập tuần này…” · 5 phút', status: '2 chưa đọc', detail: 'Cuộc trò chuyện gắn với kế hoạch theo dõi MB-2048.' },
    { id: 'm2', title: 'Trần Gia Hân', meta: '“Cảm ơn bác sĩ, em đã rõ…” · Hôm qua', status: 'Đã đọc', detail: 'Bạn có thể đóng cuộc trò chuyện khi kế hoạch theo dõi kết thúc.' },
  ]},
  'follow-up': { label: 'Kế hoạch theo dõi', description: 'Mục tiêu, lịch check-in và yêu cầu assessment sau tư vấn.', rows: [
    { id: 'f1', title: 'Ổn định giấc ngủ · Nguyễn Minh Anh', meta: '3/5 nhiệm vụ · Check-in thứ Sáu', status: 'Đang tiến hành', detail: 'Mục tiêu: duy trì lịch ngủ và ghi nhận cảm xúc trong 14 ngày.' },
    { id: 'f2', title: 'Quản lý lo âu · Trần Gia Hân', meta: 'GAD-7 sau 7 ngày', status: 'Cần phản hồi', detail: 'Kết quả chỉ hỗ trợ theo dõi, không thay thế chẩn đoán chuyên môn.' },
  ]},
  earnings: { label: 'Thu nhập & thanh toán', description: 'Thu nhập tự động ghi nhận từ các lịch hẹn đã hoàn thành.', rows: [
    { id: 'e1', title: 'Thu nhập khả dụng', meta: '8.400.000đ · 21 phiên hoàn thành', status: 'Khả dụng', detail: 'Số dư đủ điều kiện được đưa vào kỳ thanh toán tiếp theo.' },
    { id: 'e2', title: 'Thanh toán tháng 07/2026', meta: '6.800.000đ · PayOS', status: 'Đã thanh toán', detail: 'Mã giao dịch PO-0726-1842 · Hoàn tất 02/08/2026.' },
  ], tabs: ['Tổng quan', 'Đang chờ', 'Lịch sử'] },
  notifications: { label: 'Thông báo', description: 'Cập nhật lịch hẹn, tin nhắn và kế hoạch theo dõi.', rows: [
    { id: 'n1', title: 'Yêu cầu đặt lịch mới', meta: 'Trần Gia Hân · 10 phút trước', status: 'Chưa đọc', detail: 'Khách hàng đề xuất 14:00 ngày mai.' },
    { id: 'n2', title: 'Thanh toán đã được xử lý', meta: 'Kỳ tháng 07/2026', status: 'Đã đọc', detail: 'Khoản thanh toán đã chuyển sang trạng thái hoàn tất.' },
  ]},
  profile: { label: 'Hồ sơ chuyên gia', description: 'Cập nhật thông tin hiển thị và thiết lập tư vấn.', rows: [
    { id: 'p1', title: 'ThS. Nguyễn Thu Hà', meta: 'Tâm lý lâm sàng · 8 năm kinh nghiệm', status: 'Đang hoạt động', detail: 'Hồ sơ công khai gồm chuyên môn, giới thiệu, ngôn ngữ và phí tư vấn.' },
  ], tabs: ['Thông tin', 'Chuyên môn', 'Thiết lập tư vấn'] },
}

const adminSections: Record<string, Section> = {
  dashboard: { label: 'Tổng quan hệ thống', description: 'Các chỉ số vận hành và hạng mục cần xử lý.', rows: [
    { id: 'd1', title: '12.480 người dùng', meta: '+8,4% trong 30 ngày', status: 'Ổn định', detail: 'Bao gồm tài khoản đang hoạt động và tạm khóa.' },
    { id: 'd2', title: '128 chuyên gia', meta: '6 hồ sơ đang chờ duyệt', status: 'Cần xử lý', detail: 'Hồ sơ chờ duyệt cần được xem đầy đủ trước khi quyết định.' },
    { id: 'd3', title: '34 báo cáo nội dung', meta: '5 báo cáo ưu tiên xem xét', status: 'Theo dõi', detail: 'Nội dung nhạy cảm chỉ hiển thị đúng phạm vi cần thiết cho moderation.' },
  ]},
  users: { label: 'Quản lý người dùng', description: 'Tra cứu tài khoản và cập nhật trạng thái truy cập.', rows: [
    { id: 'u1', title: 'Nguyễn Minh Anh', meta: 'minhanh@example.com · Tham gia 04/2026', status: 'Hoạt động', detail: 'Không hiển thị assessment hoặc journal trong khu vực quản trị tài khoản.' },
    { id: 'u2', title: 'Trần Gia Hân', meta: 'giahan@example.com · Tham gia 06/2026', status: 'Tạm khóa', detail: 'Tài khoản tạm khóa sau nhiều lần đăng nhập bất thường.' },
  ]},
  specialists: { label: 'Quản lý chuyên gia', description: 'Xem xét hồ sơ trước khi phê duyệt hoặc từ chối.', rows: [
    { id: 'sp1', title: 'ThS. Lê Minh Phương', meta: 'Tâm lý lâm sàng · Hồ sơ đầy đủ', status: 'Chờ duyệt', detail: 'Đã cung cấp bằng cấp, chứng chỉ hành nghề và thông tin đối soát.' },
    { id: 'sp2', title: 'BS. Nguyễn Thu Hà', meta: 'Tâm thần học · 8 năm kinh nghiệm', status: 'Đã duyệt', detail: 'Hồ sơ đang hoạt động trên nền tảng.' },
  ], tabs: ['Tất cả', 'Chờ duyệt', 'Đang hoạt động', 'Tạm khóa'] },
  payments: { label: 'Subscriptions & Payments', description: 'Giám sát gói dịch vụ và giao dịch, không chỉnh sửa payment.', rows: [
    { id: 'pay1', title: 'PAY-260814-1284', meta: 'MentalBridge Plus · 299.000đ · MoMo', status: 'Thành công', detail: 'Giao dịch đã được xác nhận bởi cổng thanh toán.' },
    { id: 'pay2', title: 'PAY-260814-1261', meta: 'Gói 3 tháng · 749.000đ · PayOS', status: 'Thất bại', detail: 'Không nhận được xác nhận. Người dùng có thể thử thanh toán lại.' },
  ], tabs: ['Subscriptions', 'Payments'] },
  payouts: { label: 'Đối soát chuyên gia', description: 'Xử lý payout dựa trên thu nhập từ lịch hẹn hoàn thành.', rows: [
    { id: 'po1', title: 'PO-0826-042 · Nguyễn Thu Hà', meta: '8.400.000đ · 01–15/08/2026', status: 'Chờ xử lý', detail: 'Đối soát 21 phiên tư vấn đã hoàn thành.' },
    { id: 'po2', title: 'PO-0726-184 · Trần Minh Đức', meta: '6.200.000đ · 16–31/07/2026', status: 'Đã thanh toán', detail: 'Xử lý qua PayOS ngày 03/08/2026.' },
  ]},
  appointments: { label: 'Lịch hẹn toàn nền tảng', description: 'Theo dõi vận hành, không can thiệp chuyên môn.', rows: [
    { id: 'ap1', title: 'APT-20841', meta: 'Nguyễn Minh Anh ↔ Nguyễn Thu Hà · 10:30', status: 'Đã xác nhận', detail: 'Phiên video 45 phút · Đã sử dụng 1 consultation credit.' },
    { id: 'ap2', title: 'APT-20822', meta: 'Trần Gia Hân ↔ Lê Minh Phương · 09:00', status: 'Hoàn thành', detail: 'Phiên đã hoàn thành và ghi nhận earnings tự động.' },
  ]},
  content: { label: 'Tài nguyên & đường dây hỗ trợ', description: 'Quản lý nội dung tự chăm sóc và thông tin hỗ trợ khẩn cấp.', rows: [
    { id: 'ct1', title: 'Bài tập thở 4–7–8', meta: 'Danh mục: Thở · Cập nhật 12/08', status: 'Đã xuất bản', detail: 'Nội dung tự chăm sóc, không thay thế tư vấn hoặc điều trị chuyên môn.' },
    { id: 'ct2', title: 'Đường dây nóng Ngày Mai', meta: '096 306 1414 · 24/7', status: 'Đang hoạt động', detail: 'Thông tin được hiển thị trong các luồng hỗ trợ nguy cơ cao.' },
  ], tabs: ['Tài nguyên', 'Đường dây hỗ trợ'] },
  moderation: { label: 'Kiểm duyệt báo cáo', description: 'Xem đủ ngữ cảnh cần thiết, tránh phơi bày dữ liệu ngoài phạm vi.', rows: [
    { id: 'mo1', title: 'Review #RV-2841', meta: 'Báo cáo: nội dung không phù hợp', status: 'Chờ xem xét', detail: 'Chỉ đoạn review bị báo cáo và metadata liên quan được hiển thị.' },
    { id: 'mo2', title: 'Message #MSG-9812', meta: 'Báo cáo: ngôn từ gây tổn thương', status: 'Đã ẩn tạm thời', detail: 'Nội dung đang được ẩn trong thời gian kiểm duyệt.' },
  ], tabs: ['Reviews', 'Messages'] },
  ai: { label: 'Đánh giá mô hình AI', description: 'Quản lý dataset và chạy benchmark có kiểm soát.', rows: [
    { id: 'ai1', title: 'Vietnamese Emotion v2.4', meta: '12.840 samples · cập nhật 10/08', status: 'Sẵn sàng', detail: 'Dataset đã qua kiểm tra metadata và ẩn danh dữ liệu.' },
    { id: 'ai2', title: 'Benchmark #BM-260812', meta: 'F1 0,89 · 6 nhóm cảm xúc', status: 'Hoàn thành', detail: 'Kết quả dùng để đánh giá kỹ thuật, không phải chẩn đoán lâm sàng.' },
  ], tabs: ['Datasets', 'Benchmarks', 'Kết quả'] },
  reports: { label: 'Báo cáo nền tảng', description: 'Xu hướng sử dụng, lịch hẹn, subscription và thanh toán.', rows: [
    { id: 'r1', title: 'Báo cáo hoạt động tháng 08', meta: 'Người dùng · Chuyên gia · Lịch hẹn', status: 'Đã tạo', detail: 'Tổng hợp số liệu vận hành đến 14/08/2026.' },
    { id: 'r2', title: 'Phân tích xu hướng quý III', meta: 'Subscriptions · Payments', status: 'Đang xử lý', detail: 'Báo cáo đang được tổng hợp. Có thể thử lại nếu quá trình thất bại.' },
  ]},
  audit: { label: 'Audit & Privacy', description: 'Theo dõi truy cập và cấu hình chính sách lưu giữ dữ liệu.', rows: [
    { id: 'au1', title: 'ADMIN_UPDATE_STATUS', meta: 'admin@mentalbridge.vn · 14:32:08', status: 'Thành công', detail: 'Cập nhật trạng thái tài khoản U-1842. Dữ liệu audit không thể chỉnh sửa.' },
    { id: 'au2', title: 'DATA_EXPORT_REQUEST', meta: 'User U-2048 · 13:18:44', status: 'Đang xử lý', detail: 'Yêu cầu quyền riêng tư được theo dõi theo chính sách hiện hành.' },
  ], tabs: ['Audit log', 'Data retention'] },
}

const navByRole = {
  specialist: [['dashboard','Dashboard'],['appointments','Appointments'],['availability','Availability'],['clients','Clients'],['messages','Messages'],['follow-up','Follow-up'],['earnings','Earnings'],['notifications','Notifications'],['profile','Profile']],
  admin: [['dashboard','Dashboard'],['users','Users'],['specialists','Specialists'],['payments','Subscriptions & Payments'],['payouts','Payouts'],['appointments','Appointments'],['content','Content'],['moderation','Moderation'],['ai','AI Evaluation'],['reports','Reports'],['audit','Audit & Privacy']],
} as const

const navIcons: Record<string, string> = { dashboard: '⌂', appointments: '◷', availability: '▦', clients: '♙', messages: '◇', 'follow-up': '✓', earnings: '◈', notifications: '♢', profile: '○', users: '♙', specialists: '✦', payments: '▤', payouts: '↗', content: '▣', moderation: '◉', ai: '✧', reports: '⌁', audit: '◎' }

const statusClass = (status: string) => /hoàn thành|thành công|hoạt động|đã duyệt|khả dụng|sẵn sàng|xuất bản|cấp quyền|xác nhận/i.test(status) ? 'ok' : /chờ|cần|thất bại|tạm khóa|ẩn/i.test(status) ? 'attention' : 'neutral'

function SpecialistDashboard({ rows, onSelect, onCreate }: { rows: Row[]; onSelect: (row: Row) => void; onCreate: () => void }) {
  const [appointment, requests, followUps] = rows
  return <div className="specialist-command">
    <div className="role-heading specialist-command-head"><div><span className="eyebrow">Không gian chuyên gia</span><h1>Chào buổi sáng, Thu Hà</h1><p>Mọi thông tin quan trọng cho ngày làm việc của bạn được tổng hợp tại đây.</p></div><button className="btn-primary" onClick={onCreate}>+ Tạo lịch trống</button></div>
    <div className="specialist-command-grid">
      <button className="specialist-pulse" onClick={() => onSelect(appointment)}>
        <div className="specialist-card-kicker"><span>Nhịp làm việc hôm nay</span><b>14 tháng 8</b></div>
        <div className="specialist-session-copy"><small>PHIÊN TIẾP THEO · 10:30</small><h2>Nguyễn Minh Anh</h2><p>Tư vấn video · 45 phút</p></div>
        <div className="specialist-timeline" aria-label="Dòng thời gian lịch hẹn hôm nay"><span className="specialist-timeline-fill" /><i className="is-done" /><i className="is-now" /><i /></div>
        <div className="specialist-time-labels"><span><b>08:30</b><small>Hoàn thành</small></span><span><b>10:30</b><small>Sắp diễn ra</small></span><span><b>15:00</b><small>Phiên cuối</small></span></div>
        <div className="specialist-session-footer"><span><i /> Đã chuẩn bị ghi chú phiên</span><strong>Vào phòng tư vấn <b>→</b></strong></div>
      </button>
      <div className="specialist-command-stack">
        <button className="specialist-mini-card is-amber" onClick={() => onSelect(requests)}><span className="specialist-mini-icon">↗</span><div><small>CẦN BẠN XỬ LÝ</small><strong>2 yêu cầu đặt lịch</strong><p>Xem và phản hồi trước cuối ngày</p></div><b>→</b></button>
        <button className="specialist-mini-card is-teal" onClick={() => onSelect(followUps)}><span className="specialist-mini-icon">✓</span><div><small>THEO DÕI KHÁCH HÀNG</small><strong>4 check-in mới</strong><p>Có 1 phản hồi cần ưu tiên</p></div><b>→</b></button>
        <div className="specialist-calm-note"><span>✦</span><p><strong>Một ngày cân bằng</strong> Bạn có 90 phút trống giữa hai phiên chiều.</p></div>
      </div>
    </div>
    <div className="specialist-activity-head"><div><span className="eyebrow">Tổng quan nhanh</span><h2>Hoạt động cần chú ý</h2></div><button className="btn-ghost">Xem tất cả →</button></div>
    <section className="specialist-activity-panel">{rows.map((row, index) => <button className="specialist-activity-row" key={row.id} onClick={() => onSelect(row)}><span className={`specialist-activity-icon tone-${index}`}>{index === 0 ? '◷' : index === 1 ? '↗' : '✓'}</span><span className="specialist-activity-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className={`role-status ${statusClass(row.status)}`}>{row.status}</span><span className="role-arrow">→</span></button>)}</section>
  </div>
}

export default function RoleWorkspace({ role, sectionKey }: { role: Role; sectionKey: string }) {
  const router = useRouter()
  const sections = role === 'specialist' ? specialistSections : adminSections
  const section = sections[sectionKey] || sections.dashboard
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState(section.tabs?.[0] || 'Tất cả')
  const [selected, setSelected] = useState<Row | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(localStorage.getItem('mentalbridge_sidebar_collapsed') === 'true')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(value => {
      const nextValue = !value
      localStorage.setItem('mentalbridge_sidebar_collapsed', String(nextValue))
      return nextValue
    })
  }

  const visibleRows = useMemo(() => section.rows.filter(row => `${row.title} ${row.meta} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [query, section.rows])
  const showAction = (row: Row, action: string) => {
    if (/Hoàn thành|Đã thanh toán/.test(row.status) && /Hủy|Từ chối|Xử lý/.test(action)) return false
    return true
  }
  const finishAction = () => {
    setConfirmAction(null)
    setToast('Thao tác đã được cập nhật thành công.')
    window.setTimeout(() => setToast(''), 3200)
  }
  const logout = () => {
    localStorage.removeItem('mentalbridge_session')
    sessionStorage.removeItem('mentalbridge_session')
    router.replace('/login')
  }

  return <div className={`role-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <motion.aside className={`role-sidebar ${mobileOpen ? 'open' : ''}`} initial={false} animate={{ width: sidebarCollapsed ? 88 : 264 }} transition={{ type: 'spring', stiffness: 330, damping: 34 }}>
      <Link href="/" className="role-brand"><motion.span className="role-brand-mark" whileHover={{ rotate: -6, scale: 1.06 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>M</motion.span><span className="role-brand-copy"><strong>MentalBridge</strong><small>{role === 'admin' ? 'Admin Console' : 'Specialist Workspace'}</small></span></Link>
      <button className="role-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}><motion.span animate={{ rotate: sidebarCollapsed ? 180 : 0 }}>‹</motion.span></button>
      <nav aria-label={`Điều hướng ${role}`}>
        {navByRole[role].map(([key,label]) => <div key={key} className="role-nav-item"><Link href={`/${role}/${key}`} className={key === sectionKey ? 'active' : ''} onClick={() => setMobileOpen(false)} title={sidebarCollapsed ? label : undefined}>{key === sectionKey && <motion.span layoutId={`role-active-${role}`} className="role-active-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}<span className="role-nav-icon" aria-hidden="true">{navIcons[key] || '·'}</span><span className="role-nav-label">{label}</span>{key === 'notifications' && <span className="role-nav-badge">3</span>}</Link></div>)}
      </nav>
      <motion.div className="role-user" whileHover={{ y: -2 }}><span>{role === 'admin' ? 'AD' : 'TH'}</span><div className="role-user-copy"><strong>{role === 'admin' ? 'Quản trị viên' : 'Nguyễn Thu Hà'}</strong><small>{role === 'admin' ? 'System admin' : 'Chuyên gia tâm lý'}</small></div><span className="role-online" /></motion.div>
      <button className="role-logout" onClick={logout} title={sidebarCollapsed ? 'Đăng xuất' : undefined}><span>↪</span><span className="role-logout-label">Đăng xuất</span></button>
    </motion.aside>
    <main className="role-main">
      <header className="role-topbar"><button className="role-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Mở menu">☰</button><div><span className="role-live-dot" /> Hệ thống hoạt động ổn định</div><Link href={`/${role}/notifications`} className="role-bell" aria-label="Thông báo">○<b>3</b></Link></header>
      <div className="role-content">
        {role === 'specialist' && sectionKey === 'dashboard' && <SpecialistDashboard rows={section.rows} onSelect={setSelected} onCreate={() => setToast('Lịch trống mới đã sẵn sàng để thiết lập.')} />}
        <div className={role === 'specialist' && sectionKey === 'dashboard' ? 'role-generic-hidden' : undefined}>
        <div className="role-heading"><div><span className="eyebrow">{role === 'admin' ? 'Quản trị nền tảng' : 'Không gian chuyên gia'}</span><h1>{section.label}</h1><p>{section.description}</p></div><button className="btn-primary" onClick={() => setToast('Biểu mẫu tạo mới đã sẵn sàng để kết nối API.')}>+ Tạo mới</button></div>
        {sectionKey === 'dashboard' && <div className="role-stat-grid">{section.rows.map((row,index) => <button key={row.id} className="role-stat" onClick={() => setSelected(row)}><small>{row.status}</small><strong>{row.title}</strong><span>{row.meta}</span><i style={{'--value': `${72-index*12}%`} as React.CSSProperties} /></button>)}</div>}
        <section className="role-panel">
          {section.tabs && <div className="role-tabs" role="tablist">{section.tabs.map(tab => <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>}
          <div className="role-toolbar"><label><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm trong danh sách..." /></label><button className="btn-outline">Bộ lọc</button><button className="btn-ghost">Xuất dữ liệu</button></div>
          <div className="role-list" aria-live="polite">
            {visibleRows.length ? visibleRows.map(row => <button className="role-row" key={row.id} onClick={() => setSelected(row)}><span className="role-row-icon">{row.title.charAt(0)}</span><span className="role-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className={`role-status ${statusClass(row.status)}`}>{row.status}</span><span className="role-arrow">→</span></button>) : <div className="role-empty"><span>⌕</span><h3>Không tìm thấy kết quả</h3><p>Thử thay đổi từ khóa hoặc bộ lọc đang chọn.</p><button className="btn-outline" onClick={() => setQuery('')}>Xóa bộ lọc</button></div>}
          </div>
        </section>
        {/clients|follow-up/.test(sectionKey) && <div className="role-disclaimer"><strong>{sectionKey === 'clients' ? 'Access granted by user' : 'Lưu ý chuyên môn'}</strong><p>{sectionKey === 'clients' ? 'Chỉ dữ liệu nằm trong phạm vi đồng ý hiện hành mới được hiển thị. Quyền truy cập có thể bị thu hồi bất kỳ lúc nào.' : 'Kết quả assessment và phân tích AI chỉ mang tính hỗ trợ theo dõi, không thay thế chẩn đoán chuyên môn.'}</p></div>}
        </div>
      </div>
    </main>
    {mobileOpen && <button className="role-overlay" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
    {selected && <><button className="role-drawer-backdrop" aria-label="Đóng chi tiết" onClick={() => setSelected(null)} /><aside className="role-drawer" aria-label="Chi tiết"><div className="role-drawer-head"><div><small>CHI TIẾT · {selected.id.toUpperCase()}</small><h2>{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="Đóng">×</button></div><span className={`role-status ${statusClass(selected.status)}`}>{selected.status}</span><p className="role-detail-meta">{selected.meta}</p><div className="role-detail-block"><h3>Thông tin</h3><p>{selected.detail}</p></div>{sectionKey === 'clients' && <div className="role-consent">✓ Access granted by user</div>}<div className="role-detail-block"><h3>Dòng thời gian</h3><ul><li><i />Cập nhật gần nhất · Hôm nay, 14:30</li><li><i />Được tạo trên MentalBridge · 12/08/2026</li></ul></div><div className="role-drawer-actions"><button className="btn-primary" onClick={() => setToast('Đã lưu cập nhật thành công.')}>Cập nhật</button>{showAction(selected, role === 'admin' ? 'Xử lý' : 'Hủy lịch') && <button className="btn-outline danger" onClick={() => setConfirmAction(role === 'admin' ? 'Xác nhận thao tác quản trị' : 'Xác nhận hủy lịch')}>{role === 'admin' ? 'Thao tác khác' : 'Hủy lịch'}</button>}</div></aside></>}
    {confirmAction && <div className="role-modal-wrap"><button className="role-drawer-backdrop" aria-label="Đóng xác nhận" onClick={() => setConfirmAction(null)} /><div className="role-modal"><span className="role-modal-icon">!</span><h2>{confirmAction}</h2><p>Thao tác này có thể ảnh hưởng đến dữ liệu hoặc quyền truy cập. Vui lòng kiểm tra kỹ trước khi tiếp tục.</p><div><button className="btn-ghost" onClick={() => setConfirmAction(null)}>Quay lại</button><button className="btn-primary" onClick={finishAction}>Xác nhận</button></div></div></div>}
    {toast && <div className="role-toast"><span>✓</span>{toast}</div>}
  </div>
}
