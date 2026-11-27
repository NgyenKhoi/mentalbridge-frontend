import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import type * as ReactNamespace from 'react'
import { ApiError } from '@/api/api-error'
import type { VideoApi } from './video-api'
import type {
  VideoSession,
  VideoAccess,
  VideoCompletion,
} from './video-contract'
import { VideoSessionPanel } from './VideoConsultationPanel'

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React: typeof ReactNamespace = jest.requireActual('react')
    React.useEffect(callback, [callback])
  },
}))
jest.mock('./VideoMedia', () => {
  const React: typeof ReactNamespace = jest.requireActual('react')
  const { Text, Pressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ access, onLeave }: { access: unknown; onLeave: () => void }) =>
      access
        ? React.createElement(
            Pressable,
            { accessibilityRole: 'button', onPress: onLeave },
            React.createElement(Text, null, 'SDK leave'),
          )
        : React.createElement(Text, null, 'Local preview'),
  }
})
const id = '10000000-0000-4000-8000-000000000001'
const active: VideoSession = {
  appointmentId: id,
  phase: 'ACTIVE',
  previewAllowed: true,
  joinAllowed: true,
  startsAt: '2026-10-13T01:00:00Z',
  endsAt: '2026-10-13T02:00:00Z',
  serverTime: '2026-10-13T01:01:00Z',
  version: 3,
  completion: null,
}
const access: VideoAccess = {
  appointmentId: id,
  provider: 'LIVEKIT',
  serverUrl: 'wss://test.livekit.cloud',
  roomName: `mb-${id}`,
  participantToken: 'private.test.token',
  expiresAt: '2026-10-13T01:03:00Z',
  endsAt: active.endsAt,
}
const pending: VideoCompletion = {
  appointmentId: id,
  confirmationId: id,
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: active.serverTime,
  manualReviewAt: '2026-10-14T01:01:00Z',
  version: 4,
}
let stateChange: (state: AppStateStatus) => void
function api(): VideoApi {
  return {
    session: jest.fn().mockResolvedValue(active),
    access: jest.fn().mockResolvedValue(access),
    complete: jest.fn(),
  }
}
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, callback) => {
      stateChange = callback
      return { remove: jest.fn() }
    })
})
afterEach(() => jest.restoreAllMocks())
it('uses fresh authority, leaves safely and never renders the token', async () => {
  const service = api()
  await render(
    <VideoSessionPanel api={service} appointmentId={id} role="USER" />,
  )
  await screen.findByText('Local preview')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  )
  expect(service.session).toHaveBeenCalledTimes(2)
  const leave = await screen.findByText('SDK leave')
  expect(screen.queryByText(access.participantToken)).toBeNull()
  await fireEvent.press(leave)
  expect(screen.queryByText('SDK leave')).toBeNull()
  expect(service.complete).not.toHaveBeenCalled()
})
it('blocks waiting, unauthorized and cancelled access', async () => {
  const service = api()
  jest
    .mocked(service.session)
    .mockResolvedValue({ ...active, phase: 'WAITING', joinAllowed: false })
  await render(
    <VideoSessionPanel api={service} appointmentId={id} role="USER" />,
  )
  await screen.findByText('Local preview')
  expect(
    screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  ).toBeDisabled()
  jest
    .mocked(service.session)
    .mockRejectedValue(
      new ApiError({ code: 'FORBIDDEN', status: 403, message: 'private' }),
    )
  await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên' }))
  await screen.findByText('Chưa thể tải lại. Vui lòng thử lại.')
  expect(service.access).not.toHaveBeenCalled()
})
it('stops the call on background without completing or auto-rejoining', async () => {
  const service = api()
  await render(
    <VideoSessionPanel api={service} appointmentId={id} role="USER" />,
  )
  await screen.findByText('Local preview')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  )
  await screen.findByText('SDK leave')
  await act(() => stateChange('background'))
  expect(screen.queryByText('SDK leave')).toBeNull()
  await act(() => stateChange('active'))
  expect(service.access).toHaveBeenCalledTimes(1)
  expect(service.complete).not.toHaveBeenCalled()
})
it('requires explicit Specialist review and replays the same ambiguous intent/version', async () => {
  const service = api()
  jest
    .mocked(service.complete)
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(pending)
  await render(
    <VideoSessionPanel api={service} appointmentId={id} role="SPECIALIST" />,
  )
  await fireEvent.press(
    await screen.findByRole('button', {
      name: 'Xác nhận kết thúc buổi tư vấn',
    }),
  )
  expect(service.complete).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Kết thúc và gửi xác nhận' }),
  )
  await screen.findByText('Kiểm tra lại xác nhận')
  const original = jest.mocked(service.complete).mock.calls[0]
  jest.mocked(service.session).mockResolvedValue({
    ...active,
    phase: 'ENDED',
    previewAllowed: false,
    joinAllowed: false,
    completion: pending,
    version: 4,
  })
  await fireEvent.press(
    screen.getByRole('button', { name: 'Kiểm tra lại xác nhận' }),
  )
  await waitFor(() =>
    expect(jest.mocked(service.complete).mock.calls[1]).toEqual(original),
  )
  expect(
    await screen.findByText(
      /Lượt tư vấn vẫn được giữ; chưa có kết luận hoàn tất/,
    ),
  ).toBeTruthy()
  expect(
    screen.queryByText('Buổi tư vấn đã được xác nhận hoàn tất.'),
  ).toBeNull()
})
