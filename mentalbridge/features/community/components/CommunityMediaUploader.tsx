'use client'

import { useEffect, useRef, useState } from 'react'

import {
  deleteCommunityMedia,
  uploadCommunityMedia,
} from '@/features/community/api/browser-community'

const MAX_MEDIA = 10
const MAX_IMAGE_BYTES = 10_485_760
const MAX_VIDEO_BYTES = 52_428_800
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

type UploadItem = Readonly<{
  localId: string
  fileName: string
  mediaType: 'IMAGE' | 'VIDEO'
  previewUrl: string
  status: 'UPLOADING' | 'READY' | 'ERROR' | 'REMOVING'
  mediaId?: string
  version?: number
  error?: string
}>

type UploadState = Readonly<{ mediaIds: string[]; busy: boolean }>

export default function CommunityMediaUploader({
  disabled = false,
  compact = false,
  onChange,
}: Readonly<{
  disabled?: boolean
  compact?: boolean
  onChange: (state: UploadState) => void
}>) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const previewUrls = useRef(new Set<string>())

  useEffect(() => {
    onChange({
      mediaIds: items.flatMap((item) =>
        item.status === 'READY' && item.mediaId ? [item.mediaId] : [],
      ),
      busy: items.some(
        (item) => item.status === 'UPLOADING' || item.status === 'REMOVING',
      ),
    })
  }, [items, onChange])

  useEffect(
    () => () => {
      controllers.current.forEach((controller) => controller.abort())
      previewUrls.current.forEach((previewUrl) =>
        URL.revokeObjectURL(previewUrl),
      )
    },
    [],
  )

  function selectFiles(files: FileList | null) {
    setMessage('')
    if (!files?.length) return
    const remaining = MAX_MEDIA - items.length
    if (files.length > remaining) {
      setMessage(`Mỗi bài viết có tối đa ${MAX_MEDIA} ảnh hoặc video.`)
      return
    }
    const selected = Array.from(files)
    const invalid = selected.find((file) => !validFile(file))
    if (invalid) {
      setMessage(
        'Chọn ảnh JPEG, PNG, WebP tối đa 10 MB hoặc video MP4, WebM, MOV tối đa 50 MB.',
      )
      return
    }
    const additions = selected.map<UploadItem>((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      return {
        localId: crypto.randomUUID(),
        fileName: file.name,
        mediaType: file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO',
        previewUrl,
        status: 'UPLOADING',
      }
    })
    setItems((current) => [...current, ...additions])
    additions.forEach((item, index) => void upload(item, selected[index]))
    if (input.current) input.current.value = ''
  }

  async function upload(item: UploadItem, file: File) {
    const controller = new AbortController()
    controllers.current.set(item.localId, controller)
    try {
      const media = await uploadCommunityMedia(file, controller.signal)
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.localId === item.localId
            ? {
                ...currentItem,
                status: 'READY',
                mediaId: media.mediaId,
                version: media.version,
              }
            : currentItem,
        ),
      )
    } catch {
      if (!controller.signal.aborted) {
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.localId === item.localId
              ? {
                  ...currentItem,
                  status: 'ERROR',
                  error: 'Tệp chưa tải lên được. Hãy gỡ tệp và thử lại.',
                }
              : currentItem,
          ),
        )
      }
    } finally {
      controllers.current.delete(item.localId)
    }
  }

  async function remove(item: UploadItem) {
    setMessage('')
    if (item.status === 'UPLOADING') {
      controllers.current.get(item.localId)?.abort()
      discard(item)
      return
    }
    if (item.mediaId !== undefined && item.version !== undefined) {
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.localId === item.localId
            ? { ...currentItem, status: 'REMOVING' }
            : currentItem,
        ),
      )
      try {
        await deleteCommunityMedia(item.mediaId, item.version)
      } catch {
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.localId === item.localId
              ? {
                  ...currentItem,
                  status: 'READY',
                  error: 'Chưa thể gỡ tệp lúc này. Hãy thử lại.',
                }
              : currentItem,
          ),
        )
        return
      }
    }
    discard(item)
  }

  function discard(item: UploadItem) {
    URL.revokeObjectURL(item.previewUrl)
    previewUrls.current.delete(item.previewUrl)
    setItems((current) =>
      current.filter((currentItem) => currentItem.localId !== item.localId),
    )
  }

  return (
    <section className="community-media-uploader" aria-labelledby="media-title">
      <div className="community-media-uploader-heading">
        <div>
          <strong id="media-title">Ảnh hoặc video ngắn</strong>
          <p>
            {compact
              ? 'Tối đa 10 tệp · Ảnh ≤ 10 MB · Video ≤ 50 MB, 60 giây.'
              : 'Ảnh được loại bỏ dữ liệu vị trí trước khi hiển thị. Video dài tối đa 60 giây.'}
          </p>
        </div>
        <label className="community-media-picker">
          <span>Thêm tệp</span>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            disabled={disabled || items.length >= MAX_MEDIA}
            onChange={(event) => selectFiles(event.target.files)}
          />
        </label>
      </div>
      {items.length > 0 && (
        <ul className="community-upload-list" aria-label="Tệp đính kèm">
          {items.map((item) => (
            <li key={item.localId}>
              {item.mediaType === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview before publication
                <img src={item.previewUrl} alt="" />
              ) : (
                <video src={item.previewUrl} muted aria-label={item.fileName} />
              )}
              <div>
                <strong>{item.fileName}</strong>
                <span aria-live="polite">
                  {item.status === 'UPLOADING'
                    ? 'Đang tải lên…'
                    : item.status === 'READY'
                      ? 'Sẵn sàng đính kèm'
                      : item.status === 'REMOVING'
                        ? 'Đang gỡ…'
                        : 'Tải lên chưa thành công'}
                </span>
                {item.error && <small role="alert">{item.error}</small>}
              </div>
              <button
                type="button"
                disabled={disabled || item.status === 'REMOVING'}
                onClick={() => void remove(item)}
                aria-label={`Gỡ ${item.fileName}`}
              >
                Gỡ
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="community-form-error" role="alert">
          {message}
        </p>
      )}
      {(!compact || items.length > 0) && (
        <small>
          {items.length}/{MAX_MEDIA} tệp
        </small>
      )}
    </section>
  )
}

function validFile(file: File) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.size <= MAX_IMAGE_BYTES
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return file.size <= MAX_VIDEO_BYTES
  return false
}
