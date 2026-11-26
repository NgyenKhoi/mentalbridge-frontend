import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type * as ReactNamespace from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import { AudioSession } from '@livekit/react-native'
import { createLocalTracks } from 'livekit-client'
import VideoMedia from './VideoMedia.native'
import type { VideoAccess } from './video-contract'

let mockConnection = 'connected'
const mockCamera = jest.fn()
const mockMicrophone = jest.fn()
const mockDisconnect = jest.fn()
const mockRoomProps = jest.fn()
const mockRestart = jest.fn()
const mockVideoTrack = jest.fn((_props: unknown) => null)
let mockCameraEnabled = false
let mockTracks: {
  participant: { identity: string; isLocal: boolean }
  publication: { isMuted: boolean }
}[] = []
jest.mock('@livekit/react-native', () => {
  const React: typeof ReactNamespace = jest.requireActual('react')
  return {
    AudioSession: {
      startAudioSession: jest.fn(async () => {}),
      stopAudioSession: jest.fn(async () => {}),
      getAudioOutputs: jest.fn(async () => ['speaker', 'earpiece']),
      selectAudioOutput: jest.fn(async () => {}),
    },
    LiveKitRoom: (props: { children: ReactNamespace.ReactNode }) => {
      mockRoomProps(props)
      React.useEffect(() => () => mockDisconnect(), [])
      return props.children
    },
    VideoTrack: (props: unknown) => mockVideoTrack(props),
    useConnectionState: () => mockConnection,
    useRemoteParticipants: () => [],
    useTracks: () => mockTracks,
    useLocalParticipant: () => ({
      localParticipant: {
        setCameraEnabled: mockCamera,
        setMicrophoneEnabled: mockMicrophone,
        getTrackPublication: () => ({
          videoTrack: { restartTrack: mockRestart },
        }),
      },
      isCameraEnabled: mockCameraEnabled,
      isMicrophoneEnabled: false,
    }),
  }
})
jest.mock('@livekit/react-native-webrtc', () => ({ RTCView: () => null }))
jest.mock('livekit-client', () => ({
  createLocalTracks: jest.fn(),
  Track: {
    Source: { Camera: 'camera' },
    Kind: { Video: 'video', Audio: 'audio' },
  },
}))
const access: VideoAccess = {
  appointmentId: '10000000-0000-4000-8000-000000000001',
  provider: 'LIVEKIT',
  roomName: 'mb-10000000-0000-4000-8000-000000000001',
  serverUrl: 'wss://test.livekit.cloud',
  participantToken: 'private.test.token',
  expiresAt: '2026-10-13T01:02:00Z',
  endsAt: '2026-10-13T02:00:00Z',
}
const props = {
  access,
  previewAllowed: true,
  onLeave: jest.fn(),
  onError: jest.fn(),
}
beforeEach(() => {
  jest.clearAllMocks()
  mockConnection = 'connected'
  mockCameraEnabled = false
  mockTracks = []
  mockRestart.mockResolvedValue(undefined)
  mockCamera.mockResolvedValue(undefined)
  mockMicrophone.mockResolvedValue(undefined)
})
afterEach(() => jest.restoreAllMocks())
// The first native Modal render initializes RN's test fixtures before interactions.
it('starts/stops audio, toggles SDK media, selects output and cleans up on unmount', async () => {
  const view = await render(<VideoMedia {...props} />)
  await screen.findByText('Đang chờ người còn lại tham gia')

  expect(mockRoomProps).toHaveBeenCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({ singlePeerConnection: false }),
      connectOptions: { autoSubscribe: true },
      audio: false,
      video: false,
    }),
  )
  await fireEvent.press(screen.getByLabelText('Camera: Đang tắt'))
  await fireEvent.press(screen.getByLabelText('Micro: Đang tắt'))

  expect(mockCamera).toHaveBeenCalledWith(true)
  expect(mockMicrophone).toHaveBeenCalledWith(true)
  await fireEvent.press(screen.getByLabelText('Chọn thiết bị âm thanh'))
  await fireEvent.press(await screen.findByText('Loa ngoài'))

  expect(AudioSession.selectAudioOutput).toHaveBeenCalledWith('speaker')
  await fireEvent.press(screen.getByLabelText('Rời cuộc gọi'))
  expect(props.onLeave).toHaveBeenCalled()

  await view.unmount()

  await waitFor(() => expect(AudioSession.stopAudioSession).toHaveBeenCalled())
  expect(mockDisconnect).toHaveBeenCalled()
}, 30000)
it('renders reconnect state with a safe leave action and no token text', async () => {
  mockConnection = 'reconnecting'
  await render(<VideoMedia {...props} />)
  await screen.findByText('Mất kết nối — đang kết nối lại…')
  expect(
    screen.getByRole('button', { name: 'Camera: Đang tắt' }),
  ).toBeDisabled()
  expect(screen.queryByText(access.participantToken)).toBeNull()
  expect(screen.getByRole('button', { name: 'Rời cuộc gọi' })).toBeEnabled()
})
it('handles denied Android runtime permission without enabling a track', async () => {
  const original = Platform.OS
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  })
  try {
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED)
    await render(<VideoMedia {...props} />)
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Camera: Đang tắt' }),
    )
    expect(await screen.findByText(/Chưa được cấp quyền thiết bị/)).toBeTruthy()
    expect(mockCamera).not.toHaveBeenCalled()
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: original,
    })
  }
})
it('starts local preview only on request and stops audio/video tracks before joining', async () => {
  const stop = jest.fn()
  jest.mocked(createLocalTracks).mockImplementation(
    async (options) =>
      (options?.video
        ? [
            {
              kind: 'video',
              mediaStream: { toURL: () => 'local-preview' },
              stop,
            },
          ]
        : [{ kind: 'audio', stop }]) as unknown as Awaited<
        ReturnType<typeof createLocalTracks>
      >,
  )
  const view = await render(<VideoMedia {...props} access={null} />)
  await screen.findByText('Kiểm tra camera và micro trước khi tham gia')
  expect(createLocalTracks).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByLabelText('Bật camera'))
  await screen.findByText(
    'Thiết bị đã mở trên máy, chưa kết nối với người còn lại.',
  )
  expect(createLocalTracks).toHaveBeenCalledWith({ audio: false, video: true })
  await fireEvent.press(screen.getByLabelText('Bật micro'))
  expect(createLocalTracks).toHaveBeenLastCalledWith({
    audio: true,
    video: false,
  })
  await fireEvent.press(screen.getByLabelText('Tắt camera'))
  expect(stop).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Tắt micro')).toBeEnabled()
  await view.rerender(<VideoMedia {...props} />)
  expect(stop).toHaveBeenCalledTimes(2)
})
it('sanitizes device failures and still allows camera-off calling', async () => {
  mockCamera.mockRejectedValue(new Error('private.test.token'))
  await render(<VideoMedia {...props} />)
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Camera: Đang tắt' }),
  )
  await screen.findByText(
    'Chưa bật được thiết bị. Kiểm tra quyền và thiết bị rồi thử lại.',
  )
  expect(screen.queryByText(access.participantToken)).toBeNull()
  expect(screen.getByRole('button', { name: 'Micro: Đang tắt' })).toBeEnabled()
})

