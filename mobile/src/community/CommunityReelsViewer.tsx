import { useEvent } from 'expo'
import { useFocusEffect } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { CommunityApi } from './community-api'
import type { CommunityMedia, CommunitySummary } from './community-contract'
import { useCommunityAction } from './community-ui'

export type CommunityReel = {
  id: string
  media: CommunityMedia
  post: CommunitySummary
}
const reelViewability = { itemVisiblePercentThreshold: 75 }

export function CommunityReelPreview({
  media,
}: Readonly<{ media: CommunityMedia }>) {
  const player = useVideoPlayer(
    { uri: media.url, useCaching: false },
    (video) => {
      video.muted = true
      video.staysActiveInBackground = false
    },
  )
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      surfaceType="textureView"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  )
}

function ReelPage({
  item,
  active,
  muted,
  height,
  api,
  onMute,
  onOpenPost,
}: Readonly<{
  item: CommunityReel
  active: boolean
  muted: boolean
  height: number
  api: CommunityApi
  onMute: () => void
  onOpenPost: (id: string) => void
}>) {
  const [paused, setPaused] = useState(false)
  const [post, setPost] = useState(item.post)
  const [unavailable, setUnavailable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const action = useCommunityAction()
  const player = useVideoPlayer(
    { uri: item.media.url, useCaching: false },
    (video) => {
      video.loop = true
      video.muted = muted
      video.staysActiveInBackground = false
      video.timeUpdateEventInterval = 0.25
    },
  )
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const playbackTime = useEvent(player, 'timeUpdate')
  const currentTime = playbackTime?.currentTime ?? 0
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  )
  const [focused, setFocused] = useState(true)

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    )
    return () => listener.remove()
  }, [])
  useEffect(() => {
    // expo-video exposes mute through an imperative native player setter.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted
  }, [player, muted])
  useEffect(() => {
    if (active && foreground && focused && !paused && !unavailable)
      player.play()
    else player.pause()
    return () => {
      // Native players are also released automatically by useVideoPlayer.
      try {
        player.pause()
      } catch {
        /* Player already released during unmount. */
      }
    }
  }, [player, active, foreground, focused, paused, unavailable, retryCount])

  const change = (operation: () => Promise<void>) =>
    void action.run(async () => {
      try {
        await operation()
        const result = await api.detail(item.post.postId)
        if (result.post.sensitiveContentWarning) setUnavailable(true)
        else setPost({ ...result.post, contentPreview: result.post.content })
      } catch (error) {
        setUnavailable(true)
        throw error
      }
    })
  const retryVideo = async () => {
    try {
      await player.replaceAsync({ uri: item.media.url, useCaching: false })
      setPaused(false)
      setRetryCount((value) => value + 1)
    } catch {
      setPaused(true)
    }
  }
  const progress =
    player.duration > 0
      ? Math.max(0, Math.min(1, currentTime / player.duration))
      : 0

  return (
    <View style={[s.page, { height }]}>
      {!unavailable && (
        <>
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={false}
            surfaceType="textureView"
            style={StyleSheet.absoluteFill}
            accessibilityLabel={item.media.altText ?? 'Video cộng đồng'}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Phát video' : 'Tạm dừng video'}
            onPress={() => setPaused((value) => !value)}
            style={s.playback}
          >
            {paused && (
              <View style={s.pauseCircle}>
                <Text aria-hidden style={s.pauseGlyph}>
                  ▷
                </Text>
              </View>
            )}
          </Pressable>
        </>
      )}
      {status === 'loading' && !unavailable && (
        <ActivityIndicator
          color="#FFFFFF"
          size="large"
          style={s.loading}
          accessibilityLabel="Đang tải video"
        />
      )}
      {status === 'error' && !unavailable && (
        <View style={s.videoError}>
          <Text style={s.white}>Chưa tải được video này.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retryVideo()}
            style={s.retry}
          >
            <Text style={s.white}>Thử lại</Text>
          </Pressable>
        </View>
      )}
      {unavailable && (
        <View style={s.videoError}>
          <Text style={s.white}>
            Chưa xác nhận được nội dung này. Đóng Reels và tải lại bảng tin để
            kiểm tra.
          </Text>
        </View>
      )}
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        style={s.bottom}
        pointerEvents="box-none"
      >
        <View style={s.bottomRow} pointerEvents="box-none">
          <View style={s.caption}>
            <View style={s.authorRow}>
              {post.author.avatarImage ? (
                <Image
                  source={{ uri: post.author.avatarImage.url }}
                  accessibilityLabel={post.author.displayName}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarLetter}>
                    {post.author.displayName.trim().charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={s.authorName}>{post.author.displayName}</Text>
            </View>
            {!unavailable && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? 'Thu gọn mô tả video' : 'Xem thêm mô tả video'
                }
                onPress={() => setExpanded((value) => !value)}
              >
                <Text numberOfLines={expanded ? 7 : 3} style={s.description}>
                  {post.contentPreview}
                </Text>
              </Pressable>
            )}
            <Text style={s.audioLabel}>♫ Video từ cộng đồng MentalBridge</Text>
            {action.error && (
              <Text accessibilityLiveRegion="polite" style={s.error}>
                {action.error}
              </Text>
            )}
          </View>
          {!unavailable && (
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đồng cảm với video"
                accessibilityState={{
                  selected: post.viewerState.reaction === 'RELATE',
                  disabled: action.busy,
                }}
                disabled={action.busy}
                onPress={() =>
                  change(() =>
                    api.react(
                      post.postId,
                      post.viewerState.reaction === 'RELATE' ? null : 'RELATE',
                    ),
                  )
                }
                style={s.action}
              >
                <Text
                  aria-hidden
                  style={[
                    s.actionGlyph,
                    post.viewerState.reaction === 'RELATE' && s.active,
                  ]}
                >
                  ♥
                </Text>
                <Text style={s.count}>{post.counts.reactions}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bình luận video"
                onPress={() => onOpenPost(post.postId)}
                style={s.action}
              >
                <View aria-hidden style={s.commentIcon}>
                  <View style={s.commentTail} />
                </View>
                <Text style={s.count}>{post.counts.comments}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  post.viewerState.bookmarked ? 'Bỏ lưu video' : 'Lưu video'
                }
                accessibilityState={{
                  selected: post.viewerState.bookmarked,
                  disabled: action.busy,
                }}
                disabled={action.busy}
                onPress={() =>
                  change(() =>
                    api.bookmark(post.postId, !post.viewerState.bookmarked),
                  )
                }
                style={s.action}
              >
                <Text
                  aria-hidden
                  style={[
                    s.actionGlyph,
                    post.viewerState.bookmarked && s.active,
                  ]}
                >
                  ▤
                </Text>
                <Text style={s.count}>Lưu</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  muted ? 'Bật tiếng video' : 'Tắt tiếng video'
                }
                onPress={onMute}
                style={s.action}
              >
                <Text aria-hidden style={s.actionGlyph}>
                  {muted ? '♪̸' : '♫'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Tiến độ phát video"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress * 100),
          }}
          style={s.progressTrack}
        >
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </SafeAreaView>
    </View>
  )
}

