import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Linking } from 'react-native'
import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'
import type { PushApi } from '@/push/push-api'
import { PUSH_STATE_KEY } from '@/push/push-constants'
import {
  disablePush,
  enablePush,
  isPushEnabledOnDevice,
} from '@/push/push-registration'
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
jest.mock('@/push/push-registration', () => ({
  enablePush: jest.fn(),
  disablePush: jest.fn(async () => undefined),
  isPushEnabledOnDevice: jest.fn(async () => false),
}))
const pushApi: PushApi = { register: jest.fn(), revoke: jest.fn() }
beforeEach(() => {
  mockSession = { subject, role: 'USER' }
  jest.mocked(enablePush).mockReset().mockResolvedValue('ENABLED')
  jest.mocked(disablePush).mockClear()
  jest.mocked(isPushEnabledOnDevice).mockReset().mockResolvedValue(false)
})
async function mount(api = fixtureApi(), seed?: 'DENIED') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  if (seed) client.setQueryData(PUSH_STATE_KEY, seed)
  const tree = () => (
    <QueryClientProvider client={client}>
      <NotificationPreferencesScreen
        api={api}
        pushApi={pushApi}
        onBack={jest.fn()}
      />
    </QueryClientProvider>
  )
  return { api, client, tree, view: await render(tree()) }
}
// The whole row is the switch; pressing it flips its current value.
const toggle = (label: string) =>
  fireEvent.press(screen.getByRole('switch', { name: label }))
