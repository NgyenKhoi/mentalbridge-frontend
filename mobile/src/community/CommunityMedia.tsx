import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

import type { CommunityApi } from './community-api'
import type { CommunityMedia, MediaRecord } from './community-contract'
import type { CommunityMediaTransport, SelectedMedia } from './community-media'
import {
  CommunityButton,
  CommunityMessage,
  communityStyles as styles,
} from './community-ui'

function CommunityVideo({ media }: Readonly<{ media: CommunityMedia }>) {
  const player = useVideoPlayer({ uri: media.url, useCaching: false })
  return (
    <VideoView
      accessibilityLabel={media.altText ?? 'Video được chia sẻ'}
      player={player}
      nativeControls
      style={styles.media}
    />
  )
}

export function CommunityMediaView({
  media,
}: Readonly<{ media: CommunityMedia[] }>) {
  return (
    <View style={styles.column}>
      {media.map((item) =>
        item.type === 'IMAGE' ? (
          <Image
            key={item.mediaId}
            source={{ uri: item.url }}
            accessibilityLabel={item.altText ?? 'Ảnh được chia sẻ'}
            style={styles.media}
            resizeMode="contain"
          />
        ) : (
          <CommunityVideo key={item.mediaId} media={item} />
        ),
      )}
    </View>
  )
}

type Attachment = {
  key: string
  file: SelectedMedia
  record: MediaRecord | null
  intentId: string | null
  status: 'UPLOADING' | 'READY' | 'PROCESSING' | 'ERROR'
  message?: string | undefined
}
export function CommunityMediaEditor({
  api,
  transport,
  initialMedia,
  disabled,
  onChange,
}: Readonly<{
  api: CommunityApi
  transport: CommunityMediaTransport
  initialMedia: CommunityMedia[]
  disabled: boolean
  onChange: (ids: string[], busy: boolean) => void
}>) {
  const [existing, setExisting] = useState(initialMedia)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef(new AbortController())
  const locked = useRef(false)
  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    return () => current.abort()
  }, [])
  useEffect(() => {
    onChange(
      [
        ...existing.map((media) => media.mediaId),
        ...attachments.flatMap((item) =>
          item.status === 'READY' && item.record?.state === 'READY'
            ? [item.record.mediaId]
            : [],
        ),
      ],
      picking || attachments.some((item) => item.status !== 'READY'),
    )
  }, [existing, attachments, picking, onChange])
  const change = (key: string, update: Partial<Attachment>) =>
    setAttachments((items) =>
      items.map((item) => (item.key === key ? { ...item, ...update } : item)),
    )
  const add = async () => {
    if (
      locked.current ||
      disabled ||
      existing.length + attachments.length >= 10
    )
      return
    locked.current = true
    setPicking(true)
    setError(null)
    try {
      const file = await transport.pick()
      if (!file || controller.current.signal.aborted) return
      const key = randomUUID()
      setAttachments((items) => [
        ...items,
        { key, file, record: null, intentId: null, status: 'UPLOADING' },
      ])
      try {
        const intent = await api.uploadIntent(file.request, key)
        change(key, { intentId: intent.mediaId })
        await transport.upload(file, intent, controller.current.signal)
        const record = await api.finalize(intent.mediaId)
        if (record.mediaType !== file.request.mediaType)
          throw new Error('MEDIA_TYPE_MISMATCH')
        change(key, {
          record,
          status:
            record.state === 'READY'
              ? 'READY'
              : record.state === 'PROCESSING'
                ? 'PROCESSING'
                : 'ERROR',
          message:
            record.state === 'READY'
              ? undefined
              : 'Tệp chưa được xác nhận để đăng. Bạn có thể kiểm tra lại hoặc gỡ tệp.',
        })
      } catch {
        change(key, {
          status: 'ERROR',
          message:
            'Chưa xác nhận được tệp để đăng. Kiểm tra lại nếu tệp đã tải lên hoặc gỡ tệp này.',
        })
      }
    } catch {
      setError(
        'Chưa thể chọn tệp. Cho phép truy cập thư viện nếu cần và chọn JPEG, PNG, WebP tối đa 10 MiB hoặc video MP4, WebM, QuickTime tối đa 50 MiB, 60 giây.',
      )
    } finally {
      locked.current = false
      setPicking(false)
    }
  }
  const check = async (item: Attachment) => {
    if (locked.current || !item.intentId || disabled) return
    locked.current = true
    setPicking(true)
    try {
      const record = await api.finalize(item.intentId)
      if (record.mediaType !== item.file.request.mediaType)
        throw new Error('MEDIA_TYPE_MISMATCH')
      change(item.key, {
        record,
        status:
          record.state === 'READY'
            ? 'READY'
            : record.state === 'PROCESSING'
              ? 'PROCESSING'
              : 'ERROR',
        message:
          record.state === 'READY'
            ? undefined
            : 'Tệp chưa được xác nhận để đăng.',
      })
    } catch {
      setError(
        'Chưa thể kiểm tra tệp. Không có tệp chưa xác nhận nào được đính kèm vào bài.',
      )
    } finally {
      locked.current = false
      setPicking(false)
    }
  }
  const remove = async (item: Attachment) => {
    if (locked.current || disabled) return
    locked.current = true
    setPicking(true)
    setError(null)
    try {
      if (item.intentId)
        await api.removeMedia(item.intentId, item.record?.version ?? 0)
      setAttachments((items) =>
        items.filter((current) => current.key !== item.key),
      )
    } catch {
      setError('Chưa thể gỡ tệp khỏi máy chủ. Hãy thử lại trước khi đăng bài.')
    } finally {
      locked.current = false
      setPicking(false)
    }
  }
  return (
    <View style={styles.column}>
      <Text accessibilityRole="header" style={styles.heading}>
        Ảnh và video (không bắt buộc)
      </Text>
      <Text style={styles.muted}>
        Chỉ tệp đã được xác nhận mới được đăng. Đừng chia sẻ hình ảnh hay thông
        tin nhận diện của người khác khi chưa có sự đồng ý.
      </Text>
      {existing.map((media) => (
        <View key={media.mediaId} style={styles.card}>
          <Text style={styles.body}>Tệp đã đính kèm</Text>
          <CommunityButton
            disabled={disabled || picking}
            label="Gỡ tệp đã đính kèm"
            onPress={() =>
              setExisting((items) =>
                items.filter((item) => item.mediaId !== media.mediaId),
              )
            }
          />
        </View>
      ))}
      {attachments.map((item) => (
        <View key={item.key} style={styles.card}>
          <Text style={styles.body}>
            {item.status === 'READY'
              ? 'Tệp sẵn sàng để đăng'
              : item.status === 'UPLOADING'
                ? 'Đang tải tệp…'
                : 'Tệp chưa sẵn sàng'}
          </Text>
          {item.message && <CommunityMessage>{item.message}</CommunityMessage>}
          {item.intentId && item.status !== 'READY' && (
            <CommunityButton
              label="Kiểm tra tệp"
              disabled={disabled || picking}
              onPress={() => void check(item)}
            />
          )}
          <CommunityButton
            label="Gỡ tệp mới"
            disabled={disabled || picking}
            onPress={() => void remove(item)}
          />
        </View>
      ))}
      {error && <CommunityMessage>{error}</CommunityMessage>}
      <CommunityButton
        label={picking ? 'Đang xử lý tệp…' : 'Chọn ảnh hoặc video'}
        disabled={
          disabled || picking || existing.length + attachments.length >= 10
        }
        onPress={() => void add()}
      />
    </View>
  )
}
