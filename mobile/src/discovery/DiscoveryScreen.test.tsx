import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'

import type { DiscoveryApi } from './discovery-api'
import type { DiscoveryItem } from './discovery-contract'
import {
  fixturePage,
  fixtureSlot,
  fixtureSpecialist,
  specialistId,
} from './discovery-fixtures'
import { slotLabel } from './discovery-model'
import { DiscoveryScreen } from './DiscoveryScreen'

let mockSession: AppSession | null = {
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'USER',
}
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
const error = (status: number, code = 'DEPENDENCY_UNAVAILABLE') =>
  new ApiError({ status, code, message: 'synthetic' })
function api(overrides: Partial<DiscoveryApi> = {}): DiscoveryApi {
  return {
    list: jest.fn().mockResolvedValue(fixturePage),
    detail: jest.fn().mockResolvedValue(fixtureSpecialist),
    ...overrides,
  }
}
function view(service: DiscoveryApi, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <DiscoveryScreen api={service} onBack={jest.fn()} />
    </QueryClientProvider>
  )
}
async function mount(service = api()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const result = await render(view(service, client))
  return { ...result, service, client }
}
async function openProfile() {
  await screen.findByRole('button', {
    name: `Xem hồ sơ ${fixtureSpecialist.displayName}`,
  })
  await fireEvent.press(
    screen.getByRole('button', {
      name: `Xem hồ sơ ${fixtureSpecialist.displayName}`,
    }),
  )
  await screen.findByRole('button', { name: `Chọn ${slotLabel(fixtureSlot)}` })
}
async function selectSlot() {
  await fireEvent.press(
    screen.getByRole('button', { name: `Chọn ${slotLabel(fixtureSlot)}` }),
  )
}

