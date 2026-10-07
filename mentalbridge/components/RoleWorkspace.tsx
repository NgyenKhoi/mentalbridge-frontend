'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import SessionActions from '@/features/auth/components/SessionActions'
import WorkspaceSwitcher from '@/features/auth/components/WorkspaceSwitcher'
import type { Workspace } from '@/features/auth/model/workspace'
import SpecialistProfileWorkspace from '@/features/specialist-profile/components/SpecialistProfileWorkspace'
import SpecialistAvailabilityManager from '@/features/specialist-availability/components/SpecialistAvailabilityManager'
import SpecialistAppointmentDecisionPanel from '@/features/appointments/components/SpecialistAppointmentDecisionPanel'
import AppointmentMessagesWorkspace from '@/features/appointments/components/AppointmentMessagesWorkspace'
import SpecialistContinuityManager from '@/features/appointments/components/SpecialistContinuityManager'
import SpecialistOperationalAnalytics from '@/features/specialist-analytics/components/SpecialistOperationalAnalytics'
import SpecialistDashboardManager from './SpecialistDashboardManager'
import SpecialistClientsManager from './SpecialistClientsManager'
import SpecialistEarningsManager from './SpecialistEarningsManager'
import SpecialistDeferredSection, {
  type SpecialistDeferredSectionKey,
} from './SpecialistDeferredSection'
import SpecialistWorkspaceIdentity from './SpecialistWorkspaceIdentity'
import AdminUsersManager from './AdminUsersManager'
import AdminSpecialistReviewSection from '@/features/specialist-profile/components/AdminSpecialistReviewSection'
import AdminAssessmentsManager from './AdminAssessmentsManager'
import AdminContentManager from './AdminContentManager'
import AdminReportsManager from './AdminReportsManager'
import AdminPaymentsManager from './AdminPaymentsManager'
import AdminDashboardManager from './AdminDashboardManager'
import AdminPayoutsManager from './AdminPayoutsManager'
import AdminModerationManager from './AdminModerationManager'
import AdminAppointmentsManager from './AdminAppointmentsManager'
import './role-workspace.css'

type Role = 'specialist' | 'admin'
type Row = { id: string; title: string; meta: string; status: string; detail: string }
type Section = { label: string; description: string; rows: Row[]; tabs?: string[] }

const specialistSections = {
  dashboard: 'Tổng quan',
  analytics: 'Phân tích vận hành',
  appointments: 'Lịch hẹn',
  availability: 'Lịch khả dụng',
  clients: 'Khách hàng',
  messages: 'Tin nhắn',
  'follow-up': 'Sau tư vấn',
  profile: 'Hồ sơ',
  earnings: 'Thu nhập & thanh toán',
  notifications: 'Thông báo',
} as const
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
  assessments: { label: 'Quản lý bài đánh giá', description: 'Quản lý bộ câu hỏi, phiên bản và trạng thái phát hành.', rows: [
    { id: 'as1', title: 'PHQ-9 · phq9-vi-vn-capstone-v1', meta: '9 câu hỏi · Đang hiển thị', status: 'Đã xuất bản', detail: 'Bộ câu hỏi sàng lọc được Care quản lý theo phiên bản, nguồn và quy trình publication gate.' },
    { id: 'as2', title: 'DASS-21 · phiên bản 0.9', meta: '21 câu hỏi · Chưa công khai', status: 'Bản nháp', detail: 'Bản nháp chưa hiển thị với người dùng và cần hoàn thành kiểm tra an toàn trước khi phát hành.' },
  ], tabs: ['Tất cả', 'Đã xuất bản', 'Bản nháp', 'Đang rà soát'] },
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
  content: { label: 'Tài nguyên tự chăm sóc', description: 'Quản lý nội dung đã được rà soát trước khi công bố.', rows: [
    { id: 'ct1', title: 'Bài tập thở 4–7–8', meta: 'Danh mục: Thở · Cập nhật 12/08', status: 'Đã xuất bản', detail: 'Nội dung tự chăm sóc, không thay thế tư vấn hoặc điều trị chuyên môn.' },
  ], tabs: ['Tài nguyên'] },
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
  specialist: [['dashboard','Tổng quan'],['analytics','Phân tích vận hành'],['appointments','Lịch hẹn'],['availability','Lịch khả dụng'],['clients','Khách hàng'],['messages','Tin nhắn'],['follow-up','Sau tư vấn'],['earnings','Thu nhập & thanh toán'],['profile','Hồ sơ']],
  admin: [['dashboard','Dashboard'],['users','Users'],['specialists','Specialists'],['assessments','Assessments'],['payments','Subscriptions & Payments'],['payouts','Payouts'],['appointments','Appointments'],['content','Content'],['moderation','Moderation'],['ai','AI Evaluation'],['reports','Reports'],['audit','Audit & Privacy']],
} as const

const navIcons: Record<string, string> = { dashboard: '⌂', analytics: '⌁', appointments: '◷', availability: '▦', clients: '♙', messages: '◇', 'follow-up': '✓', earnings: '◈', notifications: '♢', profile: '○', users: '♙', specialists: '✦', assessments: '✓', payments: '▤', payouts: '↗', content: '▣', moderation: '◉', ai: '✧', reports: '⌁', audit: '◎' }

