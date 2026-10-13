'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  getCommunityProfile,
  putCommunityProfile,
  type CommunityAvatarPreset,
  type CommunityProfile,
} from '@/features/community/api/browser-community'
import { ApiError } from '@/lib/api/api-error'
import CommunityAvatar from './CommunityAvatar'
import CommunityAvatarEditor from './CommunityAvatarEditor'
import { useCommunityProfileDraftGuard } from './useCommunityProfileDraftGuard'

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
  const nameInput = useRef<HTMLInputElement>(null)
  const { showActionToast } = useFeedback()
  const saveLock = useRef(false)
  const profileRef = useRef<CommunityProfile | null>(null)
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarPreset, setAvatarPreset] =
    useState<CommunityAvatarPreset | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [nameError, setNameError] = useState('')
  const [stale, setStale] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoDirty, setPhotoDirty] = useState(false)
  const dirty =
    photoDirty ||
    saving ||
    (profile
      ? displayName !== profile.displayName ||
        avatarPreset !== profile.avatarPreset
      : Boolean(displayName))

  useCommunityProfileDraftGuard(dirty)

  const commitPhoto = useCallback(
    (result: { data: CommunityProfile; etag: string | null }) => {
      const previous = profileRef.current
      setDisplayName((current) =>
        !previous || current === previous.displayName
          ? result.data.displayName
          : current,
      )
      setAvatarPreset((current) =>
        !previous || current === previous.avatarPreset
          ? result.data.avatarPreset
          : current,
      )
      profileRef.current = result.data
      setProfile(result.data)
      setEtag(result.etag)
    },
    [],
  )
  const reloadProfile = useCallback(async () => {
    const latest = await getCommunityProfile()
    commitPhoto(latest)
    setStale(false)
    setError('')
  }, [commitPhoto])

  async function reloadName() {
    if (saveLock.current || photoBusy) return
    saveLock.current = true
    setSaving(true)
    try {
      await reloadProfile()
      setMessage(
        'Đã tải thông tin mới. Tên và biểu tượng đang sửa vẫn được giữ; hãy kiểm tra trước khi lưu lại.',
      )
    } catch {
      setError(
        'Chưa tải được thông tin mới. Các chỉnh sửa của bạn vẫn được giữ; hãy thử lại.',
      )
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  useEffect(() => {
    let active = true
    void getCommunityProfile()
      .then((result) => {
        if (!active) return
        setProfile(result.data)
        profileRef.current = result.data
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
          setLoadError(true)
          setError('Thông tin hiển thị cộng đồng tạm thời chưa tải được.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveLock.current || photoBusy || stale) return
    const normalizedName = displayName.trim().normalize('NFC')
    if (!validDisplayName(normalizedName)) {
      setNameError('Tên hiển thị cần có từ 1 đến 80 ký tự an toàn.')
      nameInput.current?.focus()
      return
    }
    setNameError('')
    saveLock.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await putCommunityProfile(
        { displayName: normalizedName, avatarPreset },
        etag,
      )
      setProfile(result.data)
      profileRef.current = result.data
      setEtag(result.etag)
      setDisplayName(result.data.displayName)
      setAvatarPreset(result.data.avatarPreset)
      showActionToast({
        title: 'Đã lưu danh tính cộng đồng',
        description:
          'Đã cập nhật tên và biểu tượng. Lựa chọn ảnh đang chỉnh vẫn được giữ.',
      })
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.code === 'COMMUNITY_PROFILE_VERSION_REQUIRED' ||
          cause.code === 'COMMUNITY_PROFILE_VERSION_MISMATCH')
      ) {
        setStale(true)
        setError(
          'Thông tin đã thay đổi ở nơi khác. Tải thông tin mới để kiểm tra và lưu lại; các chỉnh sửa của bạn vẫn được giữ.',
        )
      } else {
        setError('Chưa thể lưu thông tin hiển thị. Vui lòng thử lại.')
      }
    } finally {
      saveLock.current = false
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

  if (loadError) {
    return (
      <section className="community-state">
        <h1>Chưa tải được danh tính cộng đồng</h1>
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setLoadError(false)
            setError('')
            setLoadAttempt((value) => value + 1)
          }}
        >
          Thử tải lại
        </button>
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

      <form className="community-profile-form" onSubmit={save} noValidate>
        <div
          className="community-profile-preview"
          aria-label="Xem trước danh tính"
        >
          <CommunityAvatar
            displayName={displayName.trim() || '?'}
            avatarPreset={avatarPreset}
            avatarImage={profile?.avatarImage}
          />
          <div>
            <span>Người khác sẽ thấy</span>
            <strong>{displayName.trim() || 'Tên hiển thị của bạn'}</strong>
          </div>
        </div>

        {profile ? (
          <CommunityAvatarEditor
            profile={profile}
            etag={etag}
            disabled={saving}
            onCommit={commitPhoto}
            onReload={reloadProfile}
            onBusyChange={setPhotoBusy}
            onDirtyChange={setPhotoDirty}
          />
        ) : (
          <p>
            Tạo danh tính cộng đồng trước, sau đó bạn có thể tải ảnh đại diện
            lên.
          </p>
        )}

        <div className="community-profile-field">
          <label htmlFor="community-display-name">
            Tên hiển thị hoặc biệt danh
          </label>
          <input
            ref={nameInput}
            id="community-display-name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              setNameError('')
            }}
            maxLength={160}
            autoComplete="off"
            required
            disabled={saving}
            aria-invalid={Boolean(nameError)}
            aria-describedby={
              nameError
                ? 'community-name-help community-name-error'
                : 'community-name-help'
            }
          />
          <small id="community-name-help">
            Tối đa 80 ký tự. Tránh dùng họ tên thật nếu bạn muốn giữ riêng tư.
          </small>
          {nameError && (
            <p
              id="community-name-error"
              className="community-profile-error"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>

        <fieldset disabled={saving}>
          <legend>Biểu tượng dự phòng</legend>
          <p>Được dùng khi bạn chưa chọn ảnh hoặc khi ảnh không tải được.</p>
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
            Tên hiển thị và ảnh hoặc biểu tượng bạn chọn. Danh tính tài khoản
            được giữ kín để xác định quyền sở hữu, chặn và xử lý an toàn.
          </p>
        </aside>

        {error && (
          <p className="community-profile-error" role="alert">
            {error}
          </p>
        )}
        {message && <p aria-live="polite">{message}</p>}
        {stale && (
          <button
            type="button"
            disabled={saving || photoBusy}
            onClick={() => void reloadName()}
          >
            Tải thông tin mới
          </button>
        )}
        <button type="submit" disabled={saving || photoBusy || stale}>
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
