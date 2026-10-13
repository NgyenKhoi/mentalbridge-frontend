import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/react-native'
import { RTCView } from '@livekit/react-native-webrtc'
import { createLocalTracks, Track, type LocalTrack } from 'livekit-client'
import { useEffect, useRef, useState } from 'react'
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import type { VideoMediaProps } from './video-media-props'
import { videoStyles as styles } from './video-styles'

// Serialize global audio lifecycle so a late stop from a previous mount cannot
// interrupt a new session. No token, room, or personal data enters this queue.
let audioLifecycle: Promise<void> = Promise.resolve()
function audioOperation(operation: () => Promise<void>) {
  audioLifecycle = audioLifecycle.catch(() => undefined).then(operation)
  return audioLifecycle
}

export async function requestMediaPermission(kind: 'camera' | 'microphone') {
  if (Platform.OS !== 'android') return true // iOS asks at capture; localized CNG purpose strings.
  const permission =
    kind === 'camera'
      ? PermissionsAndroid.PERMISSIONS.CAMERA
      : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  )
}

export default function VideoMedia({
  access,
  previewAllowed,
  onLeave,
  onError,
}: VideoMediaProps) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let mounted = true
    void audioOperation(AudioSession.startAudioSession)
      .then(() => {
        if (mounted) setReady(true)
      })
      .catch(() => {
        if (mounted) setFailed(true)
      })
    return () => {
      mounted = false
      void audioOperation(AudioSession.stopAudioSession).catch(() => undefined)
    }
  }, [])
  if (failed)
    return (
      <Text accessibilityRole="alert" style={styles.error}>
        Chưa mở được âm thanh cuộc gọi. Đóng phiên video và thử lại.
      </Text>
    )
  if (!ready) return <Text style={styles.copy}>Đang chuẩn bị âm thanh…</Text>
  if (!access) return previewAllowed ? <DevicePreview /> : null
  return (
    <LiveKitRoom
      serverUrl={access.serverUrl}
      token={access.participantToken}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
      onDisconnected={onLeave}
      onError={onError}
    >
      <CallControls onLeave={onLeave} />
    </LiveKitRoom>
  )
}

function DevicePreview() {
  const active = useRef(false)
  const tracks = useRef<LocalTrack[]>([])
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      tracks.current.forEach((track) => track.stop())
      tracks.current = []
    }
  }, [])
  async function preview() {
    if (busy) return
    if (tracks.current.length) {
      tracks.current.forEach((track) => track.stop())
      tracks.current = []
      setStreamUrl(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (
        !(await requestMediaPermission('camera')) ||
        !(await requestMediaPermission('microphone'))
      ) {
        if (active.current)
          setError(
            'Cần quyền camera và micro để kiểm tra thiết bị. Bạn có thể bật quyền trong Cài đặt hoặc vào phiên rồi chọn thiết bị riêng.',
          )
        return
      }
      if (!active.current) return
      const local = await createLocalTracks({ audio: true, video: true })
      if (!active.current) {
        local.forEach((track) => track.stop())
        return
      }
      tracks.current = local
      const stream = local.find(
        (track) => track.kind === Track.Kind.Video,
      )?.mediaStream
      if (stream && 'toURL' in stream && typeof stream.toURL === 'function') {
        const url: unknown = stream.toURL()
        if (typeof url === 'string') setStreamUrl(url)
      }
    } catch {
      if (active.current)
        setError(
          'Chưa mở được thiết bị. Kiểm tra quyền camera/micro hoặc đóng ứng dụng khác đang dùng thiết bị rồi thử lại.',
        )
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <View style={styles.stage}>
      {streamUrl && (
        <RTCView
          streamURL={streamUrl}
          objectFit="contain"
          mirror
          style={styles.video}
        />
      )}
      <Text style={styles.light}>
        {streamUrl
          ? 'Thiết bị đã mở trên máy, chưa kết nối với người còn lại.'
          : 'Kiểm tra camera và micro trước khi tham gia'}
      </Text>
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.light}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void preview()}
        style={styles.button}
      >
        <Text style={styles.label}>
          {busy
            ? 'Đang mở thiết bị…'
            : streamUrl
              ? 'Dừng kiểm tra thiết bị'
              : 'Kiểm tra camera và micro'}
        </Text>
      </Pressable>
    </View>
  )
}

