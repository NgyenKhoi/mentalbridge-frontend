'use client'

import { useMemo, useState } from 'react'
import './specialist-profile-manager.css'

type ProfileTab = 'information' | 'expertise' | 'consultation'

type ProfileState = {
  name: string
  title: string
  experience: string
  location: string
  bio: string
  approach: string
  languages: string[]
  specialties: string[]
  certificates: string[]
  formats: string[]
  price: string
  duration: string
  responseTime: string
  address: string
  acceptingClients: boolean
}

const initialProfile: ProfileState = {
  name: 'ThS. Nguyễn Thu Hà',
  title: 'Chuyên gia tâm lý lâm sàng',
  experience: '8',
  location: 'Hà Nội',
  bio: 'Tôi đồng hành cùng người trưởng thành đang trải qua lo âu, trầm cảm và những giai đoạn chuyển tiếp khó khăn. Mỗi phiên tư vấn được xây dựng như một không gian an toàn, tôn trọng nhịp độ và câu chuyện riêng của bạn.',
  approach: 'Kết hợp trị liệu nhận thức hành vi (CBT), chánh niệm và phỏng vấn tạo động lực. Chúng ta sẽ cùng nhận diện khuôn mẫu đang gây khó khăn, thử những thay đổi nhỏ và theo dõi điều thực sự có ích trong đời sống hằng ngày.',
  languages: ['Tiếng Việt', 'English'],
  specialties: ['Trầm cảm', 'Lo âu', 'Stress', 'Giấc ngủ'],
  certificates: [
    'Thạc sĩ Tâm lý học lâm sàng — Đại học Quốc gia Hà Nội',
    'Chứng nhận Trị liệu nhận thức hành vi nâng cao',
    'Thành viên Hội Tâm lý trị liệu Việt Nam',
  ],
  formats: ['Video call', 'Tại phòng tư vấn'],
  price: '500000',
  duration: '60',
  responseTime: 'Trong vòng 24 giờ',
  address: 'Cầu Giấy, Hà Nội',
  acceptingClients: true,
}

const tabs: { id: ProfileTab; label: string; description: string }[] = [
  { id: 'information', label: 'Thông tin công khai', description: 'Tên, giới thiệu và ngôn ngữ' },
  { id: 'expertise', label: 'Chuyên môn', description: 'Lĩnh vực và chứng chỉ' },
  { id: 'consultation', label: 'Thiết lập tư vấn', description: 'Hình thức, thời lượng và phí' },
]