const save = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
it('saves supported channels, disabled category and overnight quiet hours with the server ETag', async () => {
  const next = preferences(1)
  next.preferences.channels.push = true
  jest.mocked(isPushEnabledOnDevice).mockResolvedValue(true)
  next.preferences.contentGroups.communityInteraction = false
  next.preferences.quietHours.enabled = true
  const api = fixtureApi({ savePreferences: jest.fn().mockResolvedValue(next) })
  const value = await mount(api)
  await screen.findByLabelText('Nhận thông báo')
  await toggle('Thông báo đẩy')
  await toggle('Tương tác cộng đồng')
  await toggle('Bật giờ yên lặng')
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
  expect(screen.queryByText(/chưa đăng ký thiết bị/)).toBeNull()
  expect(screen.queryByText(/PUSH chỉ lưu/)).toBeNull()
  expect(screen.queryByLabelText(/chưa hỗ trợ gửi/)).toBeNull()
  await value.view.unmount()
  await mount(fixtureApi({ preferences: jest.fn().mockResolvedValue(next) }))
  expect(await screen.findByLabelText('Tương tác cộng đồng')).not.toBeChecked()
  expect(await screen.findByLabelText('Thông báo đẩy')).toBeChecked()
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
  expect(screen.getByLabelText('Thông báo đẩy')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Bật giờ yên lặng')).toBeNull()
  await toggle('Trong ứng dụng')
  await toggle('Lịch hẹn và tin nhắn')
  await save()
  await waitFor(() => expect(api.savePreferences).toHaveBeenCalledTimes(1))
  expect(api.savePreferences).toHaveBeenCalledWith(
    {
      notificationsEnabled: true,
      channels: { inApp: false, push: false },
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
  await toggle('Bật giờ yên lặng')
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
  await toggle('Trong ứng dụng')
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
  await toggle('Trong ứng dụng')
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
  await toggle('Trong ứng dụng')
  await save()
  expect(
    await screen.findByText('Kiểm tra giờ và múi giờ rồi thử lưu lại.'),
  ).toBeOnTheScreen()
  expect(screen.getByLabelText('Trong ứng dụng')).not.toBeChecked()
  expect(screen.queryByText('Tùy chọn đã được lưu.')).toBeNull()
})
it('makes each row a switch that toggles on press and reports its state', async () => {
  await mount()
  const row = await screen.findByRole('switch', { name: 'Nhận thông báo' })
  expect(row).toBeChecked()
  await fireEvent.press(row)
  expect(
    screen.getByRole('switch', { name: 'Nhận thông báo' }),
  ).not.toBeChecked()
  expect(screen.getByRole('switch', { name: 'Email' })).toBeDisabled()
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
  await toggle('Trong ứng dụng')
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
describe('push switch', () => {
  const copy = {
    denied:
      'Bạn đã tắt quyền thông báo cho MentalBridge. Hãy bật lại trong Cài đặt của điện thoại.',
    unavailable:
      'Thông báo đẩy tạm thời chưa sẵn sàng. Bạn vẫn xem được thông báo trong ứng dụng.',
  }
  const withPush = () => {
    const on = preferences()
    on.preferences.channels.push = true
    jest.mocked(isPushEnabledOnDevice).mockResolvedValue(true)
    return on
  }
  it('registers first, then saves push and in-app together', async () => {
    const base = preferences()
    base.preferences.channels.inApp = false
    const api = fixtureApi({
      preferences: jest.fn().mockResolvedValue(base),
      savePreferences: jest.fn().mockResolvedValue(preferences(1)),
    })
    await mount(api)
    await screen.findByLabelText('Thông báo đẩy')
    expect(
      screen.getByText(/hiện trên điện thoại, kể cả khi ứng dụng đang đóng/),
    ).toBeOnTheScreen()
    await toggle('Thông báo đẩy')
    expect(enablePush).toHaveBeenCalledWith(pushApi)
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    expect(screen.getByLabelText('Trong ứng dụng')).toBeChecked()
    await save()
    await waitFor(() => expect(api.savePreferences).toHaveBeenCalledTimes(1))
    expect(api.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: { inApp: true, email: false, push: true },
      }),
      '"0"',
    )
  })
  it('shows a busy line and locks the switch while registering', async () => {
    let finish!: (value: 'ENABLED') => void
    jest.mocked(enablePush).mockReturnValue(
      new Promise((done) => {
        finish = done
      }),
    )
    await mount()
    await screen.findByLabelText('Thông báo đẩy')
    await toggle('Thông báo đẩy')
    expect(await screen.findByText('Đang bật thông báo đẩy…')).toBeOnTheScreen()
    expect(screen.getByLabelText('Thông báo đẩy')).toBeDisabled()
    await act(async () => finish('ENABLED'))
    await waitFor(() =>
      expect(screen.queryByText('Đang bật thông báo đẩy…')).toBeNull(),
    )
  })
  it('keeps the switch off, shows the denied line and opens system settings', async () => {
    jest.mocked(enablePush).mockResolvedValue('DENIED')
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    const { api } = await mount()
    await screen.findByLabelText('Thông báo đẩy')
    await toggle('Thông báo đẩy')
    expect(await screen.findByText(copy.denied)).toBeOnTheScreen()
    expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Lưu tùy chọn' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Mở cài đặt' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(api.savePreferences).not.toHaveBeenCalled()
  })
  it('keeps the switch off and shows the unavailable line', async () => {
    jest.mocked(enablePush).mockResolvedValue('UNAVAILABLE')
    await mount()
    await screen.findByLabelText('Thông báo đẩy')
    await toggle('Thông báo đẩy')
    expect(await screen.findByText(copy.unavailable)).toBeOnTheScreen()
    expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Mở cài đặt' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lưu tùy chọn' })).toBeDisabled()
  })
  // The permission dialog backgrounds the app: PushBridge's foreground refresh writes OFF around enablePush.
  it.each(['mid-flight', 'after the result'])(
    'keeps the unavailable line when a foreground refresh writes OFF %s',
    async (when) => {
      let finish!: (value: 'UNAVAILABLE') => void
      jest.mocked(enablePush).mockReturnValue(
        new Promise((done) => {
          finish = done
        }),
      )
      const { client } = await mount()
      await screen.findByLabelText('Thông báo đẩy')
      await toggle('Thông báo đẩy')
      await screen.findByText('Đang bật thông báo đẩy…')
      if (when === 'mid-flight')
        await act(async () => client.setQueryData(PUSH_STATE_KEY, 'OFF'))
      await act(async () => finish('UNAVAILABLE'))
      if (when !== 'mid-flight')
        await act(async () => client.setQueryData(PUSH_STATE_KEY, 'OFF'))
      expect(await screen.findByText(copy.unavailable)).toBeOnTheScreen()
      expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
    },
  )
  it('turns the switch on when a foreground refresh writes OFF during enablePush', async () => {
    let finish!: (value: 'ENABLED') => void
    jest.mocked(enablePush).mockReturnValue(
      new Promise((done) => {
        finish = done
      }),
    )
    const { client } = await mount()
    await screen.findByLabelText('Thông báo đẩy')
    await toggle('Thông báo đẩy')
    await screen.findByText('Đang bật thông báo đẩy…')
    await act(async () => client.setQueryData(PUSH_STATE_KEY, 'OFF'))
    await act(async () => finish('ENABLED'))
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    expect(screen.queryByText(copy.unavailable)).toBeNull()
  })
  // Returning from the permission dialog can remount the editor (focus refetch); the enable outcome must survive it.
  describe('when the editor remounts around enablePush', () => {
    const remount = async (value: Awaited<ReturnType<typeof mount>>) => {
      await value.view.unmount()
      await render(value.tree())
      await screen.findByLabelText('Thông báo đẩy')
    }
    const pending = <T extends 'ENABLED' | 'UNAVAILABLE'>() => {
      let finish!: (value: T) => void
      jest.mocked(enablePush).mockReturnValue(
        new Promise<T>((done) => {
          finish = done
        }),
      )
      return (value: T) => act(async () => finish(value))
    }
    it('keeps the busy line while the enable is still in flight', async () => {
      const finish = pending<'ENABLED'>()
      const value = await mount()
      await screen.findByLabelText('Thông báo đẩy')
      await toggle('Thông báo đẩy')
      await remount(value)
      expect(
        await screen.findByText('Đang bật thông báo đẩy…'),
      ).toBeOnTheScreen()
      expect(screen.getByLabelText('Thông báo đẩy')).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Lưu tùy chọn' }),
      ).toBeDisabled()
      await finish('ENABLED')
      await waitFor(() =>
        expect(screen.queryByText('Đang bật thông báo đẩy…')).toBeNull(),
      )
    })
    it.each(['while in flight', 'after the result'])(
      'shows the unavailable line when it remounts %s',
      async (when) => {
        const finish = pending<'UNAVAILABLE'>()
        const value = await mount()
        await screen.findByLabelText('Thông báo đẩy')
        await toggle('Thông báo đẩy')
        if (when === 'while in flight') {
          await remount(value)
          await finish('UNAVAILABLE')
        } else {
          await finish('UNAVAILABLE')
          await remount(value)
        }
        expect(await screen.findByText(copy.unavailable)).toBeOnTheScreen()
        expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
      },
    )
    it.each(['while in flight', 'after the result'])(
      'turns push and in-app on in the draft when it remounts %s',
      async (when) => {
        const finish = pending<'ENABLED'>()
        const base = preferences()
        base.preferences.channels.inApp = false
        const api = fixtureApi({
          preferences: jest.fn().mockResolvedValue(base),
          savePreferences: jest.fn().mockResolvedValue(preferences(1)),
        })
        const value = await mount(api)
        await screen.findByLabelText('Thông báo đẩy')
        await toggle('Thông báo đẩy')
        if (when === 'while in flight') {
          await remount(value)
          await finish('ENABLED')
        } else {
          await finish('ENABLED')
          await remount(value)
        }
        await waitFor(() =>
          expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
        )
        expect(screen.getByLabelText('Trong ứng dụng')).toBeChecked()
        await save()
        await waitFor(() =>
          expect(api.savePreferences).toHaveBeenCalledTimes(1),
        )
        expect(api.savePreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            channels: { inApp: true, email: false, push: true },
          }),
          '"0"',
        )
      },
    )
  })
  it('revokes this device after a successful save that turns push off', async () => {
    const api = fixtureApi({
      preferences: jest.fn().mockResolvedValue(withPush()),
      savePreferences: jest.fn().mockResolvedValue(preferences(1)),
    })
    await mount(api)
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    await toggle('Thông báo đẩy')
    expect(disablePush).not.toHaveBeenCalled()
    await save()
    await waitFor(() => expect(disablePush).toHaveBeenCalledWith(pushApi))
    expect(api.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: { inApp: true, email: false, push: false },
      }),
      '"0"',
    )
  })
  it('turns push off with in-app, explains why and revokes after save', async () => {
    const api = fixtureApi({
      preferences: jest.fn().mockResolvedValue(withPush()),
      savePreferences: jest.fn().mockResolvedValue(preferences(1)),
    })
    await mount(api)
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    await toggle('Trong ứng dụng')
    expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
    expect(
      screen.getByText('Thông báo đẩy cần bật thông báo trong ứng dụng.'),
    ).toBeOnTheScreen()
    await save()
    await waitFor(() => expect(disablePush).toHaveBeenCalledWith(pushApi))
    expect(api.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: { inApp: false, email: false, push: false },
      }),
      '"0"',
    )
  })
  it('shows the switch off with the denied line when the cache says permission was withdrawn', async () => {
    await mount(
      fixtureApi({ preferences: jest.fn().mockResolvedValue(withPush()) }),
      'DENIED',
    )
    expect(await screen.findByText(copy.denied)).toBeOnTheScreen()
    expect(screen.getByLabelText('Thông báo đẩy')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Mở cài đặt' })).toBeOnTheScreen()
  })
  it('follows PushBridge refreshes: ON only while registration is confirmed', async () => {
    const { client } = await mount(
      fixtureApi({ preferences: jest.fn().mockResolvedValue(withPush()) }),
    )
    const push = () => screen.getByLabelText('Thông báo đẩy')
    await waitFor(() => expect(push()).toBeChecked())
    // The query cache notifies observers on a timer, so each step waits for its line.
    const refresh = (state: string) =>
      act(async () => client.setQueryData(PUSH_STATE_KEY, state))

    await refresh('DENIED')
    expect(await screen.findByText(copy.denied)).toBeOnTheScreen()
    expect(push()).not.toBeChecked()
    // Permission restored but the device is not registered again.
    await refresh('OFF')
    await waitFor(() => expect(screen.queryByText(copy.denied)).toBeNull())
    expect(push()).not.toBeChecked()
    await refresh('UNAVAILABLE')
    expect(await screen.findByText(copy.unavailable)).toBeOnTheScreen()
    expect(push()).not.toBeChecked()
    await refresh('ENABLED')
    await waitFor(() => expect(push()).toBeChecked())
    expect(screen.queryByText(copy.unavailable)).toBeNull()
  })
  it('clears the in-app line when in-app is turned back on', async () => {
    await mount(
      fixtureApi({ preferences: jest.fn().mockResolvedValue(withPush()) }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    await toggle('Trong ứng dụng')
    const inApp = 'Thông báo đẩy cần bật thông báo trong ứng dụng.'
    expect(screen.getByText(inApp)).toBeOnTheScreen()
    await toggle('Trong ứng dụng')
    expect(screen.queryByText(inApp)).toBeNull()
    expect(screen.getByLabelText('Trong ứng dụng')).toBeChecked()
  })
  it('says why push is disabled while Nhận thông báo is off', async () => {
    const off = preferences()
    off.preferences.notificationsEnabled = false
    await mount(fixtureApi({ preferences: jest.fn().mockResolvedValue(off) }))
    await screen.findByLabelText('Thông báo đẩy')
    expect(screen.getByLabelText('Thông báo đẩy')).toBeDisabled()
    expect(
      screen.getByText('Bật “Nhận thông báo” để dùng thông báo đẩy.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/hiện trên điện thoại/)).toBeNull()
    await toggle('Nhận thông báo')
    expect(screen.getByText(/hiện trên điện thoại/)).toBeOnTheScreen()
  })
  it('sends channels.push for a specialist after registering', async () => {
    mockSession = { subject, role: 'SPECIALIST' }
    const api = fixtureApi({
      savePreferences: jest.fn().mockResolvedValue(preferences(1)),
    })
    await mount(api)
    await screen.findByLabelText('Thông báo đẩy')
    await toggle('Thông báo đẩy')
    await waitFor(() =>
      expect(screen.getByLabelText('Thông báo đẩy')).toBeChecked(),
    )
    await save()
    await waitFor(() => expect(api.savePreferences).toHaveBeenCalledTimes(1))
    expect(api.savePreferences).toHaveBeenCalledWith(
      {
        notificationsEnabled: true,
        channels: { inApp: true, push: true },
        contentGroups: { appointmentMessage: true, resourceSystem: true },
      },
      '"0"',
    )
  })
})
describe('daily reminder time', () => {
  const timeField = () => screen.getByLabelText('Giờ nhắc mỗi ngày')
  const inlineError = 'Nhập giờ dạng HH:mm, ví dụ 20:00.'
  it('shows the stored time with its time zone and sends dailyReminderTime in the patch', async () => {
    const next = preferences(1)
    next.preferences.dailyReminderTime = '07:30'
    const api = fixtureApi({
      savePreferences: jest.fn().mockResolvedValue(next),
    })
    await mount(api)
    await screen.findByLabelText('Nhận thông báo')
    expect(
      screen.getByRole('header', { name: 'Giờ nhắc mỗi ngày' }),
    ).toBeOnTheScreen()
    expect(timeField()).toHaveDisplayValue('20:00')
    expect(
      screen.getByText(
        'Nhắc viết nhật ký, ghi cảm xúc và kế hoạch hỗ trợ vào giờ này, theo múi giờ Asia/Ho_Chi_Minh.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/Đã lưu giờ nhắc/)).toBeNull()
    await fireEvent.changeText(timeField(), '07:30')
    await save()
    expect(await screen.findByText('Đã lưu giờ nhắc 07:30.')).toBeOnTheScreen()
    expect(api.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ dailyReminderTime: '07:30' }),
      '"0"',
    )
  })
  it('limits the field to five characters and stays quiet while typing', async () => {
    await mount()
    await screen.findByLabelText('Nhận thông báo')
    expect(timeField().props.maxLength).toBe(5)
    for (const partial of ['0', '07', '07:'])
      await fireEvent.changeText(timeField(), partial)
    expect(screen.queryByText(inlineError)).toBeNull()
  })
  it('shows the alert after blur with an invalid value and clears it once valid', async () => {
    await mount()
    await screen.findByLabelText('Nhận thông báo')
    await fireEvent.changeText(timeField(), '25:00')
    expect(screen.queryByText(inlineError)).toBeNull()
    await fireEvent(timeField(), 'blur')
    expect(await screen.findByText(inlineError)).toBeOnTheScreen()
    await fireEvent.changeText(timeField(), '21:15')
    expect(screen.queryByText(inlineError)).toBeNull()
  })
  it.each(['25:00', '7h'])(
    'blocks save for %s without blur and shows the inline alert',
    async (value) => {
      const { api } = await mount()
      await screen.findByLabelText('Nhận thông báo')
      await fireEvent.changeText(timeField(), value)
      expect(screen.queryByText(inlineError)).toBeNull()
      await save()
      expect(await screen.findByText(inlineError)).toBeOnTheScreen()
      expect(api.savePreferences).not.toHaveBeenCalled()
      expect(screen.queryByText(/Đã lưu giờ nhắc/)).toBeNull()
      await fireEvent.changeText(timeField(), '21:15')
      expect(screen.queryByText(inlineError)).toBeNull()
    },
  )
  it('does not show the saved-time line after a save that left the time unchanged', async () => {
    const api = fixtureApi()
    await mount(api)
    await screen.findByLabelText('Nhận thông báo')
    await toggle('Tương tác cộng đồng')
    await save()
    expect(await screen.findByText('Tùy chọn đã được lưu.')).toBeOnTheScreen()
    expect(screen.queryByText(/Đã lưu giờ nhắc/)).toBeNull()
  })
  // The editor remounts on save, so a success line above the viewport would push everything down: it must sit right before the button.
  it.each([
    ['time changed', 'Đã lưu giờ nhắc 07:30.'],
    ['time unchanged', 'Tùy chọn đã được lưu.'],
  ])(
    'shows one status line directly above the save button (%s)',
    async (when, line) => {
      const next = preferences(1)
      if (when === 'time changed') next.preferences.dailyReminderTime = '07:30'
      await mount(
        fixtureApi({ savePreferences: jest.fn().mockResolvedValue(next) }),
      )
      await screen.findByLabelText('Nhận thông báo')
      if (when === 'time changed')
        await fireEvent.changeText(timeField(), '07:30')
      else await toggle('Tương tác cộng đồng')
      await save()
      await screen.findByText(line)
      expect(screen.getAllByText(/Đã lưu|đã được lưu/)).toHaveLength(1)
      // Document order of every rendered string: nothing may sit between the status line and the button label.
      const texts: string[] = []
      const walk = (node: unknown) => {
        if (typeof node === 'string') texts.push(node)
        else if (node && typeof node === 'object')
          for (const child of (node as { children?: unknown[] }).children ?? [])
            walk(child)
      }
      walk(screen.toJSON())
      expect(texts[texts.indexOf(line) + 1]).toBe('Lưu tùy chọn')
    },
  )
  it('toggles the support plan group and sends it in contentGroups', async () => {
    const api = fixtureApi()
    await mount(api)
    await screen.findByLabelText('Nhận thông báo')
    expect(screen.getByLabelText('Kế hoạch hỗ trợ hôm nay')).toBeChecked()
    await toggle('Kế hoạch hỗ trợ hôm nay')
    await save()
    await waitFor(() => expect(api.savePreferences).toHaveBeenCalledTimes(1))
    expect(api.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        contentGroups: expect.objectContaining({ supportPlanReminder: false }),
      }),
      '"0"',
    )
  })
  it('hides the time section and the plan group from a specialist', async () => {
    mockSession = { subject, role: 'SPECIALIST' }
    await mount()
    await screen.findByLabelText('Lịch hẹn và tin nhắn')
    expect(screen.queryByLabelText('Giờ nhắc mỗi ngày')).toBeNull()
    expect(screen.queryByText('Giờ nhắc mỗi ngày')).toBeNull()
    expect(screen.queryByLabelText('Kế hoạch hỗ trợ hôm nay')).toBeNull()
  })
})
