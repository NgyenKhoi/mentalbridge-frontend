import { useEvent } from 'expo'
import { useFocusEffect } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  AppState,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { colors, radii, spacing } from '@/theme/tokens'

import type { ResourceDetail } from './resource-contract'

// Original media from the web BreathingResourceDetail, playable by the native
// module already included in the current development APK.
const relaxationAudio = require('../../assets/resource-media/am-thanh-thu-gian-tinh-tam.mp3')
const guidanceVideo = require('../../assets/resource-media/mentalbridge-breathing-exercise.mp4')
const guidancePoster = require('../../assets/resource-media/resource-mist-landscape.png')

export function BreathingMedia({
  resource,
  onVideoPlaying,
  children,
  fontsLoaded,
}: Readonly<{
  resource: ResourceDetail
  onVideoPlaying: () => void
  children?: ReactNode
  fontsLoaded: boolean
}>) {
  const font = fontsLoaded ? { fontFamily: 'ResourceSans' } : undefined
  const sound = useVideoPlayer(null, (player) => {
    player.loop = true
    player.volume = 0.45
    player.audioMixingMode = 'mixWithOthers'
    player.staysActiveInBackground = false
  })
  const video = useVideoPlayer(null, (player) => {
    player.staysActiveInBackground = false
  })
  const { isPlaying: soundPlaying } = useEvent(sound, 'playingChange', {
    isPlaying: sound.playing,
  })
  const { status: soundStatus } = useEvent(sound, 'statusChange', {
    status: sound.status,
  })
  const { isPlaying: videoPlaying } = useEvent(video, 'playingChange', {
    isPlaying: video.playing,
  })
  const { status: videoStatus } = useEvent(video, 'statusChange', {
    status: video.status,
  })
  const [loadingSound, setLoadingSound] = useState(false)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [soundError, setSoundError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoOpened, setVideoOpened] = useState(false)
  const soundLoaded = useRef(false)
  const videoLoaded = useRef(false)
  const alive = useRef(true)
  const foreground = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      foreground.current = true
      const subscription = AppState.addEventListener('change', (state) => {
        foreground.current = state === 'active'
        if (state !== 'active') {
          sound.pause()
          video.pause()
        }
      })
      return () => {
        foreground.current = false
        subscription.remove()
        // useVideoPlayer releases its native objects on unmount.
        try {
          sound.pause()
          video.pause()
        } catch {
          /* Already released. */
        }
      }
    }, [sound, video]),
  )
  useEffect(() => {
    if (videoPlaying) {
      sound.pause()
      onVideoPlaying()
    }
  }, [videoPlaying, sound, onVideoPlaying])

  async function toggleSound() {
    if (loadingSound) return
    if (soundPlaying) {
      sound.pause()
      return
    }
    setLoadingSound(true)
    setSoundError(false)
    try {
      video.pause()
      if (!soundLoaded.current || soundStatus === 'error') {
        await sound.replaceAsync(relaxationAudio)
        soundLoaded.current = true
      }
      if (alive.current && foreground.current) sound.play()
    } catch {
      if (alive.current) setSoundError(true)
    } finally {
      if (alive.current) setLoadingSound(false)
    }
  }
  async function openVideo() {
    if (loadingVideo) return
    setLoadingVideo(true)
    setVideoError(false)
    try {
      sound.pause()
      onVideoPlaying()
      if (!videoLoaded.current || videoStatus === 'error') {
        await video.replaceAsync(guidanceVideo)
        videoLoaded.current = true
      }
      if (alive.current && foreground.current) {
        setVideoOpened(true)
        video.play()
      }
    } catch {
      if (alive.current) setVideoError(true)
    } finally {
      if (alive.current) setLoadingVideo(false)
    }
  }

  return (
    <>
      <View style={styles.sound}>
        <View style={styles.soundIcon}>
          <Text accessible={false} style={styles.icon}>
            ≋
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.label, font]}>Âm thanh thư giãn tĩnh tâm</Text>
          <Text style={[styles.small, font]}>
            {soundPlaying
              ? 'Đang phát · âm lượng 45%'
              : 'Nghe theo nhịp của bạn'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={soundPlaying ? 'Tắt âm thanh' : 'Bật âm thanh'}
          accessibilityState={{
            selected: soundPlaying,
            disabled: loadingSound,
          }}
          disabled={loadingSound}
          onPress={() => void toggleSound()}
          style={styles.toggle}
        >
          <Text style={[styles.link, font]}>
            {loadingSound ? 'Đang tải…' : soundPlaying ? 'Tắt' : 'Bật'}
          </Text>
        </Pressable>
      </View>
      {soundError || soundStatus === 'error' ? (
        <Text accessibilityRole="alert" style={[styles.error, font]}>
          Chưa phát được âm thanh. Bạn có thể bấm Bật để thử lại.
        </Text>
      ) : null}
      {children}
      <View style={styles.videoCard}>
        <View style={styles.videoHeader}>
          <Text style={[styles.link, font]}>▷ VIDEO THỰC HÀNH DẪN DẮT</Text>
          {videoOpened && video.duration > 0 ? (
            <Text style={[styles.small, font]}>
              {Math.floor(video.duration / 60)}:
              {String(Math.floor(video.duration % 60)).padStart(2, '0')}
            </Text>
          ) : null}
        </View>
        {videoOpened ? (
          <VideoView
            player={video}
            nativeControls
            contentFit="contain"
            style={styles.video}
            accessibilityLabel={`Video hướng dẫn ${resource.title}`}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Phát video Cùng tập thở thật nhẹ"
            disabled={loadingVideo}
            onPress={() => void openVideo()}
          >
            <ImageBackground
              source={guidancePoster}
              style={styles.video}
              imageStyle={styles.cover}
            >
              <View style={styles.posterShade}>
                {loadingVideo ? (
                  <ActivityIndicator
                    accessibilityLabel="Đang tải video"
                    color={colors.white}
                  />
                ) : (
                  <Text accessible={false} style={styles.play}>
                    ▷
                  </Text>
                )}
                <Text style={[styles.posterTitle, font]}>
                  Cùng tập thở thật nhẹ
                </Text>
              </View>
            </ImageBackground>
          </Pressable>
        )}
        {videoError || videoStatus === 'error' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void openVideo()}
            style={styles.retry}
          >
            <Text accessibilityRole="alert" style={[styles.error, font]}>
              Chưa phát được video. Chạm để thử lại.
            </Text>
          </Pressable>
        ) : null}
        <Text style={[styles.videoCopy, font]}>
          Xem theo nhịp phù hợp với bạn, rồi quay lại vòng thở phía trên để thực
          hành.
        </Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sound: {
    backgroundColor: '#eaf2ed',
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  soundIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: '#dbe8df',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { color: colors.tealDeep, fontSize: 20 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  small: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  link: { color: colors.tealDeep, fontSize: 11, fontWeight: '700' },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e3ece6',
  },
  videoHeader: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#d4e1d9' },
  cover: { resizeMode: 'cover' },
  posterShade: {
    flex: 1,
    backgroundColor: 'rgba(15, 55, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  play: {
    color: colors.tealDeep,
    backgroundColor: '#f4fff6',
    borderRadius: radii.pill,
    overflow: 'hidden',
    width: 48,
    lineHeight: 48,
    textAlign: 'center',
    fontSize: 27,
  },
  posterTitle: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  videoCopy: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.md,
  },
  error: { color: '#9b352d', fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center', padding: spacing.md },
})