const specialtyOptions = ['Trầm cảm', 'Lo âu', 'Stress', 'Giấc ngủ', 'Mối quan hệ', 'CBT']
const languageOptions = ['Tiếng Việt', 'English', 'Français']
const formatOptions = ['Video call', 'Tại phòng tư vấn', 'Điện thoại']

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className={`sp-toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>
}

export default function SpecialistProfileManager() {
  const [profile, setProfile] = useState<ProfileState>(initialProfile)
  const [activeTab, setActiveTab] = useState<ProfileTab>('information')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [certificateDraft, setCertificateDraft] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const completion = useMemo(() => {
    const fields = [profile.name, profile.title, profile.experience, profile.location, profile.bio, profile.approach, profile.price, profile.duration]
    const completed = fields.filter(Boolean).length + Number(profile.specialties.length > 0) + Number(profile.certificates.length > 0) + Number(profile.formats.length > 0)
    return Math.round((completed / 11) * 100)
  }, [profile])

  const update = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
    setProfile(current => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const toggleArrayValue = (key: 'languages' | 'specialties' | 'formats', value: string) => {
    const next = profile[key].includes(value) ? profile[key].filter(item => item !== value) : [...profile[key], value]
    update(key, next)
  }

  const addCertificate = () => {
    const value = certificateDraft.trim()
    if (!value) return
    update('certificates', [...profile.certificates, value])
    setCertificateDraft('')
  }

  const save = () => {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      setDirty(false)
      setNotice('Đã lưu thay đổi hồ sơ.')
      window.setTimeout(() => setNotice(''), 2600)
    }, 700)
  }

  const reset = () => {
    setProfile(initialProfile)
    setDirty(false)
    setCertificateDraft('')
  }

  const fee = Number(profile.price || 0).toLocaleString('vi-VN')

  return <section className="sp-manager">
    <header className="sp-heading">
      <div>
        <span className="sp-eyebrow">Hồ sơ chuyên gia</span>
        <h1>Hồ sơ nghề nghiệp của bạn</h1>
        <p>Quản lý thông tin khách hàng nhìn thấy trước khi lựa chọn và đặt lịch tư vấn với bạn.</p>
      </div>
      <button type="button" className="sp-preview-button" onClick={() => setPreviewOpen(true)}><span aria-hidden="true">◉</span> Xem hồ sơ công khai</button>
    </header>

    <div className="sp-identity">
      <div className="sp-avatar" aria-label="Ảnh đại diện hiện tại">TH<span title="Đã xác minh">✓</span></div>
      <div className="sp-identity-copy">
        <div className="sp-name-line"><h2>{profile.name}</h2><span className="sp-verified">Đã xác minh</span></div>
        <p>{profile.title} <i /> {profile.experience || '0'} năm kinh nghiệm</p>
        <button type="button" className="sp-text-button" onClick={() => setNotice('Tính năng tải ảnh sẽ được kết nối với API hồ sơ.')}>Thay ảnh đại diện</button>
      </div>
      <div className="sp-completion">
        <div><span>Mức hoàn thiện hồ sơ</span><strong>{completion}%</strong></div>
        <div className="sp-progress"><i style={{ width: `${completion}%` }} /></div>
        <small>Hồ sơ đầy đủ giúp khách hàng hiểu và tin tưởng bạn hơn.</small>
      </div>
      <div className="sp-availability">
        <Toggle checked={profile.acceptingClients} onChange={() => update('acceptingClients', !profile.acceptingClients)} label="Nhận khách hàng mới" />
        <div><strong>{profile.acceptingClients ? 'Đang nhận khách mới' : 'Tạm dừng nhận khách'}</strong><small>Hiển thị trên hồ sơ công khai</small></div>
      </div>
    </div>

    <div className="sp-workspace">
      <div className="sp-editor">
        <nav className="sp-tabs" aria-label="Các phần hồ sơ">
          {tabs.map((tab, index) => <button type="button" key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}><span>0{index + 1}</span><div><strong>{tab.label}</strong><small>{tab.description}</small></div></button>)}
        </nav>

        <div className="sp-form">
          {activeTab === 'information' && <>
            <div className="sp-section-head"><div><span>01</span><h2>Thông tin công khai</h2></div><p>Các thông tin này xuất hiện trên trang tìm kiếm và hồ sơ chuyên gia.</p></div>
            <div className="sp-fields two-columns">
              <label><span>Họ tên hiển thị</span><input value={profile.name} onChange={event => update('name', event.target.value)} /></label>
              <label><span>Chức danh chuyên môn</span><input value={profile.title} onChange={event => update('title', event.target.value)} /></label>
              <label><span>Số năm kinh nghiệm</span><input type="number" min="0" value={profile.experience} onChange={event => update('experience', event.target.value)} /></label>
              <label><span>Khu vực tư vấn</span><input value={profile.location} onChange={event => update('location', event.target.value)} /></label>
            </div>
            <label className="sp-textarea"><span>Giới thiệu bản thân</span><textarea rows={5} maxLength={700} value={profile.bio} onChange={event => update('bio', event.target.value)} /><small>{profile.bio.length}/700 ký tự</small></label>
            <fieldset className="sp-choice-group"><legend>Ngôn ngữ tư vấn</legend><div>{languageOptions.map(language => <button type="button" key={language} className={profile.languages.includes(language) ? 'is-selected' : ''} onClick={() => toggleArrayValue('languages', language)}><span>{profile.languages.includes(language) ? '✓' : '+'}</span>{language}</button>)}</div></fieldset>
          </>}

          {activeTab === 'expertise' && <>
            <div className="sp-section-head"><div><span>02</span><h2>Chuyên môn &amp; chứng chỉ</h2></div><p>Chọn đúng thế mạnh để khách hàng phù hợp dễ dàng tìm thấy bạn.</p></div>
            <fieldset className="sp-choice-group"><legend>Lĩnh vực đồng hành</legend><div>{specialtyOptions.map(item => <button type="button" key={item} className={profile.specialties.includes(item) ? 'is-selected' : ''} onClick={() => toggleArrayValue('specialties', item)}><span>{profile.specialties.includes(item) ? '✓' : '+'}</span>{item}</button>)}</div></fieldset>
            <label className="sp-textarea"><span>Phương pháp đồng hành</span><textarea rows={5} value={profile.approach} onChange={event => update('approach', event.target.value)} /></label>
            <div className="sp-certificates"><div className="sp-field-title"><span>Đào tạo &amp; chứng chỉ</span><small>Chỉ thêm thông tin có thể xác minh</small></div>{profile.certificates.map((certificate, index) => <div className="sp-certificate" key={`${certificate}-${index}`}><span>✓</span><p>{certificate}</p><button type="button" aria-label={`Xóa ${certificate}`} onClick={() => update('certificates', profile.certificates.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<div className="sp-add-certificate"><input value={certificateDraft} onChange={event => setCertificateDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCertificate() } }} placeholder="Tên bằng cấp hoặc chứng chỉ..." /><button type="button" onClick={addCertificate}>+ Thêm</button></div></div>
          </>}

          {activeTab === 'consultation' && <>
            <div className="sp-section-head"><div><span>03</span><h2>Thiết lập tư vấn</h2></div><p>Thiết lập thông tin dịch vụ hiển thị khi khách hàng chuẩn bị đặt lịch.</p></div>
            <fieldset className="sp-format-list"><legend>Hình thức tư vấn</legend>{formatOptions.map(format => <div key={format}><span className="sp-format-icon" aria-hidden="true">{format === 'Video call' ? '▣' : format === 'Điện thoại' ? '⌕' : '⌂'}</span><div><strong>{format}</strong><small>{format === 'Video call' ? 'Tư vấn trực tuyến trên MentalBridge' : format === 'Điện thoại' ? 'Trao đổi bằng cuộc gọi thoại' : 'Gặp trực tiếp tại địa điểm của bạn'}</small></div><Toggle checked={profile.formats.includes(format)} onChange={() => toggleArrayValue('formats', format)} label={format} /></div>)}</fieldset>
            <div className="sp-fields two-columns">
              <label><span>Phí tư vấn mỗi phiên</span><div className="sp-input-suffix"><input type="number" min="0" step="50000" value={profile.price} onChange={event => update('price', event.target.value)} /><b>VNĐ</b></div></label>
              <label><span>Thời lượng mặc định</span><select value={profile.duration} onChange={event => update('duration', event.target.value)}><option value="30">30 phút</option><option value="45">45 phút</option><option value="60">60 phút</option><option value="90">90 phút</option></select></label>
              <label><span>Thời gian phản hồi</span><select value={profile.responseTime} onChange={event => update('responseTime', event.target.value)}><option>Trong vòng 12 giờ</option><option>Trong vòng 24 giờ</option><option>Trong vòng 48 giờ</option></select></label>
              <label><span>Địa điểm tư vấn</span><input value={profile.address} onChange={event => update('address', event.target.value)} disabled={!profile.formats.includes('Tại phòng tư vấn')} /></label>
            </div>
          </>}
        </div>
      </div>

      <aside className="sp-public-summary">
        <div className="sp-summary-label"><span>Bản xem trước</span><i className={profile.acceptingClients ? 'is-online' : ''}>{profile.acceptingClients ? 'Đang nhận lịch' : 'Tạm dừng'}</i></div>
        <div className="sp-public-avatar">TH<span>✓</span></div>
        <h2>{profile.name || 'Tên chuyên gia'}</h2>
        <p className="sp-public-title">{profile.title || 'Chức danh chuyên môn'}</p>
        <div className="sp-public-meta"><span>{profile.experience || '0'} năm kinh nghiệm</span><span>{profile.location || 'Chưa cập nhật'}</span></div>
        <div className="sp-public-tags">{profile.specialties.slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>
        <p className="sp-public-bio">{profile.bio}</p>
        <dl><div><dt>Ngôn ngữ</dt><dd>{profile.languages.join(', ') || 'Chưa cập nhật'}</dd></div><div><dt>Hình thức</dt><dd>{profile.formats.join(' · ') || 'Chưa cập nhật'}</dd></div><div><dt>Phí tư vấn từ</dt><dd>{fee}đ / {profile.duration} phút</dd></div></dl>
        <button type="button" disabled={!profile.acceptingClients}>Đặt lịch tư vấn <span>→</span></button>
        <small className="sp-preview-note">Thay đổi chỉ xuất hiện với khách hàng sau khi bạn lưu hồ sơ.</small>
      </aside>
    </div>

    <footer className={`sp-savebar ${dirty ? 'has-changes' : ''}`}><div><span>{dirty ? '● Có thay đổi chưa lưu' : '✓ Mọi thay đổi đã được lưu'}</span><small>Cập nhật lần cuối hôm nay, 09:42</small></div><div><button type="button" className="sp-cancel" disabled={!dirty || saving} onClick={reset}>Hủy thay đổi</button><button type="button" className="sp-save" disabled={!dirty || saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></footer>

    {previewOpen && <div className="sp-modal" role="dialog" aria-modal="true" aria-label="Xem trước hồ sơ công khai"><button className="sp-modal-backdrop" aria-label="Đóng" onClick={() => setPreviewOpen(false)} /><div className="sp-modal-content"><button className="sp-modal-close" aria-label="Đóng" onClick={() => setPreviewOpen(false)}>×</button><span className="sp-modal-kicker">HỒ SƠ CÔNG KHAI · BẢN XEM TRƯỚC</span><div className="sp-modal-profile"><div className="sp-public-avatar">TH<span>✓</span></div><div><h2>{profile.name}</h2><p>{profile.title}</p><div className="sp-public-tags">{profile.specialties.map(item => <span key={item}>{item}</span>)}</div></div></div><div className="sp-modal-stats"><div><small>Kinh nghiệm</small><strong>{profile.experience} năm</strong></div><div><small>Hình thức</small><strong>{profile.formats.length} lựa chọn</strong></div><div><small>Phí từ</small><strong>{fee}đ</strong></div></div><h3>Giới thiệu</h3><p>{profile.bio}</p><h3>Phương pháp đồng hành</h3><p>{profile.approach}</p></div></div>}
    {notice && <div className="sp-notice"><span>✓</span>{notice}</div>}
  </section>
}
