'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import {
  Camera,
  Check,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react'
import {
  COMMUNITY_PROFILE_CHANGED,
  getCommunityProfile,
  putCommunityAvatar,
  putCommunityProfile,
  uploadCommunityMedia,
  type CommunityAvatarPreset,
} from '../api/browser-community'
import type { MemberProfile } from '../api/community-social'
import CommunityAvatar from './CommunityAvatar'
import styles from './CommunityEditProfileDialog.module.css'

export type CustomProfileMetadata = {
  bio?: string
  handle?: string
  energyStatus?: string
  allowEncouragement?: boolean
  hideFromSearch?: boolean
  coverTheme?: string
  coverImage?: string
}

const PRESET_OPTIONS: ReadonlyArray<{
  value: CommunityAvatarPreset
  label: string
}> = [
  { value: 'LEAF', label: 'Lá xanh' },
  { value: 'SUNRISE', label: 'Bình minh' },
  { value: 'WAVE', label: 'Gợn sóng' },
  { value: 'LOTUS', label: 'Hoa sen' },
  { value: 'CLOUD', label: 'Mây nhẹ' },
  { value: 'SPROUT', label: 'Mầm cây' },
]

const ENERGY_OPTIONS = [
  'Đang tĩnh tâm • Thư thái',
  'Cần một khoảng lặng',
  'Đang nỗ lực vượt qua',
  'Sẵn sàng lắng nghe bạn',
]

const COVER_THEMES = [
  {
    id: 'forest',
    label: 'Rừng tĩnh lặng',
    bg: 'linear-gradient(135deg, #0e2a22 0%, #174236 45%, #10342b 100%)',
  },
  {
    id: 'ocean',
    label: 'Biển sớm mai',
    bg: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  },
  {
    id: 'twilight',
    label: 'Hoàng hôn an yên',
    bg: 'linear-gradient(135deg, #24243e 0%, #302b63 50%, #0f0c29 100%)',
  },
  {
    id: 'sunset',
    label: 'Bình minh ấm áp',
    bg: 'linear-gradient(135deg, #3a1c28 0%, #4a2835 50%, #23121b 100%)',
  },
]

