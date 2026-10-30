import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'
import { NotificationPreferencesScreen } from './NotificationPreferencesScreen'
import {
  fixtureApi,
  preferences,
  subject,
  targetId,
} from './notification-fixtures'
let mockSession: AppSession | null = { subject, role: 'USER' }
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
beforeEach(() => {
  mockSession = { subject, role: 'USER' }
})
async function mount(api = fixtureApi()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const tree = () => (
    <QueryClientProvider client={client}>
      <NotificationPreferencesScreen api={api} onBack={jest.fn()} />
    </QueryClientProvider>
  )
  return { api, client, tree, view: await render(tree()) }
}
const toggle = (label: string, value: boolean) =>
  fireEvent(screen.getByLabelText(label), 'valueChange', value)
const save = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
it('saves supported channels, disabled category and overnight quiet hours with the server ETag', async () => {
  const next = preferences(1)
  next.preferences.channels.push = true
  next.preferences.contentGroups.communityInteraction = false
  next.preferences.quietHours.enabled = true
  const api = fixtureApi({ savePreferences: jest.fn().mockResolvedValue(next) })
  const value = await mount(api)
  await screen.findByLabelText('Nhận thông báo')
  await toggle('Lưu tùy chọn PUSH (chưa hỗ trợ gửi)', true)
  await toggle('Tương tác cộng đồng', false)
  await toggle('Bật giờ yên lặng', true)
  await save()
  expect(await screen.findByText('Tùy chọn đã được lưu.')).toBeOnTheScreen()
  expect(api.savePreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      channels: { inApp: true, email: false, push: true },
      contentGroups: expect.objectContaining({ communityInteraction: false }),
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
    }),
    '"0"',
  )
  expect(screen.getByRole('button', { name: 'Lưu tùy chọn' })).toBeDisabled()
  expect(
    screen.getByText(/chưa đăng ký thiết bị hoặc gửi push/),
  ).toBeOnTheScreen()
  await value.view.unmount()
  await mount(fixtureApi({ preferences: jest.fn().mockResolvedValue(next) }))
  expect(await screen.findByLabelText('Tương tác cộng đồng')).not.toBeChecked()
  expect(
    screen.getByLabelText('Lưu tùy chọn PUSH (chưa hỗ trợ gửi)'),
  ).toBeChecked()
})
it('shows only specialist-safe preferences and sends the bounded ETag patch', async () => {
  mockSession = { subject, role: 'SPECIALIST' }
  const api = fixtureApi({
    savePreferences: jest.fn().mockResolvedValue(preferences(1)),
  })
  await mount(api)
  expect(
    await screen.findByRole('header', {
      name: 'Tùy chọn thông báo chuyên môn',
    }),
  ).toBeOnTheScreen()
  expect(await screen.findByLabelText('Lịch hẹn và tin nhắn')).toBeOnTheScreen()
  expect(screen.getByLabelText('Tài khoản và hệ thống')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Nhắc viết nhật ký')).toBeNull()
  expect(screen.queryByLabelText('Email')).toBeNull()
  expect(screen.queryByLabelText('Bật giờ yên lặng')).toBeNull()
  await toggle('Trong ứng dụng', false)
  await toggle('Lịch hẹn và tin nhắn', false)
  await save()
  await waitFor(() => expect(api.savePreferences).toHaveBeenCalledTimes(1))
  expect(api.savePreferences).toHaveBeenCalledWith(
    {
      notificationsEnabled: true,
      channels: { inApp: false },
      contentGroups: {
        appointmentMessage: false,
        resourceSystem: true,
      },
    },
    '"0"',
  )
})
it('keeps inbox history distinct from new-notification category preferences', async () => {
  const value = preferences()
  value.preferences.notificationsEnabled = false
  value.preferences.contentGroups.communityInteraction = false
  await mount(fixtureApi({ preferences: jest.fn().mockResolvedValue(value) }))
  expect(
    await screen.findByText(/Bạn vẫn xem được lịch sử đã lưu/),
  ).toBeOnTheScreen()
  expect(screen.getByText(/không xóa lịch sử đã lưu/)).toBeOnTheScreen()
  expect(screen.getByLabelText('Tương tác cộng đồng')).toBeDisabled()
})
it.each(['25:00', '22:60', 'bad'])(
  'does not send malformed quiet-hour time %s',
  async (clock) => {
    const { api } = await mount()
    await screen.findByLabelText('Bắt đầu (HH:mm)')
    await fireEvent.changeText(screen.getByLabelText('Bắt đầu (HH:mm)'), clock)
    await save()
    await screen.findByRole('alert')
    expect(api.savePreferences).not.toHaveBeenCalled()
  },
)
it('rejects invalid time zone and an enabled empty quiet window', async () => {
  const { api } = await mount()
  await screen.findByLabelText('Bật giờ yên lặng')
  await toggle('Bật giờ yên lặng', true)
  await fireEvent.changeText(screen.getByLabelText('Kết thúc (HH:mm)'), '22:00')
  await save()
  expect(api.savePreferences).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText('Kết thúc (HH:mm)'), '07:00')
  await fireEvent.changeText(
    screen.getByLabelText('Múi giờ (IANA, ví dụ Asia/Ho_Chi_Minh)'),
    'Not/AZone',
  )
  await save()
  expect(api.savePreferences).not.toHaveBeenCalled()
})
it('refreshes the authoritative version on 412 instead of replaying an obsolete draft', async () => {
  const latest = preferences(4)
  latest.preferences.channels.email = true
  const api = fixtureApi({
    preferences: jest
      .fn()
      .mockResolvedValueOnce(preferences())
      .mockResolvedValue(latest),
    savePreferences: jest.fn().mockRejectedValue(
      new ApiError({
        code: 'NOTIFICATION_PREFERENCE_VERSION_MISMATCH',
        status: 412,
        message: 'stale',
      }),
    ),
  })
  await mount(api)
  await screen.findByLabelText('Trong ứng dụng')
  await toggle('Trong ứng dụng', false)
  await save()
  await waitFor(() => expect(api.preferences).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.getByLabelText('Email')).toBeChecked())
  expect(screen.getByRole('button', { name: 'Lưu tùy chọn' })).toBeDisabled()
  expect(api.savePreferences).toHaveBeenCalledTimes(1)
})
it('locks preference writes when an ambiguous save cannot be reconciled', async () => {
  const api = fixtureApi({
    preferences: jest
      .fn()
      .mockResolvedValueOnce(preferences())
      .mockRejectedValue(new Error('down')),
    savePreferences: jest.fn().mockRejectedValue(new Error('timeout')),
  })
  await mount(api)
  await screen.findByLabelText('Trong ứng dụng')
  await toggle('Trong ứng dụng', false)
  await save()
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Lưu tùy chọn' })).toBeNull()
  expect(api.savePreferences).toHaveBeenCalledTimes(1)
})
it('preserves edits for a server validation error without claiming success', async () => {
  const api = fixtureApi({
    savePreferences: jest
      .fn()
      .mockRejectedValue(
        new ApiError({ code: 'VALIDATION', status: 422, message: 'bad' }),
      ),
  })
  await mount(api)
  await screen.findByLabelText('Trong ứng dụng')
  await toggle('Trong ứng dụng', false)
  await save()
  expect(
    await screen.findByText('Kiểm tra giờ và múi giờ rồi thử lưu lại.'),
  ).toBeOnTheScreen()
  expect(screen.getByLabelText('Trong ứng dụng')).not.toBeChecked()
  expect(screen.queryByText('Tùy chọn đã được lưu.')).toBeNull()
})
it('drops unsaved draft on subject switch and rehydrates the new owner, even at the same version', async () => {
  const next = preferences()
  next.preferences.quietHours.start = '21:00'
  const api = fixtureApi({
    preferences: jest
      .fn()
      .mockResolvedValueOnce(preferences())
      .mockResolvedValueOnce(next),
  })
  const value = await mount(api)
  await screen.findByLabelText('Bắt đầu (HH:mm)')
  await fireEvent.changeText(screen.getByLabelText('Bắt đầu (HH:mm)'), '20:00')
  mockSession = { subject: targetId, role: 'USER' }
  await value.view.rerender(value.tree())
  await waitFor(() =>
    expect(screen.getByLabelText('Bắt đầu (HH:mm)')).toHaveDisplayValue(
      '21:00',
    ),
  )
  expect(screen.getByRole('button', { name: 'Lưu tùy chọn' })).toBeDisabled()
  expect(api.savePreferences).not.toHaveBeenCalled()
})
it('does not reinsert old-owner preferences after a late save completes', async () => {
  let resolve!: (value: ReturnType<typeof preferences>) => void
  const response = new Promise<ReturnType<typeof preferences>>((done) => {
    resolve = done
  })
  const api = fixtureApi({
    savePreferences: jest.fn().mockReturnValue(response),
  })
  const value = await mount(api)
  await screen.findByLabelText('Trong ứng dụng')
  await toggle('Trong ứng dụng', false)
  await save()
  mockSession = { subject: targetId, role: 'USER' }
  await value.view.rerender(value.tree())
  value.client.removeQueries({ queryKey: ['notifications', subject] })
  await act(async () => resolve(preferences(1)))
  expect(
    value.client.getQueryData([
      'notifications',
      subject,
      'USER',
      'preferences',
    ]),
  ).toBeUndefined()
})
it.each([401, 503])(
  'shows a truthful preference dependency/session error %s',
  async (status) => {
    await mount(
      fixtureApi({
        preferences: jest
          .fn()
          .mockRejectedValue(
            new ApiError({ code: 'ERROR', status, message: 'error' }),
          ),
      }),
    )
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Lưu tùy chọn' })).toBeNull()
  },
)
