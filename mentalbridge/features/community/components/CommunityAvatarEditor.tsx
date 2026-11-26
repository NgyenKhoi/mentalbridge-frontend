'use client'

import { Camera, Minus, Plus, RotateCcw } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
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
type Source = {
  url: string
  width: number
  height: number
  /** Present for a photo picked from the device; absent for the saved photo. */
  file?: File
}
type Crop = { zoom: number; x: number; y: number }
type Attempt = {
  sig: string
  file: File
  session: CommunityUploadSession
  mediaId?: string
}
type Drag = {
  id: number
  px: number
  py: number
  x: number
  y: number
  size: number
}

const START: Crop = { zoom: 1, x: 0, y: 0 }
const ZOOM_MIN = 1
const ZOOM_MAX = 2.5
const PAN_STEP = 0.02
const OUTPUT = 512
const PREVIEWS = [
  { size: 56, label: 'Hồ sơ' },
  { size: 40, label: 'Cộng đồng' },
  { size: 28, label: 'Menu' },
]

function loadImage(url: string, anonymous = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    if (anonymous) image.crossOrigin = 'anonymous'
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve(image)
        : reject(new Error('INVALID_IMAGE'))
    image.onerror = () => reject(new Error('INVALID_IMAGE'))
    image.src = url
  })
}

// Stage units: the square frame is 1. The photo covers it at zoom 1 and may not leave it.
function fit({ width, height }: Source, zoom: number) {
  const r = Math.min(width, height)
  return { r, nw: (width / r) * zoom, nh: (height / r) * zoom }
}
const clamp = (value: number, limit: number) =>
  Math.min(limit, Math.max(-limit, value))
function place(source: Source, zoom: number, x: number, y: number): Crop {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
  const { nw, nh } = fit(source, z)
  return { zoom: z, x: clamp(x, (nw - 1) / 2), y: clamp(y, (nh - 1) / 2) }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))

async function cropToFile(
  source: Source,
  bitmap: HTMLImageElement,
  { zoom, x, y }: Crop,
) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = OUTPUT
  const context = canvas.getContext('2d')
  // shortcut: without a canvas (test DOM only) the original, uncropped file is uploaded.
  if (!context) {
    if (source.file) return source.file
    throw new Error('CROP_FAILED')
  }
  const { r, nw, nh } = fit(source, zoom)
  const scale = r / zoom
  context.drawImage(
    bitmap,
    (nw / 2 - 0.5 - x) * scale,
    (nh / 2 - 0.5 - y) * scale,
    scale,
    scale,
    0,
    0,
    OUTPUT,
    OUTPUT,
  )
  try {
    let blob = await toBlob(canvas, 'image/webp')
    if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
    if (!blob) throw new Error('CROP_FAILED')
    const webp = blob.type === 'image/webp'
    return new File([blob], webp ? 'avatar.webp' : 'avatar.jpg', {
      type: blob.type,
    })
  } catch {
    // A canvas tainted by a cross-origin photo throws SecurityError here.
    throw new Error('CROP_FAILED')
  }
}

function CropView({ source, crop }: Readonly<{ source: Source; crop: Crop }>) {
  const { nw, nh } = fit(source, crop.zoom)
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local file or the member's saved photo, positioned by the crop
    <img
      className={styles.cropImage}
      src={source.url}
      alt=""
      crossOrigin={source.file ? undefined : 'anonymous'}
      draggable={false}
      style={{
        width: `${nw * 100}%`,
        height: `${nh * 100}%`,
        left: `${(0.5 + crop.x - nw / 2) * 100}%`,
        top: `${(0.5 + crop.y - nh / 2) * 100}%`,
      }}
    />
  )
}

