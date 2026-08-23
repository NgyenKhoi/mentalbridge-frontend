'use client'

import Link from 'next/link'
import { useState } from 'react'
import LightSelect from '@/components/LightSelect'
import './profile.css'

type Panel = 'personal' | 'security' | 'privacy' | null

export default function ProfilePage() {
  const [openPanel, setOpenPanel] = useState<Panel>('personal')
  const [twoFactor, setTwoFactor] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }

  return <div className="settings-page">
    <header className="settings-hero"><span>Tài khoản của bạn</span><h1>Cài đặt</h1><p>Quản lý hồ sơ, quyền riêng tư và tùy chỉnh trải nghiệm của bạn.</p></header>

    <section className="settings-profile-summary">
      <div className="settings-summary-left"><div className="settings-avatar-wrap"><svg viewBox="0 0 110 56" aria-hidden="true"><path d="M10 48Q55-4 100 48"/></svg><div className="settings-avatar">NA</div></div><div><div className="settings-name-row"><h2>Nguyễn Văn A</h2><span>FREE</span></div><p>user@example.com</p><div className="settings-badges"><span className="verified">✓ Đã xác minh</span><span className="streak">↗ 12 ngày liên tiếp</span></div></div></div>
      <div className="settings-summary-actions"><button className="btn-outline" onClick={() => setOpenPanel('personal')}>Chỉnh sửa hồ sơ</button><Link href="/subscription" className="settings-upgrade">✦ Nâng cấp Pro</Link></div>
    </section>

    <div className="settings-grid">
      <section className="settings-group"><p className="settings-group-label">Tài khoản & quyền riêng tư</p>
        <div className={`settings-accordion ${openPanel === 'personal' ? 'open' : ''}`}><button className="settings-accordion-head" onClick={() => setOpenPanel(openPanel === 'personal' ? null : 'personal')} aria-expanded={openPanel === 'personal'}><span className="settings-row-icon teal">N</span><span><strong>Thông tin cá nhân</strong><small>Tên, email, số điện thoại và ngày sinh</small></span><b>›</b></button><div className="settings-accordion-body"><form onSubmit={e => { e.preventDefault(); notify('Đã lưu thông tin cá nhân.') }}><div className="settings-fields"><label className="full">Họ và tên<input defaultValue="Nguyễn Văn A" /></label><label className="full">Email<input type="email" defaultValue="user@example.com" /></label><label>Số điện thoại<input type="tel" defaultValue="0901234567" /></label><label>Ngày sinh<input type="date" defaultValue="1995-05-15" /></label><label>Giới tính<LightSelect id="profile-gender" defaultValue="male" options={[{value: 'male', label: 'Nam'}, {value: 'female', label: 'Nữ'}, {value: 'other', label: 'Khác'}]} /></label></div><div className="settings-form-actions"><button className="btn-primary">Lưu thay đổi</button><button type="button" className="btn-ghost" onClick={() => setOpenPanel(null)}>Hủy</button></div></form></div></div>

        <div className={`settings-accordion ${openPanel === 'security' ? 'open' : ''}`}><button className="settings-accordion-head" onClick={() => setOpenPanel(openPanel === 'security' ? null : 'security')} aria-expanded={openPanel === 'security'}><span className="settings-row-icon amber">⌾</span><span><strong>Bảo mật</strong><small>Mật khẩu và xác thực hai lớp</small></span><b>›</b></button><div className="settings-accordion-body"><div className="settings-security"><label>Mật khẩu hiện tại<input type="password" defaultValue="mentalbridge" /></label><div className="settings-toggle-row"><div><strong>Xác thực hai lớp</strong><small>Yêu cầu mã xác nhận trên thiết bị mới</small></div><label className="settings-switch"><input type="checkbox" checked={twoFactor} onChange={e => setTwoFactor(e.target.checked)} /><span /></label></div><button className="btn-primary" onClick={() => notify('Yêu cầu đổi mật khẩu đã được ghi nhận.')}>Đổi mật khẩu</button></div></div></div>

        <div className={`settings-accordion ${openPanel === 'privacy' ? 'open' : ''}`}><button className="settings-accordion-head" onClick={() => setOpenPanel(openPanel === 'privacy' ? null : 'privacy')} aria-expanded={openPanel === 'privacy'}><span className="settings-row-icon lavender">◉</span><span><strong>Quyền riêng tư & consent</strong><small>Kiểm soát specialist đang được xem dữ liệu nào</small></span><b>›</b></button><div className="settings-accordion-body"><div className="settings-consent"><div className="settings-consent-note"><strong>Bạn luôn kiểm soát dữ liệu của mình</strong><p>Specialist chỉ thấy đúng phạm vi bạn đã đồng ý và quyền có thể được thu hồi bất kỳ lúc nào.</p></div><article><div className="settings-consent-avatar">TH</div><div><strong>ThS. Nguyễn Thu Hà</strong><small>Access granted by user · Assessment và xu hướng cảm xúc</small></div><button onClick={() => setConfirm('Thu hồi quyền truy cập của ThS. Nguyễn Thu Hà?')}>Thu hồi</button></article><article><div className="settings-consent-avatar">MD</div><div><strong>TS. Trần Minh Đức</strong><small>Access granted by user · Follow-up plan</small></div><button onClick={() => setConfirm('Thu hồi quyền truy cập của TS. Trần Minh Đức?')}>Thu hồi</button></article></div></div></div>

        <div className="settings-verified-row"><span className="settings-row-icon teal">✓</span><div><strong>Xác minh email</strong><small>Email của bạn đã được xác minh</small></div><em>Đã xác minh</em></div>
      </section>

      <aside className="settings-activity"><h2>Hoạt động của bạn</h2><div>{[['↗','12','Streak nhật ký','amber'],['✓','8','Bài đánh giá','teal'],['♡','5','Buổi tư vấn','lavender'],['□','45','Nhật ký','terra']].map(([icon,value,label,tone]) => <article key={label}><span className={tone}>{icon}</span><strong>{value}</strong><small>{label}</small></article>)}</div></aside>
    </div>

    <section className="settings-preferences"><p className="settings-group-label">Tùy chỉnh</p><button><span className="settings-row-icon amber">☼</span><div><strong>Giao diện</strong><small>Chế độ hiển thị của ứng dụng</small></div><em>Chế độ sáng</em></button><button><span className="settings-row-icon teal">A</span><div><strong>Ngôn ngữ</strong><small>Ngôn ngữ hiển thị nội dung</small></div><em>Tiếng Việt ›</em></button></section>

    <section className="settings-safe"><h2>Thiết lập an toàn</h2><article><span className="settings-row-icon teal">♡</span><div><strong>Kế hoạch an toàn của bạn</strong><p>Chuẩn bị dấu hiệu cảnh báo, cách tự hỗ trợ và những người bạn có thể liên hệ khi cần.</p></div><button className="btn-outline" onClick={() => notify('Đã mở thiết lập kế hoạch an toàn.')}>Thiết lập hoặc cập nhật</button></article></section>

    <section className="settings-danger"><h2>Dữ liệu & tài khoản</h2><div><span className="settings-row-icon terra">!</span><div><strong>Yêu cầu xóa dữ liệu</strong><p>Gửi yêu cầu xóa dữ liệu và tài khoản MentalBridge. Một số bản ghi có thể được giữ theo nghĩa vụ pháp lý.</p></div><button onClick={() => setConfirm('Gửi yêu cầu xóa toàn bộ dữ liệu và tài khoản?')}>Yêu cầu xóa</button></div></section>

    {confirm && <div className="settings-modal-wrap"><button className="settings-modal-backdrop" onClick={() => setConfirm(null)} aria-label="Đóng"/><div className="settings-modal"><span>!</span><h2>{confirm}</h2><p>Hãy kiểm tra kỹ. Thao tác này ảnh hưởng đến quyền truy cập hoặc dữ liệu của bạn.</p><div><button className="btn-ghost" onClick={() => setConfirm(null)}>Quay lại</button><button className="btn-primary" onClick={() => { setConfirm(null); notify('Yêu cầu đã được ghi nhận.') }}>Xác nhận</button></div></div></div>}
    {toast && <div className="settings-toast">✓ {toast}</div>}
  </div>
}
