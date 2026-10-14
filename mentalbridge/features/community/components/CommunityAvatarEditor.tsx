'use client'

import { Camera, Upload } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { ApiError } from '@/lib/api/api-error'
import {
  putCommunityAvatar,
  uploadCommunityMedia,
  type CommunityProfile,
  type CommunityUploadSession,
} from '@/features/community/api/browser-community'
import CommunityAvatar from './CommunityAvatar'
import styles from './CommunityAvatarEditor.module.css'

type VersionedProfile = { data: CommunityProfile; etag: string | null }
type Choice = {
  file: File
  url: string
  session: CommunityUploadSession
  mediaId?: string
}

function readableImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve()
        : reject(new Error('INVALID_IMAGE'))
    image.onerror = () => reject(new Error('INVALID_IMAGE'))
    image.src = url
  })
}

export default function CommunityAvatarEditor({
  profile,
  etag,
  disabled,
  onCommit,
  onReload,
  onBusyChange,
  onDirtyChange,
}: Readonly<{
  profile: CommunityProfile
  etag: string | null
  disabled: boolean
  onCommit: (result: VersionedProfile) => void
  onReload: () => Promise<void>
  onBusyChange: (busy: boolean) => void
  onDirtyChange: (dirty: boolean) => void
}>) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const restorePickerFocus = useCallback(() => picker.current, [])
  const choiceRef = useRef<Choice | null>(null)
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const sequence = useRef(0)
  const urls = useRef(new Set<string>())
  const alive = useRef(true)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [decoding, setDecoding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [staleProfile, setStaleProfile] = useState<CommunityProfile | null>(
    null,
  )
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [requiresNewFile, setRequiresNewFile] = useState(false)
  const unavailable = disabled || busy || decoding
  const stale = staleProfile === profile

  useEffect(() => {
    onDirtyChange(Boolean(choice) || busy || decoding)
  }, [choice, busy, decoding, onDirtyChange])
  useEffect(() => {
    alive.current = true
    const objectUrls = urls.current
    return () => {
      alive.current = false
      controller.current?.abort()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [])

  function discardChoice() {
    if (choiceRef.current) {
      URL.revokeObjectURL(choiceRef.current.url)
      urls.current.delete(choiceRef.current.url)
    }
    choiceRef.current = null
    setChoice(null)
    setRequiresNewFile(false)
  }

  async function choose(file?: File) {
    if (!file || lock.current || disabled) return
    const currentSequence = ++sequence.current
    setError('')
    if (!stale) setStaleProfile(null)
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size < 1 ||
      file.size > 10_485_760
    ) {
      setDecoding(false)
      setError(
        'Chọn ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 10 MiB; tệp không được rỗng.',
      )
      return
    }
    const url = URL.createObjectURL(file)
    urls.current.add(url)
    setDecoding(true)
    try {
      await readableImage(url)
      if (!alive.current || currentSequence !== sequence.current) return
      discardChoice()
      const next = {
        file,
        url,
        session: { idempotencyKey: crypto.randomUUID() },
      }
      choiceRef.current = next
      setChoice(next)
      setStatus('Ảnh chưa được lưu.')
    } catch {
      if (alive.current && currentSequence === sequence.current)
        setError('Không đọc được ảnh này. Hãy chọn một ảnh khác.')
    } finally {
      if (choiceRef.current?.url !== url) {
        URL.revokeObjectURL(url)
        urls.current.delete(url)
      }
      if (alive.current && currentSequence === sequence.current)
        setDecoding(false)
    }
  }

  async function commit(remove = false) {
    if (
      lock.current ||
      unavailable ||
      stale ||
      !etag ||
      (!remove && (!choiceRef.current || requiresNewFile))
    )
      return
    lock.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    setRemoveError('')
    setStaleProfile(null)
    const abort = new AbortController()
    controller.current = abort
    try {
      let mediaId: string | null = null
      if (!remove && choiceRef.current) {
        const current = choiceRef.current
        mediaId = current.mediaId ?? null
        if (!mediaId) {
          setStatus('Đang tải và kiểm tra ảnh…')
          const media = await uploadCommunityMedia(
            current.file,
            abort.signal,
            current.session,
          )
          if (!alive.current) return
          current.mediaId = media.mediaId
          mediaId = media.mediaId
        }
      }
      setStatus(remove ? 'Đang gỡ ảnh…' : 'Đang lưu ảnh đại diện…')
      const result = await putCommunityAvatar(mediaId, etag, abort.signal)
      if (!alive.current) return
      onCommit(result)
      discardChoice()
      setRemoveOpen(false)
      setStatus(
        remove
          ? 'Đã gỡ ảnh tải lên. Biểu tượng bạn chọn sẽ hiển thị thay thế.'
          : 'Đã lưu ảnh đại diện.',
      )
      picker.current?.focus()
    } catch (cause) {
      if (!alive.current || abort.signal.aborted) return
      const conflict =
        cause instanceof ApiError &&
        (cause.status === 412 ||
          cause.code === 'COMMUNITY_PROFILE_VERSION_REQUIRED')
      const invalid =
        cause instanceof Error && cause.message === 'COMMUNITY_MEDIA_REJECTED'
      if (conflict) setStaleProfile(profile)
      if (invalid) setRequiresNewFile(true)
      const message = conflict
        ? 'Danh tính đã thay đổi ở nơi khác. Tải thông tin mới trước khi thử lại; lựa chọn ảnh và tên đang sửa vẫn được giữ.'
        : invalid
          ? 'Ảnh không còn hợp lệ để lưu. Hãy chọn lại ảnh; ảnh hiện tại chưa thay đổi.'
          : remove
            ? 'Chưa gỡ được ảnh. Ảnh hiện tại vẫn được giữ; bạn có thể thử lại.'
            : 'Chưa lưu được ảnh. Lựa chọn của bạn vẫn được giữ; hãy thử lại.'
      if (remove) setRemoveError(message)
      else setError(message)
      setStatus('')
    } finally {
      lock.current = false
      controller.current = null
      if (alive.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  async function reload() {
    if (lock.current || disabled) return
    lock.current = true
    setBusy(true)
    onBusyChange(true)
    try {
      await onReload()
      if (!alive.current) return
      setStaleProfile(null)
      setError('')
      setRemoveError('')
      setStatus(
        'Đã tải thông tin mới. Lựa chọn ảnh và tên đang sửa không thay đổi.',
      )
    } catch {
      if (alive.current) {
        const message =
          'Chưa tải được thông tin mới. Lựa chọn của bạn vẫn được giữ; hãy thử lại.'
        if (removeOpen) setRemoveError(message)
        else setError(message)
      }
    } finally {
      lock.current = false
      if (alive.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  return (
    <section
      className={styles.region}
      aria-labelledby={`${id}-title`}
      aria-busy={busy || decoding}
    >
      <h2 id={`${id}-title`}>Ảnh đại diện cộng đồng</h2>
      <p>
        Ảnh xuất hiện cùng bài viết và bình luận có danh tính của bạn; không
        hiển thị khi đăng ẩn danh.
      </p>
      <div className={styles.picker}>
        <div
          className={styles.frame}
          aria-label={
            choice ? 'Xem trước ảnh đang chọn' : 'Ảnh đại diện hiện tại'
          }
        >
          {choice ? (
            // eslint-disable-next-line @next/next/no-img-element -- ephemeral local file preview, never an arbitrary remote URL
            <img src={choice.url} alt="" />
          ) : (
            <CommunityAvatar
              displayName={profile.displayName}
              avatarPreset={profile.avatarPreset}
              avatarImage={profile.avatarImage}
            />
          )}
        </div>
        <div className={styles.pickerActions}>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label="Chọn tệp ảnh đại diện"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void choose(file)
            }}
          />
          <button
            ref={picker}
            type="button"
            disabled={unavailable}
            onClick={() => input.current?.click()}
          >
            <Camera size={18} aria-hidden="true" />
            Chọn ảnh từ máy
          </button>
          <small>JPEG, PNG hoặc WebP · tối đa 10 MiB</small>
          {profile.avatarImage && !choice && (
            <button
              className={styles.remove}
              type="button"
              disabled={unavailable}
              onClick={() => {
                setRemoveError('')
                setRemoveOpen(true)
              }}
            >
              Gỡ ảnh tải lên
            </button>
          )}
        </div>
      </div>
      {choice && (
        <div className={styles.stage}>
          <strong>{choice.file.name}</strong>
          <p>Xem trước khung tròn: ảnh lấy phần giữa để hiển thị.</p>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={unavailable}
              onClick={() => {
                discardChoice()
                setError('')
                setStatus('')
                picker.current?.focus()
              }}
            >
              Hủy lựa chọn
            </button>
            <button
              className={styles.primary}
              type="button"
              disabled={unavailable || stale || requiresNewFile || !etag}
              onClick={() => void commit()}
            >
              <Upload size={18} aria-hidden="true" />
              {busy ? 'Đang lưu ảnh…' : 'Lưu ảnh đại diện'}
            </button>
          </div>
        </div>
      )}
      {error && (!staleProfile || stale) && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {stale && !removeOpen && (
        <button
          type="button"
          disabled={unavailable}
          onClick={() => void reload()}
        >
          Tải thông tin mới
        </button>
      )}
      <p className={styles.status} role="status" aria-live="polite">
        {decoding ? 'Đang đọc ảnh…' : status}
      </p>
      <Dialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (!busy) setRemoveOpen(open)
        }}
        labelledBy={`${id}-remove-title`}
        describedBy={`${id}-remove-help`}
        className={styles.dialog}
        restoreFocusTo={restorePickerFocus}
      >
        <h2 id={`${id}-remove-title`}>Gỡ ảnh đại diện đã tải lên?</h2>
        <p id={`${id}-remove-help`}>
          Biểu tượng bạn đã lưu sẽ hiển thị thay thế. Tên và nội dung bạn đã
          chia sẻ không thay đổi.
        </p>
        {removeError && (
          <p className={styles.error} role="alert">
            {removeError}
          </p>
        )}
        {stale && (
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => void reload()}>
              Tải thông tin mới
            </button>
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            disabled={busy}
            autoFocus
            onClick={() => setRemoveOpen(false)}
          >
            Giữ ảnh
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || stale || !etag}
            onClick={() => void commit(true)}
          >
            {busy ? 'Đang gỡ ảnh…' : 'Gỡ ảnh'}
          </button>
        </div>
      </Dialog>
    </section>
  )
}
