import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VideoMedia from './VideoMedia'
import type { VideoAccess } from '@/lib/consultation/video-validation'

const sdk = vi.hoisted(() => ({
  state: 'connected',
  remote: [] as unknown[],
  tracks: [] as unknown[],
  camera: false,
  microphone: false,
  setCamera: vi.fn(),
  setMicrophone: vi.fn(),
  create: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('@livekit/components-react', async () => {
  const { useEffect } = await import('react')
  return {
    LiveKitRoom: ({ children }: { children: ReactNode }) => {
      useEffect(() => () => sdk.disconnect(), [])
      return children
    },
    RoomAudioRenderer: () => null,
    VideoTrack: () => <span>video track</span>,
    useConnectionState: () => sdk.state,
    useLocalParticipant: () => ({
      localParticipant: {
        setCameraEnabled: sdk.setCamera,
        setMicrophoneEnabled: sdk.setMicrophone,
      },
      isCameraEnabled: sdk.camera,
      isMicrophoneEnabled: sdk.microphone,
    }),
    useRemoteParticipants: () => sdk.remote,
    useTracks: () => sdk.tracks,
    useStartAudio: () => ({ canPlayAudio: true, mergedProps: {} }),
  }
})
vi.mock('livekit-client', () => ({
  createLocalTracks: sdk.create,
  Track: { Source: { Camera: 'camera' }, Kind: { Video: 'video' } },
  setLogLevel: vi.fn(),
  LogLevel: { silent: 5 },
}))
const access: VideoAccess = {
  appointmentId: '10000000-0000-4000-8000-000000000001',
  provider: 'LIVEKIT',
  serverUrl: 'wss://test.livekit.cloud',
  participantToken: 'private.test.token',
  roomName: 'mb-10000000-0000-4000-8000-000000000001',
  expiresAt: '2026-10-13T01:02:00Z',
  endsAt: '2026-10-13T02:00:00Z',
}
describe('official Web SDK presentation boundary', () => {
  it('renders camera-off placeholders for muted publications, then restores both video tracks', () => {
    sdk.remote = [{ identity: 'opaque-fixture-remote', isCameraEnabled: false }]
    sdk.tracks = [
      {
        participant: { identity: 'local', isLocal: true },
        publication: { isMuted: true },
      },
      {
        participant: { identity: 'remote', isLocal: false },
        publication: { isMuted: true },
      },
    ]
    const props = {
      access,
      previewAllowed: true,
      onLeave: vi.fn(),
      onError: vi.fn(),
    }
    const view = render(<VideoMedia {...props} />)
    expect(screen.queryByText('video track')).not.toBeInTheDocument()
    expect(
      screen.getByText('Người còn lại đang tắt camera'),
    ).toBeInTheDocument()
    sdk.tracks = [
      {
        participant: { identity: 'local', isLocal: true },
        publication: { isMuted: false },
      },
      {
        participant: { identity: 'remote', isLocal: false },
        publication: { isMuted: false },
      },
    ]
    sdk.camera = true
    sdk.remote = [{ identity: 'opaque-fixture-remote', isCameraEnabled: true }]
    view.rerender(<VideoMedia {...props} />)
    expect(screen.getAllByText('video track')).toHaveLength(2)
    expect(
      screen.queryByText('Người còn lại đang tắt camera'),
    ).not.toBeInTheDocument()
  })
  it('keeps both participant surfaces visible when both cameras are off', () => {
    sdk.remote = [{ identity: 'opaque-fixture-remote' }]
    render(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    expect(screen.getByText('Người tham gia cùng bạn')).toBeInTheDocument()
    expect(screen.getByText('Bạn', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Camera đang tắt')).toBeInTheDocument()
    expect(
      screen.getByText('Người còn lại đang tắt camera'),
    ).toBeInTheDocument()
    expect(screen.getByText('Đã kết nối với người còn lại')).toBeInTheDocument()
    expect(sdk.create).not.toHaveBeenCalled()
    expect(document.body.innerHTML).not.toContain(access.participantToken)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    sdk.state = 'connected'
    sdk.remote = []
    sdk.tracks = []
    sdk.camera = false
    sdk.microphone = false
  })
  it('shows waiting, toggles actual SDK tracks, reconnects, and disconnects on unmount', async () => {
    const user = userEvent.setup()
    const leave = vi.fn()
    const view = render(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={leave}
        onError={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Đang chờ người còn lại tham gia'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Micro: Đang tắt' }))
    await user.click(screen.getByRole('button', { name: 'Camera: Đang tắt' }))
    expect(sdk.setMicrophone).toHaveBeenCalledWith(true)
    expect(sdk.setCamera).toHaveBeenCalledWith(true)
    sdk.state = 'reconnecting'
    view.rerender(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={leave}
        onError={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('đang kết nối lại')
    await user.click(screen.getByRole('button', { name: 'Rời cuộc gọi' }))
    expect(leave).toHaveBeenCalledOnce()
    view.unmount()
    expect(sdk.disconnect).toHaveBeenCalledOnce()
  })
  it('sanitizes device errors and preserves camera-off participation', async () => {
    sdk.setCamera.mockRejectedValueOnce(new Error('private.test.token'))
    render(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Camera: Đang tắt' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /kiểm tra quyền camera\/micro/i,
    )
    expect(document.body.innerHTML).not.toContain(access.participantToken)
    expect(
      screen.getByRole('button', { name: 'Micro: Đang tắt' }),
    ).toBeEnabled()
  })
  it('does not request devices until explicit preview and stops all tracks on join', async () => {
    const stop = vi.fn()
    sdk.create.mockResolvedValue([
      { kind: 'video', attach: vi.fn(), stop },
      { kind: 'audio', stop },
    ])
    const view = render(
      <VideoMedia
        access={null}
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    expect(sdk.create).not.toHaveBeenCalled()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Kiểm tra camera và micro' }))
    await screen.findByText(/Đã mở thiết bị trên máy/)
    view.rerender(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    expect(stop).toHaveBeenCalledTimes(2)
  })
  it('reports denied/missing preview devices without exposing raw errors', async () => {
    sdk.create.mockRejectedValue(
      new Error('NotAllowedError private.test.token'),
    )
    render(
      <VideoMedia
        access={null}
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Kiểm tra camera và micro' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Kiểm tra quyền'),
    )
    expect(document.body.innerHTML).not.toContain(access.participantToken)
  })
})
