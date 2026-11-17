import { StatusBar } from 'expo-status-bar'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PressableScale } from '@/components/PressableScale'
import { setSafetyButtonLift } from '@/crisis-support/safety-button-lift'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import type { CommunitySummary } from './community-contract'
import { momentVideo } from './community-moments'
import type { usePostCommands } from './community-reaction-hooks'
import { communityColors } from './community-theme'
import { ReactionControl } from './CommunityReactions'
import { Avatar, CommunityIcon, type IconName } from './community-ui'

const viewability = { itemVisiblePercentThreshold: 60 }

/** 44 dp touch target on the dark page; `selected` is the on/off state of a toggle. */
function DarkButton({
  label,
  value,
  selected,
  onPress,
  testID,
  children,
}: Readonly<{
  label: string
  value?: string
  selected?: boolean
  onPress: () => void
  testID?: string
  children: ReactNode
}>) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(value ? { accessibilityValue: { text: value } } : {})}
      {...(selected === undefined ? {} : { accessibilityState: { selected } })}
      scaleTo={0.88}
      testID={testID}
      onPress={onPress}
      style={styles.dark}
    >
      {children}
    </PressableScale>
  )
}

const onDark = (name: IconName, size = 27) => (
  <CommunityIcon name={name} size={size} color={communityColors.white} />
)

function Playback({
  uri,
  label,
  muted,
  paused,
  progress,
  onError,
}: Readonly<{
  uri: string
  label: string
  muted: boolean
  paused: boolean
  progress: SharedValue<number>
  onError: () => void
}>) {
  const reduceMotion = useReducedMotion()
  const player = useVideoPlayer({ uri, useCaching: false }, (value) => {
    value.loop = true
    value.muted = muted
    value.timeUpdateEventInterval = 0.25
  })
  useEffect(() => {
    // expo-video players are mutable native objects; the setup callback only runs once.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted
  }, [player, muted])
  useEffect(() => {
    if (paused) player.pause()
    else player.play()
  }, [player, paused])
  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!(player.duration > 0)) return
      const next = Math.min(1, currentTime / player.duration)
      // A loop restart jumps back: snap instead of sweeping backwards.
      progress.set(
        reduceMotion || next < progress.get()
          ? next
          : withTiming(next, { duration: 250, easing: Easing.linear }),
      )
    })
    const status = player.addListener('statusChange', ({ status: value }) => {
      if (value === 'error') onError()
    })
    return () => {
      time.remove()
      status.remove()
    }
  }, [player, progress, reduceMotion, onError])
  return (
    <VideoView
      accessibilityLabel={label}
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={StyleSheet.absoluteFill}
    />
  )
}