export function CommunityReelsViewer({
  items,
  initialId,
  api,
  onClose,
  onOpenPost,
  onLoadMore,
}: Readonly<{
  items: CommunityReel[]
  initialId: string
  api: CommunityApi
  onClose: () => void
  onOpenPost: (id: string) => void
  onLoadMore?: (() => void) | undefined
}>) {
  const start = Math.max(
    0,
    items.findIndex((item) => item.id === initialId),
  )
  const [activeIndex, setActiveIndex] = useState(start)
  const [size, setSize] = useState({ height: 0, width: 0 })
  const [muted, setMuted] = useState(true)
  const list = useRef<FlatList<CommunityReel>>(null)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<CommunityReel>[] }) => {
      const visible = viewableItems.find(
        (item) => item.isViewable && item.index !== null,
      )
      if (visible?.index != null) setActiveIndex(visible.index)
    },
    [],
  )
  if (!items.length) return null
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        testID="community-reels"
        style={s.viewer}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setSize((current) =>
            current.width === width && current.height === height
              ? current
              : { width, height },
          )
        }}
      >
        {size.height > 0 && (
          <FlatList
            testID="community-reels-list"
            key={`${size.width}:${size.height}`}
            ref={list}
            data={items}
            keyExtractor={(item) => item.id}
            initialScrollIndex={Math.min(activeIndex, items.length - 1)}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_data, index) => ({
              length: size.height,
              offset: size.height * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            onMomentumScrollEnd={(event) => {
              setActiveIndex(
                Math.min(
                  items.length - 1,
                  Math.max(
                    0,
                    Math.round(event.nativeEvent.contentOffset.y / size.height),
                  ),
                ),
              )
            }}
            viewabilityConfig={reelViewability}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) =>
              Math.abs(index - activeIndex) <= 1 ? (
                <ReelPage
                  item={item}
                  active={index === activeIndex}
                  muted={muted}
                  height={size.height}
                  api={api}
                  onMute={() => setMuted((value) => !value)}
                  onOpenPost={onOpenPost}
                />
              ) : (
                <View
                  style={{ height: size.height, backgroundColor: '#080E0C' }}
                />
              )
            }
            extraData={{ activeIndex, muted }}
          />
        )}
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={s.top}
          pointerEvents="box-none"
        >
          <View style={s.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng Reels"
              onPress={onClose}
              style={s.close}
            >
              <Text aria-hidden style={s.closeGlyph}>
                ‹
              </Text>
            </Pressable>
            <Text accessibilityRole="header" style={s.reelsTitle}>
              Reels
            </Text>
            <Text style={s.position}>
              {activeIndex + 1}/{items.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Video trước"
              accessibilityState={{ disabled: activeIndex === 0 }}
              disabled={activeIndex === 0}
              onPress={() =>
                list.current?.scrollToIndex({ index: activeIndex - 1 })
              }
              style={s.close}
            >
              <Text aria-hidden style={s.white}>
                ↑
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                activeIndex >= items.length - 1 && onLoadMore
                  ? 'Tải thêm Reels'
                  : 'Video tiếp theo'
              }
              accessibilityState={{
                disabled: activeIndex >= items.length - 1 && !onLoadMore,
              }}
              disabled={activeIndex >= items.length - 1 && !onLoadMore}
              onPress={() =>
                activeIndex < items.length - 1
                  ? list.current?.scrollToIndex({ index: activeIndex + 1 })
                  : onLoadMore?.()
              }
              style={s.close}
            >
              <Text aria-hidden style={s.white}>
                ↓
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: '#080E0C' },
  page: { backgroundColor: '#080E0C', overflow: 'hidden' },
  playback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseGlyph: { color: '#FFFFFF', fontSize: 42 },
  loading: { position: 'absolute', top: '46%', alignSelf: 'center' },
  videoError: {
    position: 'absolute',
    top: '38%',
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 14,
  },
  white: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  retry: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: '#285A47',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(5,14,10,0.3)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: '#FFFFFF', fontSize: 38 },
  reelsTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22, flex: 1 },
  position: { color: '#D6E2DB', fontSize: 12, paddingRight: 16 },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(5,14,10,0.55)',
    padding: 16,
    gap: 16,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  caption: { flex: 1, gap: 10, paddingBottom: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CBE9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#123F32', fontWeight: '800', fontSize: 16 },
  authorName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  description: { fontSize: 14, lineHeight: 22, color: '#FFFFFF' },
  audioLabel: { fontSize: 11, color: '#CADAD1' },
  actions: { gap: 10 },
  action: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  actionGlyph: { color: '#FFFFFF', fontSize: 27 },
  commentIcon: {
    width: 26,
    height: 21,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 4,
  },
  commentTail: {
    position: 'absolute',
    width: 6,
    height: 6,
    bottom: -5,
    left: 3,
    borderLeftWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ skewY: '-30deg' }],
  },
  active: { color: '#A1E8C8' },
  count: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  error: { color: '#FFE0CF', fontSize: 12, lineHeight: 18 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
})