describe('MB-629 daily-current public discovery', () => {
  beforeEach(() => {
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
    jest.restoreAllMocks()
  })
  it('browses FREE without an upsell guard and preserves server result order', async () => {
    const second = {
      ...fixtureSpecialist,
      specialistAccountId: fixtureSlot.id,
      displayName: 'Chuyên gia thứ hai',
      selectableSlots: [
        { ...fixtureSlot, specialistAccountId: fixtureSlot.id },
      ],
    }
    await mount(
      api({
        list: jest.fn().mockResolvedValue({
          ...fixturePage,
          items: [fixtureSpecialist, second],
          count: 2,
        }),
      }),
    )
    await screen.findByText(fixtureSpecialist.displayName)
    expect(
      screen
        .getAllByText(/^(Chuyên gia tổng hợp|Chuyên gia thứ hai)$/)
        .map((node) => node.props.children),
    ).toEqual([fixtureSpecialist.displayName, second.displayName])
    expect(screen.queryByText(/cần gói Plus/i)).toBeNull()
    expect(screen.getAllByText('Chưa có đánh giá tổng hợp.')).toHaveLength(2)
  })
  it('applies only server-supported search filters and preserves them on detail back', async () => {
    const { service } = await mount()
    await screen.findByText(fixtureSpecialist.displayName)
    await fireEvent.press(screen.getByRole('radio', { name: 'Lo âu' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Tiếng Việt' }))
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Chat trong ứng dụng' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tìm theo tiêu chí' }),
    )
    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith(
        {
          supportArea: 'ANXIETY_SYMPTOMS',
          language: 'vi',
          modality: 'IN_APP_CHAT',
        },
        undefined,
      ),
    )
    await openProfile()
    expect(service.detail).toHaveBeenCalledWith(specialistId, {
      supportArea: 'ANXIETY_SYMPTOMS',
      language: 'vi',
      modality: 'IN_APP_CHAT',
    })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Quay lại danh sách chuyên gia' }),
    )
    await screen.findByText(fixtureSpecialist.displayName)
    expect(
      screen.getByRole('radio', { name: 'Lo âu' }).props.accessibilityState,
    ).toEqual({ selected: true })
  })
  it.each([false, true])(
    'shows distinct source/filter empty states (filtered=%s)',
    async (filtered) => {
      await mount(
        api({
          list: jest
            .fn()
            .mockResolvedValue({ ...fixturePage, items: [], count: 0 }),
        }),
      )
      if (filtered) {
        await fireEvent.press(screen.getByRole('radio', { name: 'Lo âu' }))
        await fireEvent.press(
          screen.getByRole('button', { name: 'Tìm theo tiêu chí' }),
        )
      }
      await screen.findByText(
        filtered
          ? /Chưa có chuyên gia và khung giờ phù hợp/
          : /Chưa có chuyên gia với khung giờ chọn được/,
      )
    },
  )
  it('shows authoritative full profile and only returned rating aggregate', async () => {
    await mount(
      api({
        detail: jest.fn().mockResolvedValue({
          ...fixtureSpecialist,
          ratingAggregate: { averageRating: 4.25, ratingCount: 7 },
        }),
      }),
    )
    await openProfile()
    expect(screen.getByText(fixtureSpecialist.bio)).toBeTruthy()
    expect(screen.getByText('4,25 / 5 · 7 đánh giá')).toBeTruthy()
    expect(screen.queryByText(/Giá|Chứng chỉ|Điện thoại/)).toBeNull()
  })
  it('freshly rechecks FREE policy and slot, previews without booking mutation', async () => {
    const { service } = await mount()
    await openProfile()
    await selectSlot()
    await screen.findByText('Khung giờ đã chọn')
    expect(service.list).toHaveBeenCalledTimes(2)
    expect(service.detail).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Gói hiện tại chỉ cho phép duyệt xem/)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Đặt lịch|Gửi yêu cầu/ }),
    ).toBeNull()
  })
  it('hands off policy-approved selection without claiming a reservation or entitlement', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce(fixturePage)
      .mockResolvedValue({
        ...fixturePage,
        packageCode: 'PLUS',
        bookingHandoff: 'BOOKING_POLICY_CHECK_REQUIRED',
      })
    await mount(api({ list }))
    await openProfile()
    await selectSlot()
    await screen.findByText(/Chưa gửi yêu cầu và chưa giữ chỗ/)
  })
  it.each(['BROWSE_ONLY', 'BOOKING_POLICY_CHECK_REQUIRED'] as const)(
    'exposes booking handoff only for the current server policy %s',
    async (bookingHandoff) => {
      const onBook = jest.fn()
      const service = api({
        list: jest.fn().mockResolvedValue({
          ...fixturePage,
          bookingHandoff,
          packageCode: bookingHandoff === 'BROWSE_ONLY' ? 'FREE' : 'PLUS',
        }),
      })
      await render(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { gcTime: 0, retry: false } },
            })
          }
        >
          <DiscoveryScreen api={service} onBack={jest.fn()} onBook={onBook} />
        </QueryClientProvider>,
      )
      await openProfile()
      await selectSlot()
      await screen.findByText('Khung giờ đã chọn')
      const action = screen.queryByRole('button', { name: 'Tiếp tục đặt lịch' })
      if (bookingHandoff === 'BROWSE_ONLY') expect(action).toBeNull()
      else {
        if (!action) throw new Error('Approved booking handoff missing')
        await fireEvent.press(action)
        expect(onBook).toHaveBeenCalledWith(
          expect.objectContaining({ slot: fixtureSlot, bookingHandoff }),
        )
      }
    },
  )
  it.each(['missing', 'revision', 'time', 'video-disabled'])(
    'fails closed when selected slot becomes %s',
    async (kind) => {
      const changed: DiscoveryItem = {
        ...fixtureSpecialist,
        selectableSlots:
          kind === 'missing'
            ? []
            : [
                {
                  ...fixtureSlot,
                  ...(kind === 'revision' ? { version: 1 } : {}),
                  ...(kind === 'time'
                    ? { startAt: '2026-10-15T11:00:00Z' }
                    : {}),
                  ...(kind === 'video-disabled'
                    ? { modality: 'IN_APP_VIDEO' as const }
                    : {}),
                },
              ],
      }
      const detail = jest
        .fn()
        .mockResolvedValueOnce(fixtureSpecialist)
        .mockResolvedValue(changed)
      await mount(api({ detail }))
      await openProfile()
      await selectSlot()
      await screen.findByText(/Khung giờ đã thay đổi hoặc không còn chọn được/)
      expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
      expect(screen.queryByText(fixtureSpecialist.bio)).toBeNull()
    },
  )
  it('accepts enabled video only from current public slots and capability', async () => {
    const slot = { ...fixtureSlot, modality: 'IN_APP_VIDEO' as const }
    const specialist = { ...fixtureSpecialist, selectableSlots: [slot] }
    await mount(
      api({
        list: jest.fn().mockResolvedValue({
          ...fixturePage,
          videoEnabled: true,
          items: [specialist],
        }),
        detail: jest.fn().mockResolvedValue(specialist),
      }),
    )
    await openProfile()
    await selectSlot()
    await screen.findByText('Khung giờ đã chọn')
    expect(screen.getByText('Video trong ứng dụng · 60 phút')).toBeTruthy()
  })
  it('removes stale profile and slots when refresh returns suspended/not-discoverable', async () => {
    const detail = jest
      .fn()
      .mockResolvedValueOnce(fixtureSpecialist)
      .mockRejectedValue(error(404, 'SPECIALIST_NOT_DISCOVERABLE'))
    await mount(api({ detail }))
    await openProfile()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lại hồ sơ và khung giờ' }),
    )
    await screen.findByText(/Hồ sơ hoặc khung giờ không còn khả dụng/)
    expect(screen.queryByText(fixtureSpecialist.bio)).toBeNull()
    expect(
      screen.queryByRole('button', { name: `Chọn ${slotLabel(fixtureSlot)}` }),
    ).toBeNull()
  })
  it.each([401, 403, 503])(
    'hides stale results on failed fresh read HTTP %s',
    async (status) => {
      await mount(
        api({
          list: jest
            .fn()
            .mockResolvedValueOnce(fixturePage)
            .mockRejectedValue(error(status)),
        }),
      )
      await screen.findByText(fixtureSpecialist.displayName)
      await fireEvent.press(
        screen.getByRole('button', { name: 'Tải lại danh sách' }),
      )
      await screen.findByRole('button', { name: 'Tải lại thông tin' })
      expect(screen.queryByText(fixtureSpecialist.displayName)).toBeNull()
    },
  )
  it('follows server cursor and recovers from stale cursor with first-page query', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce({ ...fixturePage, nextCursor: 'server-cursor' })
      .mockRejectedValueOnce(error(409, 'DISCOVERY_CURSOR_STALE'))
      .mockResolvedValue(fixturePage)
    await mount(api({ list }))
    await screen.findByRole('button', { name: 'Xem trang tiếp' })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem trang tiếp' }),
    )
    await screen.findByText(/Danh sách đã thay đổi/)
    expect(list).toHaveBeenLastCalledWith({}, 'server-cursor')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tìm lại từ đầu' }),
    )
    await screen.findByText(fixtureSpecialist.displayName)
    expect(list).toHaveBeenLastCalledWith({}, undefined)
  })
  it('clears selected draft on account change without a component remount', async () => {
    const mounted = await mount()
    await openProfile()
    await selectSlot()
    await screen.findByText('Khung giờ đã chọn')
    mockSession = {
      subject: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      role: 'USER',
    }
    await mounted.rerender(view(mounted.service, mounted.client))
    await screen.findByRole('button', {
      name: `Xem hồ sơ ${fixtureSpecialist.displayName}`,
    })
    expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
  })
  it('clears selection and revalidates after app background/foreground', async () => {
    const listener = jest.spyOn(AppState, 'addEventListener')
    const mounted = await mount()
    await openProfile()
    await selectSlot()
    await screen.findByText('Khung giờ đã chọn')
    const callback = listener.mock.calls.at(-1)![1]
    await act(async () => callback('background'))
    expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
    await act(async () => callback('active'))
    await screen.findByRole('button', {
      name: `Chọn ${slotLabel(fixtureSlot)}`,
    })
    expect(mounted.service.detail).toHaveBeenCalledTimes(3)
  })
  it('does not request discovery for unauthenticated or wrong-role sessions', async () => {
    mockSession = { subject: specialistId, role: 'SPECIALIST' }
    const mounted = await mount()
    expect(mounted.service.list).not.toHaveBeenCalled()
    mockSession = null
    await mounted.rerender(view(mounted.service, mounted.client))
    expect(mounted.service.list).not.toHaveBeenCalled()
  })
  it('hides the old selection after an authoritative background query changes the slot', async () => {
    const changed = {
      ...fixtureSpecialist,
      selectableSlots: [{ ...fixtureSlot, version: 1 }],
    }
    const detail = jest
      .fn()
      .mockResolvedValueOnce(fixtureSpecialist)
      .mockResolvedValueOnce(fixtureSpecialist)
      .mockResolvedValue(changed)
    const mounted = await mount(api({ detail }))
    await openProfile()
    await selectSlot()
    await screen.findByText('Khung giờ đã chọn')
    await act(async () => {
      await mounted.client.invalidateQueries({
        queryKey: ['specialist-discovery-detail'],
      })
    })
    await screen.findByRole('button', {
      name: `Chọn ${slotLabel(fixtureSlot)}`,
    })
    expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
  })
  it('ignores pending old-account slot verification after subject changes', async () => {
    let complete!: (value: DiscoveryItem) => void
    const pending = new Promise<DiscoveryItem>((resolve) => {
      complete = resolve
    })
    const detail = jest
      .fn()
      .mockResolvedValueOnce(fixtureSpecialist)
      .mockReturnValueOnce(pending)
    const mounted = await mount(api({ detail }))
    await openProfile()
    await selectSlot()
    await screen.findByText('Đang kiểm tra lại hồ sơ và khung giờ…')
    mockSession = { subject: fixtureSlot.id, role: 'USER' }
    await mounted.rerender(view(mounted.service, mounted.client))
    await act(async () => complete(fixtureSpecialist))
    await screen.findByRole('button', {
      name: `Xem hồ sơ ${fixtureSpecialist.displayName}`,
    })
    expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
  })
  it('fails closed when suspension is discovered during selection recheck', async () => {
    const detail = jest
      .fn()
      .mockResolvedValueOnce(fixtureSpecialist)
      .mockRejectedValueOnce(error(404, 'SPECIALIST_NOT_DISCOVERABLE'))
    await mount(api({ detail }))
    await openProfile()
    await selectSlot()
    await screen.findByText(/Hồ sơ hoặc khung giờ không còn khả dụng/)
    expect(screen.queryByText(fixtureSpecialist.bio)).toBeNull()
    expect(screen.queryByText('Khung giờ đã chọn')).toBeNull()
  })
})
