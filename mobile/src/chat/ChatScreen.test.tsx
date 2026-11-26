import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import type { DependencyList, EffectCallback } from 'react'
import { appointment } from '@/appointments/appointment-fixtures'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import { ChatScreen, phaseCopy } from './ChatScreen'
import { ChatSession } from './chat-session'
import {
  appointmentId,
  eligibility,
  fixtureApi,
  message,
  TestSocket,
  user,
  uuid,
} from './chat-fixtures'

jest.mock('@/resources/useResourceFonts', () => ({
  useResourceFonts: () => false,
}))
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: EffectCallback) => {
    const React = jest.requireActual<{
      useEffect: (effect: EffectCallback, dependencies: DependencyList) => void
    }>('react')
    React.useEffect(effect, [effect])
  },
}))

async function mounted() {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  const api = fixtureApi()
  const sockets: TestSocket[] = []
  const session = new ChatSession({
    api,
    factory: () => {
      const socket = new TestSocket()
      sockets.push(socket)
      return socket
    },
    subject: user,
    role: 'USER',
    appointmentId,
    uuid,
  })
  let lifecycle: ((state: AppStateStatus) => void) | undefined
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      lifecycle = listener
      return { remove: jest.fn() }
    })
  const view = await render(
    <ChatScreen session={session} subject={user} onBack={jest.fn()} />,
  )
  await waitFor(() => expect(sockets).toHaveLength(1))
  await act(async () => {
    sockets[0]!.ready()
  })
  await screen.findByLabelText('Tin nhắn tư vấn')
  return { api, sockets, session, view, lifecycle: () => lifecycle }
}
afterEach(() => jest.restoreAllMocks())
it('shows pending/accepted as persistence only and closes composer from fresh authority', async () => {
  const value = await mounted()
  await fireEvent.changeText(
    screen.getByLabelText('Tin nhắn tư vấn'),
    'synthetic user edit',
  )
  await fireEvent.press(screen.getByTestId('chat-send'))
  expect(
    await screen.findByText('Đã được hệ thống chấp nhận. Đang tải bản lưu.'),
  ).toBeTruthy()
  expect(screen.queryByText('Đã đọc')).toBeNull()
  jest.mocked(value.api.eligibility).mockResolvedValue({
    ...eligibility,
    phase: 'ENDED_PROCESSING',
    subscribeAllowed: false,
    sendAllowed: false,
    checkInAllowed: false,
  })
  await act(async () => {
    await value.session.refresh()
  })
  expect(screen.queryByLabelText('Tin nhắn tư vấn')).toBeNull()
  expect(screen.getByTestId('chat-status')).toHaveTextContent(
    'Phiên đã kết thúc. Cuộc trò chuyện chỉ để xem.',
  )
  await value.view.unmount()
})
it('preserves unsent draft across background, recovers accepted history without duplicating it', async () => {
  const value = await mounted()
  const item = message()
  await fireEvent.changeText(
    screen.getByLabelText('Tin nhắn tư vấn'),
    'volatile draft',
  )
  await act(async () => {
    value.lifecycle()?.('background')
  })
  expect(value.sockets[0]!.disconnect).toHaveBeenCalled()
  jest
    .mocked(value.api.history)
    .mockResolvedValue({ items: [item], nextCursor: null, hasMore: false })
  await act(async () => {
    value.lifecycle()?.('active')
  })
  await waitFor(() => expect(value.sockets).toHaveLength(2))
  await act(async () => {
    value.sockets[1]!.ready()
  })
  expect(await screen.findByLabelText('Tin nhắn tư vấn')).toHaveDisplayValue(
    'volatile draft',
  )
  expect(screen.getAllByText(item.content)).toHaveLength(1)
  await value.view.unmount()
})
it.each([
  'TOO_EARLY',
  'WAITING',
  'CANCELLED',
  'RESCHEDULED',
  'ENDED_PROCESSING',
] as const)('has distinct safe %s copy', (phase) => {
  expect(phaseCopy(phase)).not.toBe(phaseCopy('ACTIVE'))
})

it('shows actual closed-session history and metadata while keeping send disabled', async () => {
  const api = fixtureApi()
  const received = message()
  const sent = message({
    senderId: user,
    content: 'Nội dung đã lưu của người dùng',
    sentAt: '2026-10-11T10:03:00Z',
  })
  jest.mocked(api.eligibility).mockResolvedValue({
    ...eligibility,
    phase: 'COMPLETED',
    sessionOutcome: 'COMPLETED',
    subscribeAllowed: false,
    sendAllowed: false,
    checkInAllowed: false,
    creditState: 'CONSUMED',
  })
  jest.mocked(api.history).mockResolvedValue({
    items: [received, sent],
    nextCursor: null,
    hasMore: false,
  })
  const summary = jest.fn(),
    book = jest.fn()
  const offset = jest.fn()
  const session = new ChatSession({
    api,
    subject: user,
    role: 'USER',
    appointmentId,
    uuid,
    factory: () => new TestSocket(),
  })
  const view = await render(
    <CrisisSupportOffsetContext.Provider value={offset}>
      <ChatScreen
        session={session}
        subject={user}
        onBack={jest.fn()}
        appointment={{
          ...appointment,
          id: appointmentId,
          timezone: 'Asia/Ho_Chi_Minh',
          specialistDisplayName: 'ThS. Chuyên gia từ API',
        }}
        specialty="Lo âu"
        onViewSummary={summary}
        onBook={book}
      />
    </CrisisSupportOffsetContext.Provider>,
  )
  expect(await screen.findByText(received.content)).toBeOnTheScreen()
  expect(screen.getByText(sent.content)).toBeOnTheScreen()
  expect(screen.getAllByText('ThS. Chuyên gia từ API').length).toBeGreaterThan(
    0,
  )
  expect(screen.getByText('Lo âu')).toBeOnTheScreen()
  expect(screen.getByText('17:02')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Tin nhắn tư vấn')).toBeNull()
  expect(screen.getByTestId('chat-send')).toBeDisabled()
  expect(screen.queryByText(/Đã đọc|HIPAA|EMR/)).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: /Xem tóm tắt/ }))
  await fireEvent.press(screen.getByRole('button', { name: /Đặt lịch tiếp/ }))
  expect(summary).toHaveBeenCalledTimes(1)
  expect(book).toHaveBeenCalledTimes(1)
  await fireEvent(screen.getByTestId('chat-composer-area'), 'layout', {
    nativeEvent: { layout: { height: 84, width: 360, x: 0, y: 0 } },
  })
  expect(offset).toHaveBeenLastCalledWith(84)
  await view.unmount()
  expect(offset).toHaveBeenLastCalledWith(0)
})
