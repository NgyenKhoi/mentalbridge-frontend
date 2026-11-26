import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { OnboardingGuideProvider, GuideReplayButton } from './OnboardingGuide'
import { guideKey } from './guide-storage'

const mockReplace = jest.fn()
let mockPath = '/user'
let mockAccount = {
  status: 'authenticated',
  session: { role: 'USER', subject: 'guide-account-0' },
}
let accountCounter = 0
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: () => mockPath,
}))
jest.mock('@/auth/session-context', () => ({ useSession: () => mockAccount }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))

const guide = () => (
  <OnboardingGuideProvider>
    <GuideReplayButton />
  </OnboardingGuideProvider>
)
beforeEach(() => {
  jest.clearAllMocks()
  mockReplace.mockImplementation((href: string) => {
    mockPath = href.replace(/\/\([^/]+\)/g, '')
  })
  mockPath = '/user'
  mockAccount = {
    status: 'authenticated',
    session: { role: 'USER', subject: `guide-account-${++accountCounter}` },
  }
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined)
})

it('guides a user through real routes, supports Back, Skip and replay', async () => {
  await render(guide())
  await screen.findByText('Trang chủ của bạn')
  expect(screen.getByRole('button', { name: 'Quay lại' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
  expect(screen.getByText('Ghi lại cảm xúc trong Nhật ký')).toBeOnTheScreen()
  expect(mockReplace).toHaveBeenLastCalledWith('/(user)/journal')
  await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }))
  expect(mockReplace).toHaveBeenLastCalledWith('/(user)/user')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' }),
  )
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    guideKey(mockAccount.session.subject, 'USER'),
    'skipped',
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem lại hướng dẫn' }),
  )
  expect(screen.getByText('Bước 1/6')).toBeOnTheScreen()
}, 60000)

it('uses the six specialist topics and records completion for that role', async () => {
  mockAccount.session.role = 'SPECIALIST'
  mockPath = '/specialist'
  await render(guide())
  await screen.findByText('Tổng quan công việc')
  for (const route of [
    'clients',
    'appointments',
    'appointments',
    'appointments',
    'profile',
  ]) {
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(mockReplace).toHaveBeenLastCalledWith(`/(specialist)/${route}`)
  }
  expect(screen.getByText('Bước 6/6')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Hoàn tất' }))
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    guideKey(mockAccount.session.subject, 'SPECIALIST'),
    'completed',
  )
  expect(screen.queryByText('Bước 6/6')).toBeNull()
})

it('does not interrupt a non-home page and allows explicit replay', async () => {
  mockPath = '/appointments/appointment/video'
  await render(guide())
  await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled())
  expect(screen.queryByText('Bước 1/6')).toBeNull()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem lại hướng dẫn' }),
  )
  expect(screen.getByText('Bước 1/6')).toBeOnTheScreen()
})

it('keeps a seen guide closed and separates preferences across roles and accounts', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('completed')
  const view = await render(guide())
  await waitFor(() =>
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      guideKey(mockAccount.session.subject, 'USER'),
    ),
  )
  expect(screen.queryByText('Bước 1/6')).toBeNull()
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
  mockAccount.session.role = 'SPECIALIST'
  mockPath = '/specialist'
  await view.rerender(guide())
  await screen.findByText('Tổng quan công việc')
  expect(guideKey(mockAccount.session.subject, 'USER')).not.toEqual(
    guideKey(mockAccount.session.subject, 'SPECIALIST'),
  )
  mockAccount.status = 'unauthenticated'
  await view.rerender(guide())
  expect(screen.queryByText('Bước 1/6')).toBeNull()
})

it('can dismiss when storage fails and remembers the choice for the session', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValue(new Error('unavailable'))
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValue(new Error('unavailable'))
  const view = await render(guide())
  await screen.findByText('Trang chủ của bạn')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' }),
  )
  await view.unmount()
  await render(guide())
  await waitFor(() => expect(screen.queryByText('Bước 1/6')).toBeNull())
})

it('does not reopen after skipping while an earlier storage read is pending', async () => {
  let resolveRead: (value: string | null) => void = () => {}
  jest.mocked(SecureStore.getItemAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve
      }),
  )
  mockPath = '/profile'
  const view = await render(guide())
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem lại hướng dẫn' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' }),
  )
  resolveRead(null)
  mockPath = '/user'
  await view.rerender(guide())
  await waitFor(() => expect(screen.queryByText('Bước 1/6')).toBeNull())
})
