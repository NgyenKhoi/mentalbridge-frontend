import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  select: vi.fn(),
}))
vi.mock('@livekit/components-react', async () => {
  const { useEffect } = await import('react')
  return {
    LiveKitRoom: ({ children }: { children: ReactNode }) => {
      useEffect(() => () => sdk.disconnect(), [])
      return children
    },
    RoomAudioRenderer: () => null,
    VideoTrack: ({
      trackRef,
    }: {
      trackRef: { participant: { isLocal: boolean } }
    }) => (
      <span data-testid={trackRef.participant.isLocal ? 'local' : 'remote'}>
        video track
      </span>
    ),
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
    useConnectionQualityIndicator: () => ({ quality: 'good' }),
    useMediaDeviceSelect: () => ({
      devices: [{ deviceId: 'default', label: 'Thiết bị mặc định' }],
      activeDeviceId: 'default',
      setActiveMediaDevice: sdk.select,
    }),
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
    expect(
      screen.getByText('Bạn (Thu nhỏ)', { exact: true }),
    ).toBeInTheDocument()
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
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  it('swaps surfaces and device selection without disconnecting or changing media preferences; leave is cancel-first', async () => {
    const user = userEvent.setup()
    sdk.select.mockResolvedValue(undefined)
    sdk.remote = [{ isMicrophoneEnabled: true }]
    sdk.tracks = [
      { participant: { isLocal: true }, publication: { isMuted: false } },
      { participant: { isLocal: false }, publication: { isMuted: false } },
    ]
    const leave = vi.fn()
    render(
      <VideoMedia
        access={access}
        previewAllowed
        onLeave={leave}
        onError={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Hoán đổi khung hình chính' }),
    )
    expect(
      screen.getByRole('figure', { name: 'Hình ảnh của bạn' }),
    ).toHaveAttribute('data-local', 'true')
    expect(
      within(
        screen.getByRole('figure', { name: 'Hình ảnh của bạn' }),
      ).getByTestId('local'),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Hoán đổi khung hình' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cài đặt thiết bị' }))
    const settings = screen.getByRole('dialog', { name: 'Cài đặt thiết bị' })
    expect(within(settings).getAllByRole('combobox')).toHaveLength(3)
    await user.selectOptions(
      within(settings).getByLabelText('Camera'),
      'default',
    )
    expect(sdk.select).toHaveBeenCalledWith('default')
    await user.click(
      within(settings).getByRole('button', { name: 'Đóng cài đặt' }),
    )
    await user.click(screen.getByRole('button', { name: 'Rời cuộc gọi' }))
    expect(leave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Tiếp tục cuộc gọi' }))
    expect(sdk.disconnect).not.toHaveBeenCalled()
    expect(sdk.setCamera).not.toHaveBeenCalled()
    expect(sdk.setMicrophone).not.toHaveBeenCalled()
  })
  it('keeps local and remote tracks on their own surfaces with accessible icon controls', () => {
    sdk.remote = [{ isMicrophoneEnabled: false }]
    sdk.tracks = [
      { participant: { isLocal: true }, publication: { isMuted: false } },
      { participant: { isLocal: false }, publication: { isMuted: false } },
    ]
    sdk.camera = true
    render(
      <VideoMedia
        access={access}
        participantName="Chuyên gia An"
        previewAllowed
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    )
    const local = screen.getByRole('figure', { name: 'Hình ảnh của bạn' })
    const remote = screen.getByRole('figure', {
      name: 'Hình ảnh người tham gia cùng bạn',
    })
    expect(within(local).getByTestId('local')).toBeInTheDocument()
    expect(within(local).queryByTestId('remote')).not.toBeInTheDocument()
    expect(within(remote).getByTestId('remote')).toBeInTheDocument()
    expect(within(remote).getByText('Chuyên gia An')).toBeInTheDocument()
    expect(within(remote).getByText('Micro đang tắt')).toBeInTheDocument()
    const controls = screen.getByRole('group', { name: 'Điều khiển cuộc gọi' })
    expect(within(controls).getAllByRole('button')).toHaveLength(5)
    expect(
      screen.getByRole('button', { name: 'Micro: Đang tắt' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: 'Camera: Đang bật' }),
    ).toHaveAttribute('title', 'Tắt camera')
  })
  it('starts elapsed time only with a connected peer and retains it through reconnect without remounting the room', () => {
    vi.useFakeTimers()
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const props = {
      access,
      previewAllowed: true,
      onLeave: vi.fn(),
      onError: vi.fn(),
    }
    const view = render(<VideoMedia {...props} />)
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.queryByLabelText(/Thời gian cuộc gọi/),
    ).not.toBeInTheDocument()
    sdk.remote = [{ isMicrophoneEnabled: true }]
    view.rerender(<VideoMedia {...props} />)
    now += 61000
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByLabelText('Thời gian cuộc gọi 01:01'),
    ).toBeInTheDocument()
    sdk.state = 'reconnecting'
    view.rerender(<VideoMedia {...props} />)
    now += 3000
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByLabelText('Thời gian cuộc gọi 01:04'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Camera: Đang tắt' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rời cuộc gọi' })).toBeEnabled()
    sdk.state = 'connected'
    view.rerender(<VideoMedia {...props} />)
    expect(sdk.disconnect).not.toHaveBeenCalled()
    expect(
      screen.getByLabelText('Thời gian cuộc gọi 01:04'),
    ).toBeInTheDocument()
    view.unmount()
    expect(sdk.disconnect).toHaveBeenCalledOnce()
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
    expect(leave).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', {
      name: 'Bạn muốn rời cuộc gọi tư vấn?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Rời cuộc gọi' }),
    )
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
      { kind: 'video', attach: vi.fn(), detach: vi.fn(), stop },
      { kind: 'audio', detach: vi.fn(), stop },
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
  it('stops the local preview immediately when current authority revokes preview eligibility', async () => {
    const stop = vi.fn()
    sdk.create.mockResolvedValue([
      { kind: 'video', attach: vi.fn(), detach: vi.fn(), stop },
    ])
    const props = { access: null, onLeave: vi.fn(), onError: vi.fn() }
    const view = render(<VideoMedia {...props} previewAllowed />)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Kiểm tra camera và micro' }))
    await screen.findByText(/Đã mở thiết bị trên máy/)
    view.rerender(<VideoMedia {...props} previewAllowed={false} />)
    expect(stop).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra camera và micro' }),
    ).not.toBeInTheDocument()
  })
  it('stops a late preview result after navigation without attaching or retaining tracks', async () => {
    const stop = vi.fn()
    const attach = vi.fn()
    let resolve!: (tracks: unknown[]) => void
    sdk.create.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const view = render(
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
    view.unmount()
    await act(async () =>
      resolve([
        { kind: 'video', attach, stop },
        { kind: 'audio', stop },
      ]),
    )
    expect(stop).toHaveBeenCalledTimes(2)
    expect(attach).not.toHaveBeenCalled()
    expect(sdk.disconnect).not.toHaveBeenCalled()
  })
})