export default function CommunityAvatarEditor({
  profile,
  etag,
  disabled,
  onCommit,
  onReload,
  onBusyChange,
  onDirtyChange,
  title = 'Ảnh đại diện cộng đồng',
  description = 'Ảnh xuất hiện cùng bài viết và bình luận có danh tính của bạn; không hiển thị khi đăng ẩn danh.',
}: Readonly<{
  profile: CommunityProfile
  etag: string | null
  disabled: boolean
  onCommit: (result: VersionedProfile) => void
  onReload: () => Promise<void>
  onBusyChange: (busy: boolean) => void
  onDirtyChange: (dirty: boolean) => void
  title?: string
  description?: string
}>) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const restorePickerFocus = useCallback(() => picker.current, [])
  const sourceRef = useRef<Source | null>(null)
  const bitmapRef = useRef<HTMLImageElement | null>(null)
  const attemptRef = useRef<Attempt | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const sequence = useRef(0)
  const loadSequence = useRef(0)
  const urls = useRef(new Set<string>())
  const alive = useRef(true)
  const [source, setSource] = useState<Source | null>(null)
  const [crop, setCrop] = useState<Crop>(START)
  const [dragging, setDragging] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [current, setCurrent] = useState<'idle' | 'loading' | 'failed'>('idle')
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
  const picked = cropOpen && Boolean(source?.file)

  useEffect(() => {
    onDirtyChange(picked || busy || decoding)
  }, [picked, busy, decoding, onDirtyChange])
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

  const discardSource = useCallback(() => {
    const old = sourceRef.current
    if (old?.file) {
      URL.revokeObjectURL(old.url)
      urls.current.delete(old.url)
    }
    sourceRef.current = null
    bitmapRef.current = null
    attemptRef.current = null
    setSource(null)
    setRequiresNewFile(false)
  }, [])

  const afterClose = useCallback(() => {
    loadSequence.current++
    discardSource()
    setCrop(START)
    setCurrent('idle')
  }, [discardSource])

  function showSource(next: Source, bitmap: HTMLImageElement) {
    sourceRef.current = next
    bitmapRef.current = bitmap
    setSource(next)
    setCrop(START)
    setCurrent('idle')
  }

  function openCrop() {
    if (unavailable) return
    const saved = profile.avatarImage
    discardSource()
    setCrop(START)
    setError('')
    setStatus('')
    setCropOpen(true)
    const currentLoad = ++loadSequence.current
    if (!saved) return setCurrent('idle')
    setCurrent('loading')
    // The avatar <img> elsewhere cached this photo without CORS; a distinct URL forces a CORS fetch so the canvas stays readable.
    const corsUrl = `${saved.url}${saved.url.includes('?') ? '&' : '?'}crop=1`
    loadImage(corsUrl, true)
      .then((bitmap) => {
        if (!alive.current || currentLoad !== loadSequence.current) return
        showSource(
          {
            url: corsUrl,
            width: bitmap.naturalWidth,
            height: bitmap.naturalHeight,
          },
          bitmap,
        )
      })
      .catch(() => {
        if (alive.current && currentLoad === loadSequence.current)
          setCurrent('failed')
      })
  }

  function closeCrop() {
    if (busy) return
    setCropOpen(false)
    setError('')
    setStatus('')
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
      const bitmap = await loadImage(url)
      if (!alive.current || currentSequence !== sequence.current) return
      loadSequence.current++
      discardSource()
      showSource(
        {
          url,
          file,
          width: bitmap.naturalWidth,
          height: bitmap.naturalHeight,
        },
        bitmap,
      )
      setCropOpen(true)
      setStatus('Ảnh chưa được lưu.')
    } catch {
      if (alive.current && currentSequence === sequence.current)
        setError('Không đọc được ảnh này. Hãy chọn một ảnh khác.')
    } finally {
      if (sourceRef.current?.url !== url) {
        URL.revokeObjectURL(url)
        urls.current.delete(url)
      }
      if (alive.current && currentSequence === sequence.current)
        setDecoding(false)
    }
  }

  // Same source, zoom and position as a failed attempt: reuse its file, session and media.
  async function prepare() {
    const src = sourceRef.current
    const bitmap = bitmapRef.current
    if (!src || !bitmap) throw new Error('CROP_FAILED')
    const sig = `${src.url}|${crop.zoom}|${crop.x}|${crop.y}`
    if (attemptRef.current?.sig === sig) return attemptRef.current
    const file = await cropToFile(src, bitmap, crop)
    attemptRef.current = {
      sig,
      file,
      session: { idempotencyKey: crypto.randomUUID() },
    }
    return attemptRef.current
  }

  async function commit(remove = false) {
    if (
      lock.current ||
      unavailable ||
      stale ||
      !etag ||
      (!remove && (!sourceRef.current || requiresNewFile))
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
      if (!remove) {
        const attempt = await prepare()
        if (!alive.current) return
        mediaId = attempt.mediaId ?? null
        if (!mediaId) {
          setStatus('Đang tải và kiểm tra ảnh…')
          const media = await uploadCommunityMedia(
            attempt.file,
            abort.signal,
            attempt.session,
          )
          if (!alive.current) return
          attempt.mediaId = media.mediaId
          mediaId = media.mediaId
        }
      }
      setStatus(remove ? 'Đang gỡ ảnh…' : 'Đang lưu ảnh đại diện…')
      const result = await putCommunityAvatar(mediaId, etag, abort.signal)
      if (!alive.current) return
      onCommit(result)
      setCropOpen(false)
      setRemoveOpen(false)
      setStatus(
        remove
          ? 'Đã gỡ ảnh tải lên. Biểu tượng bạn chọn sẽ hiển thị thay thế.'
          : 'Đã lưu ảnh đại diện.',
      )
    } catch (cause) {
      if (!alive.current || abort.signal.aborted) return
      const conflict =
        cause instanceof ApiError &&
        (cause.status === 412 ||
          cause.code === 'COMMUNITY_PROFILE_VERSION_REQUIRED')
      const invalid =
        cause instanceof Error && cause.message === 'COMMUNITY_MEDIA_REJECTED'
      const uncroppable =
        cause instanceof Error && cause.message === 'CROP_FAILED'
      if (conflict) setStaleProfile(profile)
      if (invalid) setRequiresNewFile(true)
      const message = conflict
        ? 'Danh tính đã thay đổi ở nơi khác. Tải thông tin mới trước khi thử lại; lựa chọn ảnh và tên đang sửa vẫn được giữ.'
        : invalid
          ? 'Ảnh không còn hợp lệ để lưu. Hãy chọn lại ảnh; ảnh hiện tại chưa thay đổi.'
          : uncroppable
            ? 'Chưa lưu được ảnh này. Hãy chọn ảnh từ máy.'
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

  function move(x: number, y: number) {
    if (source) setCrop((c) => place(source, c.zoom, x, y))
  }
  function zoomTo(percent: number) {
    if (source) setCrop((c) => place(source, percent / 100, c.x, c.y))
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (unavailable || !source || event.button > 0) return
    dragRef.current = {
      id: event.pointerId,
      px: event.clientX,
      py: event.clientY,
      x: crop.x,
      y: crop.y,
      size: event.currentTarget.getBoundingClientRect().width || 1,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(true)
  }
  function drag(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start || event.pointerId !== start.id) return
    move(
      start.x + (event.clientX - start.px) / start.size,
      start.y + (event.clientY - start.py) / start.size,
    )
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
  }
  function pan(event: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-PAN_STEP, 0],
      ArrowRight: [PAN_STEP, 0],
      ArrowUp: [0, -PAN_STEP],
      ArrowDown: [0, PAN_STEP],
    }
    const delta = step[event.key]
    if (!delta || unavailable) return
    event.preventDefault()
    move(crop.x + delta[0], crop.y + delta[1])
  }

  const percent = Math.round(crop.zoom * 100)
  const alertBlock = (
    <>
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
    </>
  )

  return (
    <section
      className={styles.region}
      aria-labelledby={`${id}-title`}
      aria-busy={busy || decoding}
    >
      <div className={styles.picker}>
        <div className={styles.frame} aria-label="Ảnh đại diện hiện tại">
          <CommunityAvatar
            displayName={profile.displayName}
            avatarPreset={profile.avatarPreset}
            avatarImage={profile.avatarImage}
          />
        </div>
        <div className={styles.pickerText}>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
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
              onClick={openCrop}
            >
              <Camera size={18} aria-hidden="true" />
              Chỉnh sửa ảnh
            </button>
            {profile.avatarImage && (
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
          <small>JPEG, PNG hoặc WebP · tối đa 10 MiB</small>
        </div>
      </div>
      {!cropOpen && alertBlock}
      <p className={styles.status} role="status" aria-live="polite">
        {decoding ? 'Đang đọc ảnh…' : status}
      </p>
      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) closeCrop()
        }}
        labelledBy={`${id}-crop-title`}
        describedBy={`${id}-crop-help`}
        className={`${styles.dialog} ${styles.cropDialog}`}
        restoreFocusTo={restorePickerFocus}
        onAfterClose={afterClose}
      >
        <h2 id={`${id}-crop-title`}>Chỉnh sửa ảnh đại diện</h2>
        <p id={`${id}-crop-help`}>Kéo ảnh để chọn phần nằm trong khung tròn.</p>
        <div className={styles.stageBox}>
          {source ? (
            <div
              className={`${styles.stage} ${dragging ? styles.dragging : ''}`}
              role="group"
              tabIndex={0}
              aria-label="Khung căn ảnh, kéo hoặc dùng phím mũi tên để di chuyển"
              onPointerDown={startDrag}
              onPointerMove={drag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={pan}
            >
              <CropView source={source} crop={crop} />
              <span className={styles.mask} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : (
            <div className={styles.empty}>
              {current === 'loading' ? (
                <span>Đang mở ảnh…</span>
              ) : (
                <button
                  type="button"
                  disabled={unavailable}
                  onClick={() => input.current?.click()}
                >
                  <Camera size={18} aria-hidden="true" />
                  Chọn ảnh từ máy
                </button>
              )}
            </div>
          )}
        </div>
        {current === 'failed' && (
          <p className={styles.note}>
            Chưa mở được ảnh hiện tại để chỉnh. Chọn ảnh từ máy để thay.
          </p>
        )}
        <div className={styles.zoom}>
          <label htmlFor={`${id}-zoom`}>Thu phóng</label>
          <output htmlFor={`${id}-zoom`}>{percent}%</output>
          <button
            type="button"
            className={styles.step}
            aria-label="Thu nhỏ"
            disabled={unavailable || !source || crop.zoom <= ZOOM_MIN}
            onClick={() => zoomTo(percent - 10)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <input
            id={`${id}-zoom`}
            type="range"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            step={1}
            value={percent}
            disabled={unavailable || !source}
            aria-valuetext={`${percent}%`}
            onChange={(event) => zoomTo(Number(event.target.value))}
          />
          <button
            type="button"
            className={styles.step}
            aria-label="Phóng to"
            disabled={unavailable || !source || crop.zoom >= ZOOM_MAX}
            onClick={() => zoomTo(percent + 10)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.previewRow}>
          <div className={styles.previews} aria-hidden="true">
            {PREVIEWS.map(({ size, label }) => (
              <div key={label} className={styles.preview}>
                <div
                  className={styles.dot}
                  style={{ width: size, height: size }}
                >
                  {source && <CropView source={source} crop={crop} />}
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={unavailable || !source}
            onClick={() => setCrop(START)}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Đặt lại
          </button>
        </div>
        {cropOpen && alertBlock}
        <div className={`${styles.actions} ${styles.footer}`}>
          <button
            type="button"
            className={styles.pick}
            disabled={unavailable}
            onClick={() => input.current?.click()}
          >
            <Camera size={18} aria-hidden="true" />
            Chọn ảnh từ máy
          </button>
          <button type="button" disabled={busy} onClick={closeCrop}>
            Hủy
          </button>
          <button
            className={styles.primary}
            type="button"
            disabled={
              unavailable || stale || requiresNewFile || !etag || !source
            }
            onClick={() => void commit()}
          >
            {busy ? 'Đang lưu ảnh…' : 'Lưu thay đổi'}
          </button>
        </div>
      </Dialog>
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
