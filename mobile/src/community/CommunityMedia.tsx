import { randomUUID } from 'expo-crypto'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from './community-theme'

import type { CommunityApi } from './community-api'
import type { CommunityMedia, MediaRecord } from './community-contract'
import type { CommunityMediaTransport, SelectedMedia } from './community-media'
import {
  CommunityButton,
  CommunityIcon,
  CommunityMessage,
  communityText,
  IconButton,
  type IconName,
} from './community-ui'

const AnimatedImage = Animated.createAnimatedComponent(Image)

function FadeImage({
  media,
  onError,
}: Readonly<{ media: CommunityMedia; onError: () => void }>) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <AnimatedImage
      source={{ uri: media.url }}
      accessibilityLabel={media.altText ?? 'Ảnh được chia sẻ'}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, fade]}
      onLoad={() =>
        opacity.set(reduceMotion ? 1 : withTiming(1, { duration: 200 }))
      }
      onError={onError}
    />
  )
}

function CommunityVideo({
  media,
  fit,
  onError,
}: Readonly<{
  media: CommunityMedia
  fit: 'cover' | 'contain'
  onError: () => void
}>) {
  const player = useVideoPlayer({ uri: media.url, useCaching: false })
  useEffect(() => {
    const subscription = player?.addListener('statusChange', ({ status }) => {
      if (status === 'error') onError()
    })
    return () => subscription?.remove()
  }, [player, onError])
  return (
    <VideoView
      accessibilityLabel={media.altText ?? 'Video được chia sẻ'}
      player={player}
      nativeControls
      contentFit={fit}
      style={StyleSheet.absoluteFill}
    />
  )
}

function ErrorTile({
  type,
  compact,
  onRetry,
}: Readonly<{
  type: CommunityMedia['type']
  compact: boolean
  onRetry: () => void
}>) {
  return (
    <View accessibilityLiveRegion="polite" style={tile.error}>
      {!compact && (
        <CommunityIcon
          name={type === 'IMAGE' ? 'image-broken-variant' : 'video-off-outline'}
          color={communityColors.inkSoft}
        />
      )}
      <Txt style={[communityText.meta, tile.errorText]}>
        {type === 'IMAGE' ? 'Chưa tải được ảnh' : 'Chưa tải được video'}
      </Txt>
      <View style={tile.retry}>
        <CommunityButton
          variant="quiet"
          label="Thử tải lại"
          onPress={onRetry}
        />
      </View>
    </View>
  )
}

