'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  getCommunityProfile,
  putCommunityProfile,
  type CommunityAvatarPreset,
  type CommunityProfile,
} from '@/features/community/api/browser-community'
import { ApiError } from '@/lib/api/api-error'
import CommunityAvatar from './CommunityAvatar'

const avatarOptions: ReadonlyArray<{
  value: CommunityAvatarPreset | null
  label: string
}> = [
  { value: null, label: 'Chữ cái tên' },
  { value: 'LEAF', label: 'Lá xanh' },
  { value: 'SUNRISE', label: 'Bình minh' },
  { value: 'WAVE', label: 'Gợn sóng' },
  { value: 'LOTUS', label: 'Hoa sen' },
  { value: 'CLOUD', label: 'Mây nhẹ' },
  { value: 'SPROUT', label: 'Mầm cây' },
]

function validDisplayName(value: string) {
  const length = [...value].length
  return (
    length >= 1 && length <= 80 && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
  )
}

export default function CommunityProfileSettings() {
  const { showActionToast } = useFeedback()
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarPreset, setAvatarPreset] =
    useState<CommunityAvatarPreset | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getCommunityProfile()
      .then((result) => {
        if (!active) return
        setProfile(result.data)
        setEtag(result.etag)
        setDisplayName(result.data.displayName)
        setAvatarPreset(result.data.avatarPreset)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (
          cause instanceof ApiError &&
          cause.code === 'COMMUNITY_PROFILE_NOT_FOUND'
        ) {
          setProfile(null)
          setEtag(null)
          setDisplayName('')
          setAvatarPreset(null)
        } else {
          setError('Thông tin hiển thị cộng đồng tạm thời chưa tải được.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = displayName.trim().normalize('NFC')
    if (!validDisplayName(normalizedName)) {
      setError('Tên hiển thị cần có từ 1 đến 80 ký tự an toàn.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await putCommunityProfile(
        { displayName: normalizedName, avatarPreset },
        etag,
      )
      setProfile(result.data)
      setEtag(result.etag)
      setDisplayName(result.data.displayName)
      setAvatarPreset(result.data.avatarPreset)
      showActionToast({
        title: 'Đã lưu danh tính cộng đồng',
        description: 'Bài viết sẽ hiển thị tên và hình đại diện bạn vừa chọn.',
      })
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.code === 'COMMUNITY_PROFILE_VERSION_REQUIRED' ||
          cause.code === 'COMMUNITY_PROFILE_VERSION_MISMATCH')
      ) {
        const latest = await getCommunityProfile()
        setProfile(latest.data)
        setEtag(latest.etag)
        setDisplayName(latest.data.displayName)
        setAvatarPreset(latest.data.avatarPreset)
        setError('Thông tin đã thay đổi ở nơi khác. Hãy kiểm tra và lưu lại.')
      } else {
        setError('Chưa thể lưu thông tin hiển thị. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="community-state" role="status" aria-busy="true">
        <h1>Đang tải danh tính cộng đồng…</h1>
      </section>
    )
  }

  return (
    <div className="community-profile-page">
      <Link className="community-back" href="/community">
        ← Trở về bảng tin
      </Link>
      <header className="community-profile-heading">
        <span>Danh tính riêng cho cộng đồng</span>
        <h1>Bạn muốn xuất hiện như thế nào?</h1>
        <p>
          Tên và hình đại diện ở đây độc lập với hồ sơ tài khoản và hồ sơ chăm
          sóc. Cộng đồng không hiển thị email hay mã tài khoản của bạn.
        </p>
      </header>

      <form className="community-profile-form" onSubmit={save}>
        <div
          className="community-profile-preview"
          aria-label="Xem trước danh tính"
        >
          <CommunityAvatar
            displayName={displayName.trim() || '?'}
            avatarPreset={avatarPreset}
          />
          <div>
            <span>Người khác sẽ thấy</span>
            <strong>{displayName.trim() || 'Tên hiển thị của bạn'}</strong>
          </div>
        </div>

        <div className="community-profile-field">
          <label htmlFor="community-display-name">
            Tên hiển thị hoặc biệt danh
          </label>
          <input
            id="community-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={160}
            autoComplete="off"
            required
            aria-describedby="community-name-help"
          />
          <small id="community-name-help">
            Tối đa 80 ký tự. Tránh dùng họ tên thật nếu bạn muốn giữ riêng tư.
          </small>
        </div>

        <fieldset>
          <legend>Hình đại diện an toàn</legend>
          <p>
            Chọn một biểu tượng có sẵn; cộng đồng không lấy ảnh từ hồ sơ khác.
          </p>
          <div className="community-avatar-options">
            {avatarOptions.map((option) => (
              <label key={option.value ?? 'INITIAL'}>
                <input
                  type="radio"
                  name="avatarPreset"
                  checked={avatarPreset === option.value}
                  onChange={() => setAvatarPreset(option.value)}
                />
                <CommunityAvatar
                  displayName={displayName.trim() || '?'}
                  avatarPreset={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <aside className="community-profile-privacy">
          <strong>Điều gì được công khai?</strong>
          <p>
            Chỉ mã hồ sơ cộng đồng, tên hiển thị và biểu tượng bạn chọn. Danh
            tính tài khoản chỉ được giữ kín để xác định quyền sở hữu, chặn và xử
            lý an toàn.
          </p>
        </aside>

        {error && (
          <p className="community-profile-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving}>
          {saving
            ? 'Đang lưu…'
            : profile
              ? 'Lưu thay đổi'
              : 'Tạo danh tính cộng đồng'}
        </button>
      </form>
    </div>
  )
}