/** The one mounted player: tap toggles pause, a failure shows a retry. Unmounting releases the player. */
function MomentPlayer({
  moment,
  muted,
  progress,
}: Readonly<{
  moment: CommunitySummary
  muted: boolean
  progress: SharedValue<number>
}>) {
  const reduceMotion = useReducedMotion()
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [background, setBackground] = useState(false)
  const glyph = useSharedValue(0)
  const first = useRef(true)
  const video = momentVideo(moment)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setBackground(state !== 'active'),
    )
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    glyph.set(
      reduceMotion
        ? userPaused
          ? 1
          : 0
        : withSequence(
            withTiming(1, { duration: 120 }),
            withDelay(450, withTiming(0, { duration: 220 })),
          ),
    )
  }, [userPaused, reduceMotion, glyph])
  const glyphStyle = useAnimatedStyle(() => ({ opacity: glyph.value }))
  const fail = useCallback(() => setFailed(true), [])
  if (!video) return null
  if (failed)
    return (
      <View accessibilityLiveRegion="polite" style={styles.error}>
        <CommunityIcon
          name="video-off-outline"
          size={32}
          color={communityColors.onDarkSoft}
        />
        <Txt style={styles.errorText}>Chưa phát được video này.</Txt>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Thử lại"
          scaleTo={0.96}
          onPress={() => {
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
          style={styles.retry}
        >
          <Txt style={styles.errorText}>Thử lại</Txt>
        </PressableScale>
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={userPaused ? 'Phát video' : 'Tạm dừng video'}
      accessibilityState={{ selected: userPaused }}
      onPress={() => setUserPaused((value) => !value)}
      style={StyleSheet.absoluteFill}
    >
      <Playback
        key={attempt}
        uri={video.url}
        label={video.altText ?? 'Video được chia sẻ'}
        muted={muted}
        paused={userPaused || background}
        progress={progress}
        onError={fail}
      />
      <Animated.View pointerEvents="none" style={[styles.glyph, glyphStyle]}>
        <CommunityIcon
          name={userPaused ? 'play' : 'pause'}
          size={40}
          color={communityColors.white}
        />
      </Animated.View>
    </Pressable>
  )
}

/** Full-screen vertical pager of moments. Only the active page plays; the others are static dark tiles. */
export function CommunityMomentsViewer({
  moments,
  startIndex,
  commands,
  onClose,
  onOpenPost,
  onLoadMore,
}: Readonly<{
  moments: readonly CommunitySummary[]
  startIndex: number
  commands: ReturnType<typeof usePostCommands>
  onClose: () => void
  /** Closes the viewer and opens the post's detail. */
  onOpenPost: (postId: string) => void
  onLoadMore?: (() => void) | undefined
}>) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [height, setHeight] = useState(windowHeight)
  const [active, setActive] = useState(startIndex)
  const [muted, setMuted] = useState(true)
  const progress = useSharedValue(0)
  const bar = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }))
  const moment = moments[Math.min(active, moments.length - 1)]
  // FlatList rejects a changing callback, so it stays one function for the viewer's life.
  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const index = viewableItems.find((item) => item.isViewable)?.index
      if (index != null) setActive(index)
    },
    [],
  )
  useEffect(() => {
    progress.set(0)
  }, [moment?.postId, progress])
  // The viewer covers the tab bar, so the floating safety button drops to the bottom row.
  useEffect(() => {
    const owner = {}
    setSafetyButtonLift(owner, 0)
    return () => setSafetyButtonLift(owner, null)
  }, [])
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose()
        return true
      },
    )
    return () => subscription.remove()
  }, [onClose])
  if (!moment) return null
  return (
    <View
      accessibilityViewIsModal
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={styles.root}
    >
      <StatusBar style="light" />
      <FlatList
        data={moments}
        keyExtractor={(item) => item.postId}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.min(startIndex, moments.length - 1)}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => (
          <View style={{ height }}>
            {index === active ? (
              <MomentPlayer
                key={item.postId}
                moment={item}
                muted={muted}
                progress={progress}
              />
            ) : (
              <View style={styles.still}>
                <CommunityIcon
                  name="play-circle-outline"
                  size={56}
                  color={communityColors.onDarkTrack}
                />
              </View>
            )}
          </View>
        )}
      />
      <View
        pointerEvents="box-none"
        style={[styles.chrome, { paddingTop: insets.top }]}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
        <View style={styles.top}>
          <DarkButton label="Đóng khoảnh khắc" onPress={onClose}>
            {onDark('arrow-left', 24)}
          </DarkButton>
          <Txt accessibilityRole="header" style={styles.title}>
            Khoảnh khắc
          </Txt>
          <DarkButton
            label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            selected={!muted}
            onPress={() => setMuted((value) => !value)}
          >
            {onDark(muted ? 'volume-off' : 'volume-high', 24)}
          </DarkButton>
        </View>
        {commands.error && (
          <Txt accessibilityLiveRegion="polite" style={styles.notice}>
            {commands.error}
          </Txt>
        )}
      </View>
      <View
        pointerEvents="box-none"
        style={[
          styles.rail,
          { bottom: insets.bottom + 118 + SAFETY_BUTTON_ROW },
        ]}
      >
        <ReactionControl
          tone="dark"
          reaction={moment.viewerState.reaction}
          count={moment.counts.reactions}
          onChange={(next) => void commands.react(moment, next)}
        />
        <DarkButton
          label={`${moment.counts.comments} bình luận`}
          onPress={() => onOpenPost(moment.postId)}
        >
          <View style={styles.railItem}>
            {onDark('comment-outline')}
            <Txt style={styles.railCount}>{moment.counts.comments}</Txt>
          </View>
        </DarkButton>
        <DarkButton
          label={
            moment.viewerState.bookmarked ? 'Bỏ lưu bài viết' : 'Lưu bài viết'
          }
          selected={moment.viewerState.bookmarked}
          onPress={() =>
            void commands.bookmark(moment, !moment.viewerState.bookmarked)
          }
        >
          {onDark(
            moment.viewerState.bookmarked ? 'bookmark' : 'bookmark-outline',
          )}
        </DarkButton>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.info,
          { bottom: insets.bottom + 20 + SAFETY_BUTTON_ROW },
        ]}
      >
        <View style={styles.who}>
          <Avatar author={moment.author} size={30} />
          <Txt numberOfLines={1} style={styles.name}>
            {moment.author.displayName}
          </Txt>
        </View>
        <Txt numberOfLines={3} style={styles.caption}>
          {moment.contentPreview}
        </Txt>
        <Txt style={styles.position}>
          {active + 1} / {moments.length}
        </Txt>
      </View>
    </View>
  )
}

// Bottom row left free for the floating safety button, which stays on screen over the viewer.
const SAFETY_BUTTON_ROW = 84

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: communityColors.momentsBackground,
  },
  still: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chrome: { left: 0, position: 'absolute', right: 0, top: 0 },
  track: {
    backgroundColor: communityColors.onDarkTrack,
    borderRadius: 2,
    height: 2.5,
    marginHorizontal: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: communityColors.white,
    height: '100%',
    transformOrigin: 'left',
    width: '100%',
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  title: {
    color: communityColors.white,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  notice: {
    alignSelf: 'center',
    backgroundColor: communityColors.onDarkLayer,
    borderRadius: 12,
    color: communityColors.white,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dark: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    minWidth: 48,
  },
  rail: {
    alignItems: 'center',
    gap: 14,
    position: 'absolute',
    right: 6,
  },
  railItem: { alignItems: 'center', gap: 2 },
  railCount: {
    color: communityColors.white,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  info: {
    backgroundColor: communityColors.onDarkLayer,
    borderRadius: 14,
    gap: spacing.xs,
    left: 14,
    padding: spacing.md,
    position: 'absolute',
    right: 70,
  },
  who: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: {
    color: communityColors.white,
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
  caption: { color: communityColors.white, fontSize: 14, lineHeight: 20 },
  position: {
    color: communityColors.onDarkSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  glyph: {
    alignItems: 'center',
    backgroundColor: communityColors.onDarkLayer,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    alignSelf: 'center',
    top: '45%',
    position: 'absolute',
    width: 72,
  },
  error: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  errorText: {
    color: communityColors.white,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  retry: {
    alignItems: 'center',
    backgroundColor: communityColors.onDarkLayer,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
})