/** One placeholder box: the media fades in over `surfaceSoft`; a failed load becomes a retry tile. */
function MediaTile({
  item,
  style,
  single = false,
  still = false,
  flush = false,
  children,
}: Readonly<{
  item: CommunityMedia
  style: StyleProp<ViewStyle>
  /** Edge-to-edge: no corner radius. */
  flush?: boolean
  single?: boolean
  /** Feed preview: a video shows a play cue instead of loading a player. */
  still?: boolean
  children?: ReactNode
}>) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const fail = () => setFailed(true)
  return (
    <View
      style={[
        tile.box,
        flush && tile.flush,
        item.type === 'VIDEO' && single && !still && tile.dark,
        style,
      ]}
    >
      {failed ? (
        <ErrorTile
          type={item.type}
          compact={!single}
          onRetry={() => {
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
        />
      ) : item.type === 'IMAGE' ? (
        <FadeImage key={attempt} media={item} onError={fail} />
      ) : still ? (
        <View style={tile.cue}>
          <CommunityIcon name="play-circle-outline" size={40} />
        </View>
      ) : (
        <CommunityVideo
          key={attempt}
          media={item}
          fit={single ? 'contain' : 'cover'}
          onError={fail}
        />
      )}
      {children}
    </View>
  )
}

/** Detail view: 1 = 16:10, 2 = two squares, 3+ = one large and two small with "+n" that opens the rest. */
export function CommunityMediaView({
  media,
  flush = false,
}: Readonly<{ media: CommunityMedia[]; flush?: boolean }>) {
  const [expanded, setExpanded] = useState(false)
  const [first, second, third] = media
  if (!first) return null
  if (!second)
    return <MediaTile single flush={flush} item={first} style={tile.wide} />
  if (!third)
    return (
      <View style={tile.row}>
        <MediaTile flush={flush} item={first} style={tile.square} />
        <MediaTile flush={flush} item={second} style={tile.square} />
      </View>
    )
  if (expanded)
    return (
      <View style={tile.wrap}>
        {media.map((item) => (
          <MediaTile
            key={item.mediaId}
            flush={flush}
            item={item}
            style={tile.cell}
          />
        ))}
      </View>
    )
  const more = media.length - 3
  return (
    <View style={tile.large}>
      <MediaTile flush={flush} item={first} style={tile.fill} />
      <View style={tile.stack}>
        <MediaTile flush={flush} item={second} style={tile.fill} />
        <MediaTile flush={flush} item={third} style={tile.fill}>
          {more > 0 && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Xem thêm ${more} ảnh và video`}
              scaleTo={0.98}
              onPress={() => setExpanded(true)}
              style={tile.moreHit}
            >
              <View style={tile.scrim} />
              <Txt style={tile.moreText}>+{more}</Txt>
            </PressableScale>
          )}
        </MediaTile>
      </View>
    </View>
  )
}

/** Feed card preview: the first item only, with "+n" for the rest; the card itself opens the post. */
export function CommunityMediaPreview({
  media,
  flush = false,
}: Readonly<{ media: CommunityMedia[]; flush?: boolean }>) {
  const [first] = media
  if (!first) return null
  const more = media.length - 1
  return (
    <MediaTile
      still
      flush={flush}
      item={first}
      style={first.type === 'VIDEO' ? tile.video : tile.wide}
    >
      {more > 0 && (
        <View style={tile.badge}>
          <Txt style={tile.badgeText}>+{more}</Txt>
        </View>
      )}
    </MediaTile>
  )
}

/** Square grid thumbnail filling its cell: an image, or a dark tile with a play glyph for a video. */
export function CommunityMediaThumb({
  media,
}: Readonly<{ media: CommunityMedia }>) {
  if (media.type === 'VIDEO')
    return (
      <View style={[StyleSheet.absoluteFill, tile.videoThumb]}>
        <CommunityIcon
          name="play-circle-outline"
          size={32}
          color={communityColors.white}
        />
      </View>
    )
  return <MediaTile flush item={media} style={StyleSheet.absoluteFill} />
}

const tile = StyleSheet.create({
  videoThumb: {
    alignItems: 'center',
    backgroundColor: communityColors.primaryDeep,
    justifyContent: 'center',
  },
  box: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.control,
    overflow: 'hidden',
  },
  flush: { borderRadius: 0 },
  dark: { backgroundColor: communityColors.ink },
  wide: { aspectRatio: 16 / 10, width: '100%' },
  video: { aspectRatio: 16 / 9, width: '100%' },
  square: { aspectRatio: 1, flex: 1 },
  fill: { flex: 1 },
  cell: { aspectRatio: 1, flexBasis: '48%', flexGrow: 1 },
  row: { flexDirection: 'row', gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  large: { aspectRatio: 1, flexDirection: 'row', gap: spacing.xs },
  stack: { flex: 1, gap: spacing.xs },
  error: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  errorText: { textAlign: 'center' },
  retry: { alignSelf: 'center' },
  cue: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  moreHit: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: communityColors.ink,
    opacity: 0.6,
  },
  moreText: { color: communityColors.white, fontSize: 22, fontWeight: '700' },
  badge: {
    backgroundColor: communityColors.ink,
    borderRadius: radii.pill,
    bottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.sm,
  },
  badgeText: { color: communityColors.white, fontSize: 13, fontWeight: '600' },
})

type Attachment = {
  key: string
  file: SelectedMedia
  record: MediaRecord | null
  intentId: string | null
  status: 'UPLOADING' | 'READY' | 'PROCESSING' | 'ERROR'
  message?: string | undefined
}

function Thumb({
  type,
  uri,
}: Readonly<{ type: 'IMAGE' | 'VIDEO'; uri: string | null }>) {
  const [failed, setFailed] = useState(false)
  return (
    <View style={editor.thumb}>
      {type === 'IMAGE' && uri && !failed ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
        />
      ) : (
        <CommunityIcon
          name={type === 'VIDEO' ? 'play-circle-outline' : 'image-outline'}
          size={28}
        />
      )}
    </View>
  )
}

function StatusChip({
  label,
  icon,
  busy = false,
  error = false,
  ready = false,
}: Readonly<{
  label: string
  icon?: IconName
  busy?: boolean
  error?: boolean
  ready?: boolean
}>) {
  const tint = error ? communityColors.danger : communityColors.primaryDeep
  return (
    <View style={[editor.chip, ready && editor.chipReady]}>
      {busy ? (
        <ActivityIndicator
          size="small"
          color={communityColors.primaryDeep}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        icon && <CommunityIcon name={icon} size={16} color={tint} />
      )}
      <Txt style={[editor.chipText, { color: tint }]}>{label}</Txt>
    </View>
  )
}

/** Soft full-width row with a leading glyph: the attach actions of the composer. */
export function AttachRow({
  icon,
  label,
  onPress,
  disabled = false,
}: Readonly<{
  icon: IconName
  label: string
  onPress: () => void
  disabled?: boolean
}>) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      scaleTo={0.98}
      onPress={onPress}
      style={[editor.attach, disabled && editor.disabled]}
    >
      <CommunityIcon name={icon} />
      <Txt style={[communityText.body, editor.attachLabel]}>{label}</Txt>
    </PressableScale>
  )
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
    <View style={editor.card}>
      <Txt accessibilityRole="header" style={editor.title}>
        Ảnh và video (không bắt buộc)
      </Txt>
      <Txt style={communityText.meta}>
        Chỉ tệp đã được xác nhận mới được đăng. Đừng chia sẻ hình ảnh hay thông
        tin nhận diện của người khác khi chưa có sự đồng ý.
      </Txt>
      {existing.map((media) => (
        <View key={media.mediaId} style={editor.row}>
          <Thumb
            type={media.type}
            uri={media.type === 'IMAGE' ? media.url : null}
          />
          <View style={editor.body}>
            <StatusChip icon="paperclip" label="Tệp đã đính kèm" />
          </View>
          <IconButton
            icon="close"
            label="Gỡ tệp đã đính kèm"
            disabled={disabled || picking}
            onPress={() =>
              setExisting((items) =>
                items.filter((item) => item.mediaId !== media.mediaId),
              )
            }
          />
        </View>
      ))}
      {attachments.map((item) => (
        <View key={item.key} style={editor.row}>
          <Thumb type={item.file.request.mediaType} uri={item.file.uri} />
          <View accessibilityLiveRegion="polite" style={editor.body}>
            {item.status === 'READY' ? (
              <StatusChip
                ready
                icon="check-circle-outline"
                label="Tệp sẵn sàng để đăng"
              />
            ) : item.status === 'UPLOADING' ? (
              <StatusChip busy label="Đang tải tệp…" />
            ) : (
              <StatusChip
                error={item.status === 'ERROR'}
                icon={
                  item.status === 'ERROR'
                    ? 'alert-circle-outline'
                    : 'timer-sand'
                }
                label="Tệp chưa sẵn sàng"
              />
            )}
            {item.message && (
              <Txt style={communityText.meta}>{item.message}</Txt>
            )}
            {item.intentId && item.status !== 'READY' && (
              <CommunityButton
                variant="quiet"
                icon="refresh"
                label="Kiểm tra tệp"
                disabled={disabled || picking}
                onPress={() => void check(item)}
              />
            )}
          </View>
          <IconButton
            icon="close"
            label="Gỡ tệp mới"
            disabled={disabled || picking}
            onPress={() => void remove(item)}
          />
        </View>
      ))}
      {error && <CommunityMessage>{error}</CommunityMessage>}
      <AttachRow
        icon="image-plus"
        label={picking ? 'Đang xử lý tệp…' : 'Chọn ảnh hoặc video'}
        disabled={
          disabled || picking || existing.length + attachments.length >= 10
        }
        onPress={() => void add()}
      />
    </View>
  )
}

const editor = StyleSheet.create({
  card: { gap: spacing.md },
  title: {
    color: communityColors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  attach: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  attachLabel: { flex: 1 },
  disabled: { opacity: 0.55 },
  row: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: communityColors.background,
    borderRadius: radii.control,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  body: { alignItems: 'flex-start', flex: 1, gap: spacing.xs },
  chip: {
    alignItems: 'center',
    backgroundColor: communityColors.background,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.md,
  },
  chipReady: { backgroundColor: communityColors.mint },
  chipText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
})