function CallControls({ onLeave }: { onLeave: () => void }) {
  const connection = useConnectionState()
  const remote = useRemoteParticipants()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant()
  const cameras = useTracks([Track.Source.Camera])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [outputs, setOutputs] = useState<string[]>([])
  const [output, setOutput] = useState('')
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    void AudioSession.getAudioOutputs()
      .then((value) => {
        if (alive.current) setOutputs(value)
      })
      .catch(() => {
        if (alive.current)
          setError(
            'Chưa đọc được thiết bị âm thanh. Âm thanh vẫn dùng lựa chọn mặc định của máy.',
          )
      })
    return () => {
      alive.current = false
    }
  }, [])
  async function toggle(kind: 'camera' | 'microphone') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const enabling =
        kind === 'camera' ? !isCameraEnabled : !isMicrophoneEnabled
      if (enabling && !(await requestMediaPermission(kind))) {
        if (alive.current)
          setError(
            'Chưa được cấp quyền thiết bị. Hãy mở Cài đặt để cho phép camera/micro, rồi thử lại.',
          )
        return
      }
      if (!alive.current) return
      if (kind === 'camera')
        await localParticipant.setCameraEnabled(!isCameraEnabled)
      else await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      if (alive.current)
        setError(
          'Chưa bật được thiết bị. Kiểm tra quyền và thiết bị rồi thử lại.',
        )
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  async function selectOutput(value: string) {
    try {
      await AudioSession.selectAudioOutput(value)
      if (alive.current) setOutput(value)
    } catch {
      if (alive.current)
        setError(
          'Chưa chuyển được âm thanh. Thử kết nối lại tai nghe hoặc chọn loa máy.',
        )
    }
  }
  const reconnecting =
    connection === 'reconnecting' || connection === 'signalReconnecting'
  const outputLabels: Record<string, string> = {
    speaker: 'Loa ngoài',
    earpiece: 'Loa thoại',
    headset: 'Tai nghe',
    bluetooth: 'Tai nghe Bluetooth',
    default: 'Âm thanh mặc định',
    force_speaker: 'Loa ngoài',
  }
  return (
    <View style={styles.stage}>
      <Text accessibilityLiveRegion="polite" style={styles.light}>
        {reconnecting
          ? 'Mất kết nối — đang kết nối lại…'
          : connection !== 'connected'
            ? 'Đang kết nối cuộc gọi…'
            : remote.length
              ? 'Đã kết nối với người còn lại'
              : 'Đang chờ người còn lại tham gia'}
      </Text>
      {cameras.map((track) => (
        <View key={track.participant.identity}>
          <VideoTrack
            trackRef={track}
            style={styles.video}
            objectFit="contain"
            mirror={track.participant.isLocal}
          />
          <Text style={styles.light}>
            {track.participant.isLocal ? 'Bạn' : 'Người tham gia cùng bạn'}
          </Text>
        </View>
      ))}
      {!cameras.some((track) => !track.participant.isLocal) && (
        <Text style={styles.light}>
          {remote.length
            ? 'Người còn lại đang tắt camera'
            : 'Chờ người còn lại'}
        </Text>
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.light}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          selected: isMicrophoneEnabled,
          disabled: busy || connection !== 'connected',
        }}
        disabled={busy || connection !== 'connected'}
        style={styles.button}
        onPress={() => void toggle('microphone')}
      >
        <Text style={styles.label}>
          Micro: {isMicrophoneEnabled ? 'Đang bật' : 'Đang tắt'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          selected: isCameraEnabled,
          disabled: busy || connection !== 'connected',
        }}
        disabled={busy || connection !== 'connected'}
        style={styles.button}
        onPress={() => void toggle('camera')}
      >
        <Text style={styles.label}>
          Camera: {isCameraEnabled ? 'Đang bật' : 'Đang tắt'}
        </Text>
      </Pressable>
      {outputs
        .filter((value) => value in outputLabels)
        .map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: output === value }}
            style={styles.button}
            onPress={() => void selectOutput(value)}
          >
            <Text style={styles.label}>{outputLabels[value]}</Text>
          </Pressable>
        ))}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={onLeave}
      >
        <Text style={styles.label}>Rời cuộc gọi</Text>
      </Pressable>
    </View>
  )
}
