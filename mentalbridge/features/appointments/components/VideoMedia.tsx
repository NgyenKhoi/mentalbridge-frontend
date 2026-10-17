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
} from '@livekit/components-react'
import {
  createLocalTracks,
  Track,
  type LocalTrack,
  LogLevel,
  setLogLevel,
} from 'livekit-client'
import { useEffect, useRef, useState } from 'react'

import type { VideoAccess } from '@/lib/consultation/video-validation'
import styles from './VideoConsultation.module.css'

// SDK diagnostics may contain connection details. Product errors are deliberately sanitized.
setLogLevel(LogLevel.silent)

export default function VideoMedia({
  access,
  previewAllowed,
  onLeave,
  onError,
}: {
  access: VideoAccess | null
  previewAllowed: boolean
  onLeave: () => void
  onError: () => void
}) {
  if (!access) return previewAllowed ? <DevicePreview /> : null
  return (
    <LiveKitRoom
      serverUrl={access.serverUrl}
      token={access.participantToken}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
      onError={onError}
      onDisconnected={onLeave}
    >
      <CallControls onLeave={onLeave} />
    </LiveKitRoom>
  )
}

function DevicePreview() {
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
      tracks.current.forEach((track) => track.stop())
      tracks.current = []
    }
  }, [])
  function stop() {
    tracks.current.forEach((track) => track.stop())
    tracks.current = []
    setReady(false)
  }
  async function preview() {
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
    <div className={styles.preview}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Hình ảnh kiểm tra camera của bạn"
        className={styles.localPreview}
        hidden={!ready}
      />
      {!ready && <p>Kiểm tra camera và micro trước khi tham gia</p>}
      {ready && (
        <p role="status">
          Đã mở thiết bị trên máy. Chưa kết nối với người còn lại.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => (ready ? stop() : void preview())}
      >
        {busy
          ? 'Đang mở thiết bị…'
          : ready
            ? 'Dừng kiểm tra thiết bị'
            : 'Kiểm tra camera và micro'}
      </button>
    </div>
  )
}

function CallControls({ onLeave }: { onLeave: () => void }) {
  const state = useConnectionState()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant()
  const remote = useRemoteParticipants()
  const cameras = useTracks([Track.Source.Camera])
  const { canPlayAudio, mergedProps } = useStartAudio({ props: {} })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reconnecting =
    state === 'reconnecting' || state === 'signalReconnecting'
  async function toggle(kind: 'camera' | 'microphone') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (kind === 'camera')
        await localParticipant.setCameraEnabled(!isCameraEnabled)
      else await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      setError(
        'Chưa mở được thiết bị. Hãy kiểm tra quyền camera/micro, đóng ứng dụng đang dùng thiết bị rồi thử lại.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.call}>
      <p role="status">
        {reconnecting
          ? 'Mất kết nối — đang kết nối lại…'
          : state !== 'connected'
            ? 'Đang kết nối cuộc gọi…'
            : remote.length
              ? 'Đã kết nối với người còn lại'
              : 'Đang chờ người còn lại tham gia'}
      </p>
      <div className={styles.videos}>
        {cameras.map((track) => (
          <figure key={track.participant.identity}>
            <VideoTrack trackRef={track} />
            <figcaption>
              {track.participant.isLocal ? 'Bạn' : 'Người tham gia cùng bạn'}
            </figcaption>
          </figure>
        ))}
        {!cameras.some((track) => !track.participant.isLocal) && (
          <div className={styles.placeholder}>
            {remote.length
              ? 'Người còn lại đang tắt camera'
              : 'Chờ người còn lại'}
          </div>
        )}
      </div>
      <RoomAudioRenderer />
      {!canPlayAudio && (
        <button {...mergedProps} type="button">
          Bật âm thanh cuộc gọi
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button
          type="button"
          disabled={busy || state !== 'connected'}
          aria-pressed={isMicrophoneEnabled}
          onClick={() => void toggle('microphone')}
        >
          Micro: {isMicrophoneEnabled ? 'Đang bật' : 'Đang tắt'}
        </button>
        <button
          type="button"
          disabled={busy || state !== 'connected'}
          aria-pressed={isCameraEnabled}
          onClick={() => void toggle('camera')}
        >
          Camera: {isCameraEnabled ? 'Đang bật' : 'Đang tắt'}
        </button>
        <button type="button" className={styles.danger} onClick={onLeave}>
          Rời cuộc gọi
        </button>
      </div>
    </div>
  )
}
