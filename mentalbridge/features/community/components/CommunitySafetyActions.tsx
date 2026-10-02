'use client'

import { useRef, useState } from 'react'
import {
  blockCommunityProfile,
  hideCommunityContent,
  reportCommunityContent,
  unblockCommunityProfile,
  type ReportReason,
  type ReportTargetType,
} from '@/features/community/api/browser-community'

const REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'HARASSMENT', label: 'Quấy rối hoặc công kích' },
  { value: 'PRIVACY_OR_DOXXING', label: 'Tiết lộ thông tin riêng tư' },
  { value: 'MEDICAL_MISINFORMATION', label: 'Thông tin y tế sai lệch' },
  {
    value: 'SELF_HARM_OR_CRISIS_CONCERN',
    label: 'Lo ngại tự làm hại hoặc khủng hoảng',
  },
  { value: 'SPAM', label: 'Nội dung rác' },
  {
    value: 'SEXUAL_OR_VIOLENT_CONTENT',
    label: 'Nội dung tình dục hoặc bạo lực',
  },
  { value: 'OTHER', label: 'Lý do khác' },
]

export default function CommunitySafetyActions({
  targetType,
  targetId,
  communityProfileId,
  onHidden,
}: Readonly<{
  targetType: ReportTargetType
  targetId: string
  communityProfileId: string | null
  onHidden?: () => void
}>) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('HARASSMENT')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [blocked, setBlocked] = useState(false)
  const command = useRef<{ signature: string; key: string } | null>(null)

  async function submitReport() {
    const normalized = details.trim()
    if ([...normalized].length > 1000) {
      setMessage('Mô tả không được vượt quá 1.000 ký tự.')
      return
    }
    const signature = JSON.stringify({
      targetType,
      targetId,
      reason,
      details: normalized || null,
    })
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() }
    setBusy(true)
    setMessage('')
    try {
      await reportCommunityContent(
        { targetType, targetId, reason, details: normalized || null },
        command.current.key,
      )
      command.current = null
      setOpen(false)
      setDetails('')
      setMessage('Báo cáo đã được gửi để đội ngũ kiểm duyệt xem xét.')
    } catch {
      setMessage('Chưa thể gửi báo cáo. Nội dung được giữ lại để bạn thử lại.')
    } finally {
      setBusy(false)
    }
  }

  async function hide() {
    setBusy(true)
    setMessage('')
    try {
      await hideCommunityContent(targetType, targetId)
      onHidden?.()
    } catch {
      setMessage('Chưa thể ẩn nội dung này. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  async function block() {
    if (!communityProfileId) return
    setBusy(true)
    setMessage('')
    try {
      if (blocked) {
        await unblockCommunityProfile(communityProfileId)
        setBlocked(false)
        setMessage('Đã bỏ chặn thành viên.')
      } else {
        await blockCommunityProfile(communityProfileId)
        setBlocked(true)
        setMessage(
          'Đã chặn thành viên. Nội dung của hai bên sẽ không còn hiển thị sau khi rời trang.',
        )
      }
    } catch {
      setMessage('Chưa thể chặn thành viên này. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="community-safety-actions">
      <div>
        <button type="button" disabled={busy} onClick={() => void hide()}>
          Ẩn
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          Báo cáo
        </button>
        {communityProfileId && (
          <button type="button" disabled={busy} onClick={() => void block()}>
            {blocked ? 'Bỏ chặn thành viên' : 'Chặn thành viên'}
          </button>
        )}
      </div>
      {open && (
        <div className="community-report-form">
          <label>
            Lý do
            <select
              value={reason}
              onChange={(event) => {
                setReason(event.target.value as ReportReason)
                command.current = null
              }}
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thông tin thêm (không bắt buộc)
            <textarea
              rows={3}
              maxLength={2000}
              value={details}
              onChange={(event) => {
                setDetails(event.target.value)
                command.current = null
              }}
            />
          </label>
          {reason === 'SELF_HARM_OR_CRISIS_CONCERN' && (
            <p>
              Đội ngũ sẽ ưu tiên xem xét nội dung. Nếu bạn hoặc ai đó cần hỗ trợ
              ngay, hãy mở mục “Cần hỗ trợ ngay”; báo cáo này không tự động liên
              hệ bên thứ ba.
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitReport()}
          >
            {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
