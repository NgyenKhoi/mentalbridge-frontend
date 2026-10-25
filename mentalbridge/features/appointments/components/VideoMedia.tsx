'use client'

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useStartAudio,
  useConnectionQualityIndicator,
  useMediaDeviceSelect,
} from '@livekit/components-react'
import {
  createLocalTracks,
  Track,
  type LocalTrack,
  LogLevel,
  setLogLevel,
} from 'livekit-client'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowUpDown,
  CameraOff,
  Clock3,
  Grip,
  Maximize,
  Mic,
  MicOff,
  Phone,
  Settings,
  Signal,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { VideoAccess } from '@/lib/consultation/video-validation'
import { clampPip, pipCorner, type PipPoint } from './video-pip'
import styles from './VideoConsultation.module.css'

// Provider diagnostics can contain connection details. Never render/log raw errors.
setLogLevel(LogLevel.silent)
const roomOptions = { adaptiveStream: true, dynacast: true }
type Props = {
  access: VideoAccess | null
  previewAllowed: boolean
  onLeave: () => void
  onError: () => void
  participantName?: string
  hint?: string
  onJoin?: () => void
  joinDisabled?: boolean
  joining?: boolean
}
export default function VideoMedia({
  access,
  previewAllowed,
  onLeave,
  onError,
  participantName = 'Người tham gia cùng bạn',
  ...waiting
}: Props) {
  if (!access)
    return (
      <DevicePreview
        key={previewAllowed ? 'preview-allowed' : 'preview-unavailable'}
        allowed={previewAllowed}
        participantName={participantName}
        {...waiting}
      />
    )
  return (
    <ConnectedVideoMedia
      access={access}
      onLeave={onLeave}
      onError={onError}
      participantName={participantName}
    />
  )
}
function ConnectedVideoMedia({
  access,
  onLeave,
  onError,
  participantName,
}: Pick<Props, 'onLeave' | 'onError'> & {
  access: VideoAccess
  participantName: string
}) {
  // SignalConnected also runs after a full SDK reconnect. Replay only choices
  // successfully made in this room, not the initial camera/mic-off defaults.
  // Leaving unmounts this state, so a new Join never captures devices itself.
  const [media, setMedia] = useState({ camera: false, microphone: false })
  const mediaChanged = useCallback(
    (kind: 'camera' | 'microphone', enabled: boolean) =>
      setMedia((current) => ({ ...current, [kind]: enabled })),
    [],
  )
  return (
    <LiveKitRoom
      serverUrl={access.serverUrl}
      token={access.participantToken}
      connect
      audio={media.microphone}
      video={media.camera}
      options={roomOptions}
      onError={onError}
      onDisconnected={onLeave}
    >
      <CallControls
        onLeave={onLeave}
        participantName={participantName}
        onMediaChanged={mediaChanged}
      />
    </LiveKitRoom>
  )
}
function Waiting({
  participantName,
  title,
  hint,
  children,
}: {
  participantName: string
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className={styles.waiting}>
      <div className={styles.radar} aria-hidden="true">
        <span />
        <span />
        <span />
        <div>{participantName.trim().charAt(0).toLocaleUpperCase('vi')}</div>
      </div>
      <span className={styles.waitingChip}>Phòng chờ tư vấn</span>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  )
}
function DevicePreview({
  allowed,
  participantName,
  hint,
  onJoin,
  joinDisabled,
  joining,
}: { allowed: boolean; participantName: string } & Pick<
  Props,
  'hint' | 'onJoin' | 'joinDisabled' | 'joining'
>) {
  const video = useRef<HTMLVideoElement>(null)
  const tracks = useRef<LocalTrack[]>([])
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      tracks.current.forEach((track) => {
        track.detach()
        track.stop()
      })
      tracks.current = []
    }
  }, [])
  function stop() {
    tracks.current.forEach((track) => {
      track.detach()
      track.stop()
    })
    tracks.current = []
    setReady(false)
  }
  async function preview() {
    if (busy || !allowed) return
    setBusy(true)
    setError('')
    try {
      const local = await createLocalTracks({ audio: true, video: true })
      if (!active.current) {
        local.forEach((track) => track.stop())
        return
      }
      tracks.current = local
      const camera = local.find((track) => track.kind === Track.Kind.Video)
      if (camera && video.current) camera.attach(video.current)
      setReady(true)
    } catch {
      if (active.current)
        setError(
          'Chưa dùng được camera hoặc micro. Kiểm tra quyền trong trình duyệt và thiết bị; bạn vẫn có thể tham gia rồi chọn thiết bị riêng.',
        )
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <div className={styles.call}>
      <Waiting
        participantName={participantName}
        title={`Sẵn sàng gặp ${participantName}?`}
        hint={hint}
      >
        <div className={styles.waitingActions}>
          {onJoin && (
            <button
              data-appointment-ui
              type="button"
              className={styles.primary}
              disabled={joinDisabled}
              onClick={onJoin}
            >
              <Video size={18} aria-hidden="true" />
              {joining ? 'Đang xử lý…' : 'Tham gia phiên tư vấn'}
            </button>
          )}
          {allowed && (
            <button
              data-appointment-ui
              type="button"
              disabled={busy}
              onClick={() => (ready ? stop() : void preview())}
            >
              <Settings size={16} aria-hidden="true" />
              {busy
                ? 'Đang mở thiết bị…'
                : ready
                  ? 'Dừng kiểm tra thiết bị'
                  : 'Kiểm tra camera và micro'}
            </button>
          )}
        </div>
        {ready && (
          <p role="status">
            Đã mở thiết bị trên máy. Chưa kết nối với người còn lại.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </Waiting>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Hình ảnh kiểm tra camera của bạn"
        className={styles.localPreview}
        hidden={!ready}
      />
    </div>
  )
}
function DeviceSelect({
  kind,
  label,
  onError,
}: {
  kind: MediaDeviceKind
  label: string
  onError: () => void
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({ kind, requestPermissions: false, onError })
  return (
    <label className={styles.deviceSelect}>
      {label}
      <select
        data-appointment-ui
        value={activeDeviceId ?? ''}
        disabled={!devices.length}
        onChange={(event) => {
          void setActiveMediaDevice(event.target.value).catch(onError)
        }}
      >
        {!devices.length && <option value="">Không tìm thấy thiết bị</option>}
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}
function CallControls({
  onLeave,
  participantName,
  onMediaChanged,
}: {
  onLeave: () => void
  participantName: string
  onMediaChanged: (kind: 'camera' | 'microphone', enabled: boolean) => void
}) {
  const state = useConnectionState()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant()
  const { quality } = useConnectionQualityIndicator({
    participant: localParticipant,
  })
  const remote = useRemoteParticipants()
  const cameras = useTracks([Track.Source.Camera])
  const localCamera = cameras.find(
    (track) =>
      track.participant.isLocal && track.publication?.isMuted === false,
  )
  const remoteCamera = cameras.find(
    (track) =>
      !track.participant.isLocal && track.publication?.isMuted === false,
  )
  const { canPlayAudio, mergedProps } = useStartAudio({ props: {} })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const [settings, setSettings] = useState(false)
  const [deviceError, setDeviceError] = useState('')
  const deviceFailed = useCallback(
    () =>
      setDeviceError(
        'Chưa đổi được thiết bị. Kiểm tra quyền truy cập và thử lại.',
      ),
    [],
  )
  const speakerFailed = useCallback(
    () =>
      setDeviceError(
        'Trình duyệt chưa đổi được loa. Hãy chọn đầu ra âm thanh trong cài đặt hệ thống.',
      ),
    [],
  )
  const [leaving, setLeaving] = useState(false)
  const dialogId = useId()
  const stage = useRef<HTMLDivElement>(null)
  const pip = useRef<HTMLElement>(null)
  const corner = useRef(0)
  const [point, setPoint] = useState<PipPoint | null>(null)
  const drag = useRef<{
    pointer: number
    x: number
    y: number
    start: PipPoint
  } | null>(null)
  function bounds() {
    return {
      width: stage.current?.clientWidth ?? 0,
      height: stage.current?.clientHeight ?? 0,
      pipWidth: pip.current?.offsetWidth ?? 0,
      pipHeight: pip.current?.offsetHeight ?? 0,
    }
  }
  useEffect(() => {
    if (!stage.current || !pip.current || typeof ResizeObserver === 'undefined')
      return
    const observer = new ResizeObserver(() =>
      setPoint((current) => (current ? clampPip(current, bounds()) : null)),
    )
    observer.observe(stage.current)
    observer.observe(pip.current)
    return () => observer.disconnect()
  }, [])
  const reconnecting =
    state === 'reconnecting' || state === 'signalReconnecting'
  const connectedWithPeer = state === 'connected' && remote.length > 0
  const status = reconnecting
    ? 'Mất kết nối — đang kết nối lại…'
    : state !== 'connected'
      ? 'Đang kết nối cuộc gọi…'
      : remote.length
        ? 'Đã kết nối với người còn lại'
        : 'Đang chờ người còn lại tham gia'
  const started = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  useEffect(() => {
    if (connectedWithPeer && started.current === null)
      started.current = performance.now()
    const timer = setInterval(() => {
      if (started.current !== null)
        setElapsed(
          Math.max(0, Math.floor((performance.now() - started.current) / 1000)),
        )
    }, 1000)
    return () => clearInterval(timer)
  }, [connectedWithPeer])
  const duration =
    elapsed === null
      ? null
      : `${Math.floor(elapsed / 60)
          .toString()
          .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
  async function toggle(kind: 'camera' | 'microphone') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const enabled =
        kind === 'camera' ? !isCameraEnabled : !isMicrophoneEnabled
      if (kind === 'camera') await localParticipant.setCameraEnabled(enabled)
      else await localParticipant.setMicrophoneEnabled(enabled)
      onMediaChanged(kind, enabled)
    } catch {
      setError(
        'Chưa mở được thiết bị. Hãy kiểm tra quyền camera/micro, đóng ứng dụng đang dùng thiết bị rồi thử lại.',
      )
    } finally {
      setBusy(false)
    }
  }
  function surface(local: boolean) {
    const camera = local ? localCamera : remoteCamera
    return camera ? (
      <VideoTrack trackRef={camera} />
    ) : (
      <div className={styles.placeholder}>
        <CameraOff size={local ? 28 : 40} aria-hidden="true" />
        <p>
          {local
            ? isCameraEnabled
              ? 'Đang mở camera…'
              : 'Camera đang tắt'
            : remote.some((participant) => participant.isCameraEnabled)
              ? 'Đang tải hình ảnh người còn lại…'
              : remote.length
                ? 'Người còn lại đang tắt camera'
                : 'Chờ người còn lại'}
        </p>
      </div>
    )
  }
  const qualityLabel =
    {
      excellent: 'Tốt',
      good: 'Ổn định',
      poor: 'Yếu',
      lost: 'Mất kết nối',
      unknown: 'Đang kiểm tra',
    }[quality] ?? 'Đang kiểm tra'
  return (
    <>
      <div className={styles.call} ref={stage}>
        <figure
          className={styles.remoteVideo}
          data-local={swapped}
          aria-label={
            swapped ? 'Hình ảnh của bạn' : 'Hình ảnh người tham gia cùng bạn'
          }
        >
          {surface(swapped)}
          <figcaption>
            {swapped ? 'Bạn' : participantName}
            {!(swapped
              ? isMicrophoneEnabled
              : remote[0]?.isMicrophoneEnabled !== false) && (
              <span className={styles.mutedIndicator}>
                <MicOff size={14} aria-hidden="true" />
                Micro đang tắt
              </span>
            )}
          </figcaption>
        </figure>
        {!remote.length && (
          <Waiting
            participantName={participantName}
            title={
              reconnecting
                ? 'Đang khôi phục cuộc gọi'
                : 'Đang chờ người còn lại'
            }
            hint="Bạn đã vào phòng. Cuộc gọi sẽ hiển thị khi người còn lại tham gia."
          />
        )}
        <div className={styles.connectionInfo}>
          <p
            role="status"
            className={styles.connectionBadge}
            data-waiting={!connectedWithPeer}
          >
            <span aria-hidden="true" />
            {status}
          </p>
          <div className={styles.callMetrics}>
            {duration && (
              <time
                className={styles.duration}
                aria-label={`Thời gian cuộc gọi ${duration}`}
              >
                <Clock3 size={14} aria-hidden="true" />
                {duration}
              </time>
            )}
            <span
              className={styles.quality}
              data-quality={quality}
              aria-label={`Chất lượng kết nối: ${qualityLabel}`}
              title={`Chất lượng kết nối: ${qualityLabel}`}
            >
              <Signal size={20} aria-hidden="true" />
            </span>
          </div>
        </div>
        <figure
          ref={pip}
          className={styles.localVideo}
          data-local={!swapped}
          aria-label={
            swapped ? 'Hình ảnh người tham gia cùng bạn' : 'Hình ảnh của bạn'
          }
          style={
            point
              ? { left: point.x, top: point.y, right: 'auto', bottom: 'auto' }
              : undefined
          }
        >
          {surface(!swapped)}
          <div className={styles.pipHeader}>
            <button
              data-appointment-ui
              type="button"
              className={styles.dragHandle}
              aria-label="Di chuyển khung hình nhỏ"
              title="Kéo để di chuyển; dùng phím mũi tên khi chọn nút này"
              onKeyDown={(event) => {
                const delta = {
                  ArrowLeft: [-16, 0],
                  ArrowRight: [16, 0],
                  ArrowUp: [0, -16],
                  ArrowDown: [0, 16],
                }[event.key]
                if (!delta) return
                event.preventDefault()
                setPoint((current) => {
                  const start = current ?? pipCorner(corner.current, bounds())
                  return clampPip(
                    { x: start.x + delta[0], y: start.y + delta[1] },
                    bounds(),
                  )
                })
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.currentTarget.setPointerCapture(event.pointerId)
                drag.current = {
                  pointer: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  start: {
                    x: pip.current?.offsetLeft ?? 0,
                    y: pip.current?.offsetTop ?? 0,
                  },
                }
              }}
              onPointerMove={(event) => {
                const current = drag.current
                if (current?.pointer !== event.pointerId) return
                setPoint(
                  clampPip(
                    {
                      x: current.start.x + event.clientX - current.x,
                      y: current.start.y + event.clientY - current.y,
                    },
                    bounds(),
                  ),
                )
              }}
              onPointerUp={() => {
                drag.current = null
              }}
              onPointerCancel={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
            >
              <Grip size={14} aria-hidden="true" />
              <span>Kéo thả</span>
            </button>
            <button
              data-appointment-ui
              type="button"
              aria-label="Hoán đổi khung hình"
              title="Hoán đổi với khung to"
              onClick={() => setSwapped((current) => !current)}
            >
              <ArrowUpDown size={14} aria-hidden="true" />
            </button>
            <button
              data-appointment-ui
              type="button"
              aria-label="Chuyển góc khung hình nhỏ"
              title="Chuyển sang góc tiếp theo"
              onClick={() => {
                corner.current = (corner.current + 1) % 4
                setPoint(pipCorner(corner.current, bounds()))
              }}
            >
              <Maximize size={14} aria-hidden="true" />
            </button>
          </div>
          <figcaption>
            <span className={styles.onlineDot} />
            {swapped ? participantName : 'Bạn (Thu nhỏ)'}
            {!(swapped
              ? remote[0]?.isMicrophoneEnabled !== false
              : isMicrophoneEnabled) && (
              <MicOff
                size={15}
                aria-label={
                  swapped
                    ? 'Micro người còn lại đang tắt'
                    : 'Micro của bạn đang tắt'
                }
              />
            )}
          </figcaption>
        </figure>
        <RoomAudioRenderer />
        <div className={styles.callFeedback}>
          {!canPlayAudio && (
            <button data-appointment-ui {...mergedProps} type="button">
              Bật âm thanh cuộc gọi
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        <div className={styles.controlDock}>
          <div
            className={styles.callControls}
            role="group"
            aria-label="Điều khiển cuộc gọi"
          >
            <button
              data-appointment-ui
              type="button"
              className={styles.micButton}
              disabled={busy || state !== 'connected'}
              aria-pressed={isMicrophoneEnabled}
              aria-label={`Micro: ${isMicrophoneEnabled ? 'Đang bật' : 'Đang tắt'}`}
              title={isMicrophoneEnabled ? 'Tắt micro' : 'Bật micro'}
              onClick={() => void toggle('microphone')}
            >
              {isMicrophoneEnabled ? (
                <Mic size={20} aria-hidden="true" />
              ) : (
                <MicOff size={20} aria-hidden="true" />
              )}
            </button>
            <button
              data-appointment-ui
              type="button"
              className={styles.cameraButton}
              disabled={busy || state !== 'connected'}
              aria-pressed={isCameraEnabled}
              aria-label={`Camera: ${isCameraEnabled ? 'Đang bật' : 'Đang tắt'}`}
              title={isCameraEnabled ? 'Tắt camera' : 'Bật camera'}
              onClick={() => void toggle('camera')}
            >
              {isCameraEnabled ? (
                <Video size={20} aria-hidden="true" />
              ) : (
                <VideoOff size={20} aria-hidden="true" />
              )}
            </button>
            <button
              data-appointment-ui
              type="button"
              aria-label="Hoán đổi khung hình chính"
              title="Hoán đổi khung hình"
              onClick={() => setSwapped((current) => !current)}
            >
              <ArrowUpDown size={20} aria-hidden="true" />
            </button>
            <button
              data-appointment-ui
              type="button"
              aria-label="Cài đặt thiết bị"
              title="Cài đặt thiết bị"
              onClick={() => {
                setDeviceError('')
                setSettings(true)
              }}
            >
              <Settings size={20} aria-hidden="true" />
            </button>
            <button
              data-appointment-ui
              type="button"
              className={styles.leaveCall}
              aria-label="Rời cuộc gọi"
              title="Rời cuộc gọi"
              onClick={() => setLeaving(true)}
            >
              <Phone size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        labelledBy={`${dialogId}-leave`}
        className={styles.callDialog}
      >
        <div className={styles.dialogContent}>
          <span className={styles.leaveIcon}>
            <Phone size={26} aria-hidden="true" />
          </span>
          <h2 id={`${dialogId}-leave`}>Bạn muốn rời cuộc gọi tư vấn?</h2>
          <p>
            Camera và micro của bạn sẽ dừng. Bạn có thể tham gia lại nếu phiên
            còn mở. Rời cuộc gọi không xác nhận buổi tư vấn đã hoàn tất.
          </p>
          <div className={styles.dialogActions}>
            <button
              data-appointment-ui
              type="button"
              onClick={() => setLeaving(false)}
            >
              Tiếp tục cuộc gọi
            </button>
            <button
              data-appointment-ui
              type="button"
              className={styles.confirmLeave}
              onClick={onLeave}
            >
              Rời cuộc gọi
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={settings}
        onOpenChange={setSettings}
        labelledBy={`${dialogId}-settings`}
        className={styles.callDialog}
      >
        <div className={styles.dialogContent}>
          <div className={styles.dialogHeading}>
            <h2 id={`${dialogId}-settings`}>Cài đặt thiết bị</h2>
            <button
              data-appointment-ui
              type="button"
              aria-label="Đóng cài đặt"
              onClick={() => setSettings(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p>Chọn thiết bị trên máy của bạn. Thay đổi không rời cuộc gọi.</p>
          {deviceError && <p role="alert">{deviceError}</p>}
          {settings && (
            <>
              <DeviceSelect
                kind="audioinput"
                label="Microphone"
                onError={deviceFailed}
              />
              <DeviceSelect
                kind="videoinput"
                label="Camera"
                onError={deviceFailed}
              />
              <DeviceSelect
                kind="audiooutput"
                label="Loa"
                onError={speakerFailed}
              />
            </>
          )}
        </div>
      </Dialog>
    </>
  )
}