it('minimizes and restores the call without disconnecting the room', async () => {
  await render(<VideoMedia {...props} />)
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Thu gọn cuộc gọi' }),
  )
  expect(mockDisconnect).not.toHaveBeenCalled()
  expect(AudioSession.stopAudioSession).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Trở lại cuộc gọi' }),
  )
  expect(screen.getByRole('button', { name: 'Rời cuộc gọi' })).toBeEnabled()
  expect(mockDisconnect).not.toHaveBeenCalled()
})

it('preserves the full remote frame, mirrors self video, and switches the live camera', async () => {
  mockCameraEnabled = true
  mockTracks = [
    {
      participant: { identity: 'self', isLocal: true },
      publication: { isMuted: false },
    },
    {
      participant: { identity: 'other', isLocal: false },
      publication: { isMuted: false },
    },
  ]
  await render(<VideoMedia {...props} />)
  await screen.findByRole('button', { name: 'Đổi camera' })
  expect(mockVideoTrack).toHaveBeenCalledWith(
    expect.objectContaining({
      trackRef: mockTracks[1],
      zOrder: 0,
      objectFit: 'contain',
    }),
  )
  expect(mockVideoTrack).toHaveBeenCalledWith(
    expect.objectContaining({
      trackRef: mockTracks[0],
      zOrder: 1,
      mirror: true,
    }),
  )
  await fireEvent.press(screen.getByRole('button', { name: 'Đổi camera' }))
  expect(mockRestart).toHaveBeenCalledWith({ facingMode: 'environment' })
  expect(mockVideoTrack).toHaveBeenLastCalledWith(
    expect.objectContaining({ mirror: false }),
  )
  await fireEvent.press(screen.getByRole('button', { name: 'Đổi camera' }))
  expect(mockRestart).toHaveBeenLastCalledWith({ facingMode: 'user' })
})