function CommunityEditProfileForm({
  profile,
  onClose,
  onSaveSuccess,
}: {
  profile: MemberProfile
  onClose: () => void
  onSaveSuccess?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const defaultSlug =
    '@' +
    (profile.member.displayName || 'khoi').toLowerCase().replace(/\s+/g, '') +
    '_mentalpeace'

  const [metadata] = useState<CustomProfileMetadata>(() => {
    try {
      const raw = localStorage.getItem(
        `mentalbridge:community-profile-custom:${profile.member.communityProfileId}`,
      )
      if (raw) return JSON.parse(raw)
    } catch {}
    return {}
  })

  const [displayName, setDisplayName] = useState(
    profile.member.displayName || '',
  )
  const [handle, setHandle] = useState(metadata.handle || defaultSlug)
  const [bio, setBio] = useState(
    metadata.bio ||
      'Trang cá nhân cộng đồng • Những câu chuyện bạn chia sẻ bằng danh tính an toàn, không phán xét. Nơi lưu giữ hành trình tự chữa lành và nâng đỡ cảm xúc mỗi ngày.',
  )
  const [energyStatus, setEnergyStatus] = useState(
    metadata.energyStatus || 'Đang tĩnh tâm • Thư thái',
  )
  const [allowEncouragement, setAllowEncouragement] = useState(
    metadata.allowEncouragement ?? true,
  )
  const [hideFromSearch, setHideFromSearch] = useState(
    metadata.hideFromSearch ?? false,
  )

  const [avatarPreset, setAvatarPreset] =
    useState<CommunityAvatarPreset | null>(profile.member.avatarPreset)
  const [avatarImage, setAvatarImage] = useState<string | null>(
    profile.member.avatarImage?.url || null,
  )
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(
    profile.member.avatarImage?.mediaId || null,
  )

  const [coverTheme, setCoverTheme] = useState(metadata.coverTheme || 'forest')
  const [coverImage, setCoverImage] = useState<string | null>(
    metadata.coverImage || null,
  )

  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Avatar upload handler
  async function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const localPreviewUrl = URL.createObjectURL(file)
      const uploaded = await uploadCommunityMedia(file)
      setAvatarMediaId(uploaded.mediaId)
      setAvatarImage(localPreviewUrl)
      setAvatarPreset(null)
    } catch {
      setError('Tải ảnh đại diện chưa thành công. Vui lòng thử lại.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Cover image upload handler
  function handleCoverFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const res = event.target?.result
      if (typeof res === 'string') {
        setCoverImage(res)
      }
    }
    reader.readAsDataURL(file)
  }

  // Reset / Remove avatar
  function handleRemoveAvatar() {
    setAvatarImage(null)
    setAvatarMediaId(null)
    setAvatarPreset('SPROUT')
  }

  // Choose preset
  function handleSelectPreset(preset: CommunityAvatarPreset) {
    setAvatarPreset(preset)
    setAvatarImage(null)
    setAvatarMediaId(null)
    setShowPresetPicker(false)
  }

  // Submit save
  async function handleSave() {
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('Vui lòng nhập bí danh cộng đồng.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // 1. Get current etag
      const current = await getCommunityProfile()

      // 2. Update basic profile (displayName, avatarPreset)
      const updated = await putCommunityProfile(
        {
          displayName: trimmedName,
          avatarPreset: avatarPreset,
        },
        current.etag,
      )

      // 3. If avatar photo was modified, update avatar photo
      if (avatarMediaId !== (profile.member.avatarImage?.mediaId ?? null)) {
        await putCommunityAvatar(avatarMediaId, updated.etag ?? '*')
      }

      // 4. Save extended custom profile attributes to localStorage
      const updatedMeta: CustomProfileMetadata = {
        bio: bio.trim(),
        handle: handle.trim(),
        energyStatus,
        allowEncouragement,
        hideFromSearch,
        coverTheme,
        coverImage: coverImage || undefined,
      }

      localStorage.setItem(
        `mentalbridge:community-profile-custom:${profile.member.communityProfileId}`,
        JSON.stringify(updatedMeta),
      )

      window.dispatchEvent(new Event(COMMUNITY_PROFILE_CHANGED))

      onSaveSuccess?.()
      onClose()
    } catch {
      setError('Lưu thông tin chưa thành công. Vui lòng kiểm tra lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.modalCard}
      onClick={(e) => e.stopPropagation()}
      aria-labelledby="edit-dialog-title"
    >
      {/* Header */}
      <div className={styles.modalHeader}>
        <div className={styles.modalHeaderTitleGroup}>
          <div className={styles.modalHeaderTitleRow}>
            <h2 id="edit-dialog-title" className={styles.modalHeaderTitle}>
              Chỉnh sửa danh tính
            </h2>
          </div>
          <p className={styles.modalHeaderSubtitle}>
            Điều chỉnh cách bạn hiện diện trong không gian an lành. Mọi thay đổi
            đều tôn trọng sự ẩn danh.
          </p>
        </div>
        <button
          className={styles.btnClose}
          onClick={onClose}
          aria-label="Đóng cửa sổ"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fff2ee',
            color: '#d94827',
            fontSize: '0.78125rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Avatar Section Card */}
      <div className={styles.avatarSectionCard}>
        <div className={styles.avatarWrapper}>
          <CommunityAvatar
            displayName={displayName || profile.member.displayName}
            avatarPreset={avatarPreset}
            avatarImage={
              avatarImage
                ? {
                    mediaId: avatarMediaId || '',
                    url: avatarImage,
                    width: 128,
                    height: 128,
                  }
                : null
            }
          />
          <div className={styles.avatarVerifiedCheck} title="Xác thực an toàn">
            <Check size={12} strokeWidth={3} />
          </div>
        </div>

        <div className={styles.avatarMetaGroup}>
          <div className={styles.avatarButtonsRow}>
            <button
              type="button"
              className={styles.btnAvatarActionPrimary}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} />
              {uploading ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFileChange}
            />

            <button
              type="button"
              className={styles.btnAvatarActionOutline}
              onClick={() => setShowPresetPicker((v) => !v)}
            >
              <Sparkles size={14} />
              Dùng avatar ẩn danh
            </button>

            <button
              type="button"
              className={styles.btnAvatarActionText}
              onClick={handleRemoveAvatar}
            >
              Gỡ ảnh
            </button>
          </div>

          <p className={styles.avatarNote}>
            Khuyến khích dùng hình ảnh không chứa đặc điểm sinh trắc học nhận
            dạng rõ.
          </p>
        </div>
      </div>

      {/* Preset Selector Dropdown / Grid */}
      {showPresetPicker && (
        <div
          style={{
            background: '#f2f8f5',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #d4ebe2',
          }}
        >
          <div
            style={{
              fontSize: '0.78125rem',
              fontWeight: 600,
              color: '#1b4332',
              marginBottom: 6,
            }}
          >
            Chọn biểu tượng ẩn danh:
          </div>
          <div className={styles.presetGrid}>
            {PRESET_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`${styles.presetCard} ${
                  avatarPreset === p.value ? styles.presetCardActive : ''
                }`}
                onClick={() => handleSelectPreset(p.value)}
              >
                <CommunityAvatar
                  displayName={displayName || 'Sanctuary'}
                  avatarPreset={p.value}
                  avatarImage={null}
                />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Inputs */}
      <div className={styles.twoColInputsRow}>
        <div className={styles.formFieldGroup}>
          <label htmlFor="input-displayName" className={styles.formFieldLabel}>
            Bí danh cộng đồng
          </label>
          <div className={styles.inputWithIconWrapper}>
            <input
              id="input-displayName"
              type="text"
              className={styles.formInputText}
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập bí danh của bạn"
            />
            <span className={styles.inputTrailingIcon}>
              <User size={15} style={{ color: '#2a9d8f' }} />
            </span>
          </div>
        </div>

        <div className={styles.formFieldGroup}>
          <label htmlFor="input-handle" className={styles.formFieldLabel}>
            Tên định danh (@tag)
          </label>
          <div className={styles.inputWithIconWrapper}>
            <input
              id="input-handle"
              type="text"
              className={styles.formInputText}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@khoi_mentalpeace"
            />
            <span className={styles.inputTrailingIcon}>
              <Lock size={14} style={{ color: '#889890' }} />
            </span>
          </div>
        </div>
      </div>

      {/* Clinical Privacy Banner */}
      <div className={styles.clinicalSecurityBanner}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Danh tính riêng trong cộng đồng.</strong> Tên và ảnh ở đây độc
          lập với hồ sơ tài khoản và hồ sơ chăm sóc của bạn.
        </span>
      </div>

      {/* Bio Textarea */}
      <div className={styles.formFieldGroup}>
        <div className={styles.textareaHeaderRow}>
          <label htmlFor="textarea-bio" className={styles.formFieldLabel}>
            Lời tự bạch & Tâm niệm sống
          </label>
          <span className={styles.charCounter}>{bio.length}/250</span>
        </div>
        <textarea
          id="textarea-bio"
          className={styles.formTextarea}
          value={bio}
          maxLength={250}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Chia sẻ ngắn gọn về tâm thế hoặc những điều bạn đang tìm kiếm sự đồng cảm."
          rows={3}
        />
        <p className={styles.textareaSubGuide}>
          Chia sẻ ngắn gọn về tâm thế hoặc những điều bạn đang tìm kiếm sự đồng
          cảm.
        </p>
      </div>

      {/* Energy Status Section */}
      <div className={styles.formFieldGroup}>
        <div className={styles.sectionHeaderRow}>
          <strong>Trạng thái năng lượng hiện tại</strong>
          <span className={styles.sectionHeaderSub}>
            Chọn trạng thái để bạn đồng hành hiểu bạn hơn
          </span>
        </div>
        <div className={styles.energyGrid}>
          {ENERGY_OPTIONS.map((status) => {
            const active = energyStatus === status
            return (
              <button
                key={status}
                type="button"
                className={`${styles.energyPillBtn} ${
                  active ? styles.energyPillBtnActive : ''
                }`}
                onClick={() => setEnergyStatus(status)}
              >
                <span>{status}</span>
                {active && <Check size={14} style={{ color: '#2a9d8f' }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cover Image Customization */}
      <div className={styles.formFieldGroup}>
        <div className={styles.sectionHeaderRow}>
          <strong>Ảnh bìa & Chủ đề trang cá nhân</strong>
          <button
            type="button"
            style={{
              background: 'none',
              border: 0,
              color: '#2a9d8f',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setShowCoverPicker((v) => !v)}
          >
            <Palette size={13} style={{ display: 'inline', marginRight: 4 }} />
            {showCoverPicker ? 'Đóng tùy chọn' : 'Đổi ảnh bìa / chủ đề'}
          </button>
        </div>

        {showCoverPicker && (
          <div
            style={{
              background: '#f8faf9',
              border: '1px solid #e3ece7',
              borderRadius: 10,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#556b64' }}>
              Chọn gam màu an yên hoặc tải ảnh bìa riêng:
            </div>
            <div className={styles.coverThemesGrid}>
              {COVER_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.label}
                  className={`${styles.coverThemeCard} ${
                    coverTheme === theme.id && !coverImage
                      ? styles.coverThemeCardActive
                      : ''
                  }`}
                  style={{ background: theme.bg }}
                  onClick={() => {
                    setCoverTheme(theme.id)
                    setCoverImage(null)
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className={styles.btnAvatarActionOutline}
                onClick={() => coverInputRef.current?.click()}
              >
                <Upload size={14} /> Tải ảnh bìa tùy chọn
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverFileChange}
              />
              {coverImage && (
                <button
                  type="button"
                  className={styles.btnAvatarActionText}
                  onClick={() => setCoverImage(null)}
                >
                  Gỡ ảnh bìa riêng
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Boundaries & Privacy */}
      <div className={styles.privacyTogglesList}>
        <div className={styles.privacyToggleRow}>
          <div className={styles.privacyToggleText}>
            <strong>Cho phép bạn đồng hành gửi lời động viên</strong>
            <small>
              Các thành viên có thể gửi tin nhắn tích cực mà không cần kết bạn
            </small>
          </div>
          <button
            type="button"
            className={`${styles.switchToggle} ${
              allowEncouragement ? styles.switchToggleActive : ''
            }`}
            onClick={() => setAllowEncouragement((v) => !v)}
            aria-label="Bật tắt gửi lời động viên"
          >
            <span className={styles.switchHandle} />
          </button>
        </div>

        <div className={styles.privacyToggleRow}>
          <div className={styles.privacyToggleText}>
            <strong>Ẩn khỏi danh sách tìm kiếm công khai</strong>
            <small>
              Chỉ người có liên kết hoặc bạn bè mới thấy hồ sơ của bạn
            </small>
          </div>
          <button
            type="button"
            className={`${styles.switchToggle} ${
              hideFromSearch ? styles.switchToggleActive : ''
            }`}
            onClick={() => setHideFromSearch((v) => !v)}
            aria-label="Bật tắt ẩn khỏi tìm kiếm"
          >
            <span className={styles.switchHandle} />
          </button>
        </div>
      </div>

      {/* Modal Footer */}
      <div className={styles.modalFooter}>
        <div className={styles.modalFooterNotice}>
          <ShieldCheck size={14} style={{ color: '#2a9d8f' }} />
          <span>Bạn chọn cách xuất hiện trong cộng đồng</span>
        </div>

        <div className={styles.modalFooterActions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={saving}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className={styles.btnSaveSubmit}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Đang lưu…' : '✓ Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommunityEditProfileDialog({
  open,
  onClose,
  profile,
  onSaveSuccess,
}: {
  open: boolean
  onClose: () => void
  profile: MemberProfile | null
  onSaveSuccess?: () => void
}) {
  if (!profile) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      labelledBy="edit-dialog-title"
      className={styles.dialog}
    >
      <CommunityEditProfileForm
        key={`${profile.member.communityProfileId}-${open}`}
        profile={profile}
        onClose={onClose}
        onSaveSuccess={onSaveSuccess}
      />
    </Dialog>
  )
}
