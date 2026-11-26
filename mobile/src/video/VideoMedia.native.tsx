import {
  AudioSession,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/react-native'
import { RTCView } from '@livekit/react-native-webrtc'
import {
  createLocalTracks,
  Track,
  type LocalTrack,
  type RoomOptions,
} from 'livekit-client'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { CallStage, CallIcon } from './CallStage'
import type { VideoMediaProps } from './video-media-props'
import { videoStyles as styles } from './video-styles'
import { lobbyStyles as lobby } from './video-lobby-styles'

// Keep native publishing/subscribing on separate peer connections. The unified
// path can negotiate successfully for publishing while remote video stays black
// on React Native (livekit/client-sdk-js#1977).
const nativeRoomOptions: RoomOptions = {
  singlePeerConnection: false,
  adaptiveStream: { pixelDensity: 'screen' },
  dynacast: true,
}
const nativeConnectOptions = { autoSubscribe: true }

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
  role,
  startsAt,
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
      options={nativeRoomOptions}
      connectOptions={nativeConnectOptions}
      onDisconnected={onLeave}
      onError={onError}
    >
      <CallControls
        onLeave={onLeave}
        role={role}
        startsAt={startsAt}
        endsAt={access.endsAt}
      />
    </LiveKitRoom>
  )
}