const statusClass = (status: string) => /hoàn thành|thành công|hoạt động|đã duyệt|khả dụng|sẵn sàng|xuất bản|cấp quyền|xác nhận/i.test(status) ? 'ok' : /chờ|cần|thất bại|tạm khóa|ẩn/i.test(status) ? 'attention' : 'neutral'

export default function RoleWorkspace({
  role,
  sectionKey,
  workspaces,
  selectedAppointmentId,
}: {
  role: Role
  sectionKey: string
  workspaces: readonly Workspace[]
  selectedAppointmentId?: string
}) {
  const section = role === 'specialist'
    ? { label: specialistSections[sectionKey as keyof typeof specialistSections] ?? specialistSections.dashboard, description: '', rows: [] }
    : adminSections[sectionKey] || adminSections.dashboard
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
  return <div className={`role-shell role-${role} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <motion.aside className={`role-sidebar ${mobileOpen ? 'open' : ''}`} layout initial={false} transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}>
      <Link href="/" className="role-brand"><motion.span className="role-brand-mark" whileHover={{ rotate: -6, scale: 1.06 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>M</motion.span><span className="role-brand-copy"><strong>MentalBridge</strong><small>{role === 'admin' ? 'Admin Console' : 'Specialist Workspace'}</small></span></Link>
      <button className="role-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}><motion.span animate={{ rotate: sidebarCollapsed ? 180 : 0 }}>‹</motion.span></button>
      <nav aria-label={`Điều hướng ${role}`}>
        {navByRole[role].map(([key,label]) => <div key={key} className="role-nav-item"><Link href={`/${role}/${key}`} className={key === sectionKey ? 'active' : ''} onClick={() => setMobileOpen(false)} title={sidebarCollapsed ? label : undefined}>{key === sectionKey && <motion.span layoutId={`role-active-${role}`} className="role-active-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}<span className="role-nav-icon" aria-hidden="true">{navIcons[key] || '·'}</span><span className="role-nav-label">{label}</span></Link></div>)}
      </nav>
      <WorkspaceSwitcher workspaces={workspaces} currentRole={role === 'admin' ? 'ADMIN' : 'SPECIALIST'} />
      {role === 'specialist' ? <SpecialistWorkspaceIdentity /> : <motion.div className="role-user" whileHover={{ y: -2 }}><span>AD</span><div className="role-user-copy"><strong>Quản trị viên</strong><small>System admin</small></div><span className="role-online" /></motion.div>}
      <SessionActions compact={sidebarCollapsed} />
    </motion.aside>
    <motion.main className="role-main" layout="position" transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}>
      <header className="role-topbar"><button className="role-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Mở menu">☰</button><div>{role === 'specialist' ? <><span className="role-live-dot" />{section.label}</> : <><span className="role-live-dot" /> Hệ thống hoạt động ổn định</>}</div>{role === 'admin' && <Link href="/admin/notifications" className="role-bell" aria-label="Thông báo">○</Link>}</header>
      <div className={`role-content${role === 'specialist' && sectionKey === 'messages' ? ' role-content-messages' : ''}`}>
        {role === 'specialist' && sectionKey === 'dashboard' && <SpecialistDashboardManager />}
        {role === 'specialist' && sectionKey === 'analytics' && <SpecialistOperationalAnalytics />}
        {role === 'specialist' && sectionKey === 'profile' && <SpecialistProfileWorkspace />}
        {role === 'specialist' && sectionKey === 'availability' && <SpecialistAvailabilityManager />}
        {role === 'specialist' && sectionKey === 'appointments' && <SpecialistAppointmentDecisionPanel />}
        {role === 'specialist' && sectionKey === 'clients' && <SpecialistClientsManager initialAppointmentId={selectedAppointmentId} />}
        {role === 'specialist' && sectionKey === 'messages' && <AppointmentMessagesWorkspace viewerRole="SPECIALIST" initialAppointmentId={selectedAppointmentId} />}
        {role === 'specialist' && sectionKey === 'follow-up' && <SpecialistContinuityManager />}
		{role === 'specialist' && sectionKey === 'earnings' && <SpecialistEarningsManager />}
		{role === 'specialist' && sectionKey === 'notifications' && <SpecialistDeferredSection section={sectionKey as SpecialistDeferredSectionKey} />}
        {role === 'admin' && sectionKey === 'users' && <AdminUsersManager onSelect={setSelected} onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'specialists' && <AdminSpecialistReviewSection />}
        {role === 'admin' && sectionKey === 'assessments' && <AdminAssessmentsManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'content' && <AdminContentManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'reports' && <AdminReportsManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'payments' && <AdminPaymentsManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'dashboard' && <AdminDashboardManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'payouts' && <AdminPayoutsManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'moderation' && <AdminModerationManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && sectionKey === 'appointments' && <AdminAppointmentsManager onNotice={message => { setToast(message); window.setTimeout(() => setToast(''), 3200) }} />}
        {role === 'admin' && <div className={`role-generic ${sectionKey === 'dashboard' || sectionKey === 'users' || sectionKey === 'specialists' || sectionKey === 'assessments' || sectionKey === 'content' || sectionKey === 'reports' || sectionKey === 'payments' || sectionKey === 'payouts' || sectionKey === 'moderation' || sectionKey === 'appointments' ? 'role-generic-hidden' : ''}`}>
        <div className="role-heading"><div><span className="eyebrow">{role === 'admin' ? 'Quản trị nền tảng' : 'Không gian chuyên gia'}</span><h1>{section.label}</h1><p>{section.description}</p></div><button className="btn-primary" onClick={() => {
          setToast('Biểu mẫu tạo mới đã sẵn sàng để kết nối API.')
        }}>+ Tạo mới</button></div>
        {sectionKey === 'dashboard' && <div className="role-stat-grid">{section.rows.map((row,index) => <button key={row.id} className="role-stat" onClick={() => setSelected(row)}><small>{row.status}</small><strong>{row.title}</strong><span>{row.meta}</span><i style={{'--value': `${72-index*12}%`} as React.CSSProperties} /></button>)}</div>}
        <section className="role-panel">
          {section.tabs && <div className="role-tabs" role="tablist">{section.tabs.map(tab => <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>}
          <div className="role-toolbar"><label><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm trong danh sách..." /></label><button className="btn-outline">Bộ lọc</button><button className="btn-ghost">Xuất dữ liệu</button></div>
          <div className="role-list" aria-live="polite">
            {visibleRows.length ? visibleRows.map(row => <button className="role-row" key={row.id} onClick={() => setSelected(row)}><span className="role-row-icon">{row.title.charAt(0)}</span><span className="role-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className={`role-status ${statusClass(row.status)}`}>{row.status}</span><span className="role-arrow">→</span></button>) : <div className="role-empty"><span>⌕</span><h3>Không tìm thấy kết quả</h3><p>Thử thay đổi từ khóa hoặc bộ lọc đang chọn.</p><button className="btn-outline" onClick={() => setQuery('')}>Xóa bộ lọc</button></div>}
          </div>
        </section>
        {/clients|follow-up/.test(sectionKey) && <div className="role-disclaimer"><strong>{sectionKey === 'clients' ? 'Access granted by user' : 'Lưu ý chuyên môn'}</strong><p>{sectionKey === 'clients' ? 'Chỉ dữ liệu nằm trong phạm vi đồng ý hiện hành mới được hiển thị. Quyền truy cập có thể bị thu hồi bất kỳ lúc nào.' : 'Kết quả assessment và phân tích AI chỉ mang tính hỗ trợ theo dõi, không thay thế chẩn đoán chuyên môn.'}</p></div>}
        </div>}
      </div>
    </motion.main>
    {mobileOpen && <button className="role-overlay" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
    {selected && <><button className="role-drawer-backdrop" aria-label="Đóng chi tiết" onClick={() => setSelected(null)} /><aside className="role-drawer" aria-label="Chi tiết"><div className="role-drawer-head"><div><small>CHI TIẾT · {selected.id.toUpperCase()}</small><h2>{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="Đóng">×</button></div><span className={`role-status ${statusClass(selected.status)}`}>{selected.status}</span><p className="role-detail-meta">{selected.meta}</p><div className="role-detail-block"><h3>Thông tin</h3><p>{selected.detail}</p></div>{sectionKey === 'clients' && <div className="role-consent">✓ Access granted by user</div>}<div className="role-detail-block"><h3>Dòng thời gian</h3><ul><li><i />Cập nhật gần nhất · Hôm nay, 14:30</li><li><i />Được tạo trên MentalBridge · 12/08/2026</li></ul></div><div className="role-drawer-actions"><button className="btn-primary" onClick={() => setToast('Đã lưu cập nhật thành công.')}>Cập nhật</button>{showAction(selected, role === 'admin' ? 'Xử lý' : 'Hủy lịch') && <button className="btn-outline danger" onClick={() => setConfirmAction(role === 'admin' ? 'Xác nhận thao tác quản trị' : 'Xác nhận hủy lịch')}>{role === 'admin' ? 'Thao tác khác' : 'Hủy lịch'}</button>}</div></aside></>}
    {confirmAction && <div className="role-modal-wrap"><button className="role-drawer-backdrop" aria-label="Đóng xác nhận" onClick={() => setConfirmAction(null)} /><div className="role-modal"><span className="role-modal-icon">!</span><h2>{confirmAction}</h2><p>Thao tác này có thể ảnh hưởng đến dữ liệu hoặc quyền truy cập. Vui lòng kiểm tra kỹ trước khi tiếp tục.</p><div><button className="btn-ghost" onClick={() => setConfirmAction(null)}>Quay lại</button><button className="btn-primary" onClick={finishAction}>Xác nhận</button></div></div></div>}
    {toast && <div className="role-toast"><span>✓</span>{toast}</div>}
  </div>
}
