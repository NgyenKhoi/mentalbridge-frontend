import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { CommunitySocialApi } from './community-social-api'
import { CommunityGroupsScreen } from './CommunityGroupsScreen'
import {
  circle,
  circleId,
  friendship,
  peerId,
} from './community-social-fixtures'

const page = <T,>(items: T[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
})
function api(overrides: Partial<CommunitySocialApi> = {}): CommunitySocialApi {
  return {
    circles: jest.fn(async () => page([circle()])),
    friends: jest.fn(async () => page([friendship('FRIENDS')])),
    decide: jest.fn().mockResolvedValue(undefined),
    createCircle: jest.fn(async () => circle({ role: 'OWNER' })),
    ...overrides,
  } as unknown as CommunitySocialApi
}
async function mount(social: CommunitySocialApi) {
  const props = {
    api: social,
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    onBack: jest.fn(),
    onOpenCircle: jest.fn(),
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <CommunityGroupsScreen {...props} />
    </QueryClientProvider>,
  )
  return props
}
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }))

describe('CommunityGroupsScreen', () => {
  it('lists joined groups with role and member count and opens one', async () => {
    const props = await mount(api())
    await screen.findByText('Buổi sáng dịu nhẹ')
    expect(screen.getByText('Thành viên · 3 thành viên')).toBeOnTheScreen()
    await press('Mở nhóm Buổi sáng dịu nhẹ')
    expect(props.onOpenCircle).toHaveBeenCalledWith(circleId)
  })

  it('shows invitations as cards and joins or declines through the decision endpoint', async () => {
    const social = api({
      circles: jest.fn(async () =>
        page([circle({ membership: 'PENDING', description: '' })]),
      ),
    })
    const props = await mount(social)
    await screen.findByText('Lời mời tham gia (1)')
    expect(
      screen.getByText('Bạn được mời tham gia nhóm cộng đồng riêng.'),
    ).toBeOnTheScreen()
    await press('Từ chối lời mời vào nhóm Buổi sáng dịu nhẹ')
    await waitFor(() =>
      expect(social.decide).toHaveBeenCalledWith(circleId, 'DECLINE'),
    )
    expect(props.onOpenCircle).not.toHaveBeenCalled()
    await press('Tham gia nhóm Buổi sáng dịu nhẹ')
    await waitFor(() =>
      expect(social.decide).toHaveBeenCalledWith(circleId, 'ACCEPT'),
    )
    await waitFor(() =>
      expect(props.onOpenCircle).toHaveBeenCalledWith(circleId),
    )
  })

  it('shows an empty state with a create action', async () => {
    await mount(api({ circles: jest.fn(async () => page([])) }))
    await screen.findByText('Một nơi để cùng chia sẻ')
    await press('Tạo nhóm')
    await screen.findByRole('header', { name: 'Tạo nhóm cộng đồng riêng' })
  })

  it('shows a skeleton, then an honest unavailable card when the feature is off', async () => {
    const circles = jest
      .fn()
      .mockRejectedValue(new ApiError({ code: 'X', message: 'x', status: 503 }))
    const props = await mount(api({ circles }))
    expect(
      screen.getByRole('progressbar', { name: 'Đang tải nhóm…' }),
    ).toBeOnTheScreen()
    await screen.findByText('Nhóm cộng đồng hiện chưa khả dụng')
    expect(screen.queryByRole('button', { name: 'Tạo nhóm riêng' })).toBeNull()
    await press('Quay lại')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('retries a failed list', async () => {
    const circles = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'X', message: 'x', status: 500 }),
      )
      .mockResolvedValue(page([circle()]))
    await mount(api({ circles }))
    await screen.findByText('Chưa tải được nhóm.')
    await press('Thử lại')
    await screen.findByText('Buổi sáng dịu nhẹ')
  })

  it('pages groups with "Xem thêm nhóm"', async () => {
    const circles = jest
      .fn()
      .mockResolvedValueOnce(page([circle()], peerId))
      .mockResolvedValue(page([circle({ id: peerId, name: 'Nhóm đọc sách' })]))
    await mount(api({ circles }))
    await screen.findByText('Buổi sáng dịu nhẹ')
    await press('Xem thêm nhóm')
    await screen.findByText('Nhóm đọc sách')
    expect(circles).toHaveBeenLastCalledWith(peerId)
  })

  it('creates a group with a name, a description and invited friends, then opens it', async () => {
    const social = api()
    const props = await mount(social)
    await screen.findByText('Buổi sáng dịu nhẹ')
    await press('Tạo nhóm riêng')
    await screen.findByText('Một bảng tin dành cho những người bạn chọn.')
    expect(
      screen.getByRole('button', { name: 'Tạo nhóm riêng' }),
    ).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText('Tên nhóm'), ' Cuối tuần ')
    await fireEvent.changeText(
      screen.getByLabelText('Giới thiệu nhóm'),
      'Chuyện nhỏ',
    )
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: 'Minh An' }),
    )
    expect(screen.getByText('Mời bạn bè 1/19')).toBeOnTheScreen()
    await press('Tạo nhóm riêng')
    await waitFor(() =>
      expect(social.createCircle).toHaveBeenCalledWith(
        { name: 'Cuối tuần', description: 'Chuyện nhỏ', invitees: [peerId] },
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    await waitFor(() =>
      expect(props.onOpenCircle).toHaveBeenCalledWith(circleId),
    )
  })

  it('keeps the form and shows the error when creating fails', async () => {
    const social = api({
      createCircle: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'X', message: 'x', status: 429 }),
        ),
      friends: jest.fn(async () => page([])),
    })
    await mount(social)
    await screen.findByText('Buổi sáng dịu nhẹ')
    await press('Tạo nhóm riêng')
    await screen.findByText('Bạn có thể tạo nhóm trước và mời bạn bè sau.')
    await fireEvent.changeText(screen.getByLabelText('Tên nhóm'), 'Nhóm mới')
    await press('Tạo nhóm riêng')
    await screen.findByText(/Chưa thể xác nhận yêu cầu lúc này/)
    expect(screen.getByLabelText('Tên nhóm').props.value).toBe('Nhóm mới')
    await press('Đóng tạo nhóm')
    await screen.findByText('Buổi sáng dịu nhẹ')
  })
})