function DevicePreview() {
  const active = useRef(false)
  const tracks = useRef<LocalTrack[]>([])
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const [microphone, setMicrophone] = useState(false)
  const [busy, setBusy] = useState<'camera' | 'microphone' | null>(null)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      tracks.current.forEach((track) => track.stop())
      tracks.current = []
    }
  }, [])
  async function toggle(kind: 'camera' | 'microphone') {
    if (inFlight.current) return
    const trackKind = kind === 'camera' ? Track.Kind.Video : Track.Kind.Audio
    const existing = tracks.current.filter((track) => track.kind === trackKind)
    if (existing.length) {
      existing.forEach((track) => track.stop())
      tracks.current = tracks.current.filter(
        (track) => track.kind !== trackKind,
      )
      if (kind === 'camera') {
        setStreamUrl(null)
        setCamera(false)
      } else setMicrophone(false)
      return
    }
    inFlight.current = true
    setBusy(kind)
    setError('')
    try {
      if (!(await requestMediaPermission(kind))) {
        if (active.current)
          setError(
            kind === 'camera'
              ? 'Cần quyền camera để xem trước. Bạn có thể bật quyền trong Cài đặt.'
              : 'Cần quyền micro để kiểm tra. Bạn có thể bật quyền trong Cài đặt.',
          )
        return
      }
      if (!active.current) return
      const local = await createLocalTracks({
        audio: kind === 'microphone',
        video: kind === 'camera',
      })
      if (!active.current) {
        local.forEach((track) => track.stop())
        return
      }
      tracks.current = [...tracks.current, ...local]
      if (kind === 'camera') {
        setCamera(true)
        const stream = local.find(
          (track) => track.kind === Track.Kind.Video,
        )?.mediaStream
        if (stream && 'toURL' in stream && typeof stream.toURL === 'function') {
          const url: unknown = stream.toURL()
          if (typeof url === 'string') setStreamUrl(url)
        }
      } else setMicrophone(true)
    } catch {
      if (active.current)
        setError(
          'Chưa mở được thiết bị. Kiểm tra quyền camera/micro hoặc đóng ứng dụng khác đang dùng thiết bị rồi thử lại.',
        )
    } finally {
      inFlight.current = false
      if (active.current) setBusy(null)
    }
  }
  return (
    <View style={lobby.preview}>
      <View style={lobby.previewFrame}>
        {streamUrl && (
          <RTCView
            streamURL={streamUrl}
            objectFit="cover"
            mirror
            style={lobby.previewVideo}
          />
        )}
        {!streamUrl && (
          <View style={lobby.previewHintArea}>
            <View style={lobby.previewHalo}>
              <View style={lobby.previewCamera}>
                <View style={lobby.previewLens} />
              </View>
            </View>
            <Text style={lobby.previewTitle}>Không gian của bạn</Text>
          </View>
        )}
        <View style={lobby.previewTag}>
          <Text style={lobby.previewTagText}>
            {camera ? 'XEM TRƯỚC · CHỈ TRÊN MÁY' : 'CAMERA CHƯA BẬT'}
          </Text>
        </View>
        <View style={lobby.previewControls}>
          {(['microphone', 'camera'] as const).map((kind) => {
            const enabled = kind === 'camera' ? camera : microphone
            const name = kind === 'camera' ? 'camera' : 'micro'
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={(enabled ? 'Tắt ' : 'Bật ') + name}
                accessibilityState={{
                  selected: enabled,
                  disabled: busy !== null,
                }}
                disabled={busy !== null}
                onPress={() => void toggle(kind)}
                style={({ pressed }) => [
                  lobby.deviceToggle,
                  !enabled && lobby.deviceOff,
                  busy !== null && lobby.disabled,
                  pressed && lobby.pressed,
                ]}
              >
                {busy === kind ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <CallIcon kind={kind} off={!enabled} />
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={lobby.previewBottom}>
        <Text style={lobby.caption}>
          {camera || microphone
            ? 'Thiết bị đã mở trên máy, chưa kết nối với người còn lại.'
            : 'Kiểm tra camera và micro trước khi tham gia'}
        </Text>
        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </View>
  )
}

function CallControls({
  onLeave,
  role,
  startsAt,
  endsAt,
}: Pick<VideoMediaProps, 'onLeave' | 'role' | 'startsAt'> & {
  endsAt: string
}) {
  const connection = useConnectionState()
  const remote = useRemoteParticipants()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant()
  const cameras = useTracks([Track.Source.Camera])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [outputs, setOutputs] = useState<string[]>([])
  const [output, setOutput] = useState('')
  const [facingFront, setFacingFront] = useState(true)
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
  async function flipCamera() {
    if (busy || !isCameraEnabled || connection !== 'connected') return
    setBusy(true)
    setError('')
    try {
      const track = localParticipant.getTrackPublication(
        Track.Source.Camera,
      )?.videoTrack
      if (!track) return
      await track.restartTrack({
        facingMode: facingFront ? 'environment' : 'user',
      })
      if (alive.current) setFacingFront((value) => !value)
    } catch {
      if (alive.current) setError('Chưa đổi được camera. Vui lòng thử lại.')
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  const status = reconnecting
    ? 'Mất kết nối — đang kết nối lại…'
    : connection !== 'connected'
      ? 'Đang kết nối cuộc gọi…'
      : remote.length
        ? 'Đã kết nối với người còn lại'
        : 'Đang chờ người còn lại tham gia'
  const time = (value: string) =>
    new Date(value).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    })
  const schedule =
    startsAt &&
    Number.isFinite(Date.parse(startsAt)) &&
    Number.isFinite(Date.parse(endsAt))
      ? time(startsAt) +
        ' – ' +
        time(endsAt) +
        ' · ' +
        new Date(startsAt).toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        })
      : ''
  return (
    <CallStage
      status={status}
      connected={connection === 'connected'}
      reconnecting={reconnecting}
      remoteCamera={cameras.find(
        (track) => !track.participant.isLocal && !track.publication.isMuted,
      )}
      localCamera={cameras.find((track) => track.participant.isLocal)}
      participantName={
        remote[0]?.name ||
        (role === 'SPECIALIST' ? 'Thân chủ' : 'Chuyên gia tư vấn')
      }
      participantPresent={remote.length > 0}
      microphone={isMicrophoneEnabled}
      camera={isCameraEnabled}
      facingFront={facingFront}
      busy={busy}
      error={error}
      schedule={schedule}
      outputs={[...new Set(outputs)]
        .filter((value) => value in outputLabels)
        .map((value) => ({ value, label: outputLabels[value] ?? value }))}
      output={output}
      onOutput={(value) => void selectOutput(value)}
      onMicrophone={() => void toggle('microphone')}
      onCamera={() => void toggle('camera')}
      onFlip={() => void flipCamera()}
      onLeave={onLeave}
    />
  )
}
