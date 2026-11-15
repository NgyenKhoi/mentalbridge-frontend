import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'
import type { ResourceApi } from '@/resources/resource-api'
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import type { CanonicalSupportPlan } from '@/support-plan/support-plan-action-contract'

import type { RewardApi } from './reward-api'
import { RewardCollectionScreen } from './RewardCollectionScreen'
import { achievements, bingo, bookmark, rewards } from './reward-test-fixtures'

let mockSession: AppSession | null = {
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'USER',
}
const mockSignOut = jest.fn()

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession, signOut: mockSignOut }),
}))

function api(overrides: Partial<jest.Mocked<RewardApi>> = {}) {
  return {
    getAchievements: jest
      .fn()
      .mockResolvedValue({ collection: achievements, etag: '"2"' }),
    setAchievementVisibility: jest.fn(),
    getResourceRewards: jest.fn().mockResolvedValue(rewards),
    setResourceRewardVisibility: jest.fn(),
    getBookmarks: jest.fn().mockResolvedValue([bookmark]),
    saveBookmark: jest.fn().mockResolvedValue(bookmark),
    deleteBookmark: jest.fn().mockResolvedValue(undefined),
    getBingo: jest.fn().mockResolvedValue({ board: bingo, etag: '"5"' }),
    syncBingo: jest.fn().mockResolvedValue({
      board: {
        ...bingo,
        unavailableActions: [
          {
            actionId: 'action-unavailable',
            reason: 'RESOURCE_VERSION_UNAVAILABLE',
          },
        ],
      },
      etag: '"5"',
    }),
    setBingoSelfConfirmation: jest
      .fn()
      .mockImplementation((_week, _position, selfConfirmed) =>
        Promise.resolve({
          board: {
            ...bingo,
            version: '6',
            items: bingo.items.map((item) =>
              item.position === 1
                ? {
                    ...item,
                    evidence: selfConfirmed
                      ? ('SELF_CONFIRMED' as const)
                      : ('NONE' as const),
                    selfConfirmedAt: selfConfirmed
                      ? '2026-11-03T04:00:00.000Z'
                      : null,
                  }
                : item,
            ),
          },
          etag: '"6"',
        }),
      ),
    ...overrides,
  } as jest.Mocked<RewardApi>
}

function plan(status: CanonicalSupportPlan['status'] = 'ACTIVE') {
  return {
    getCurrent: jest.fn().mockResolvedValue({ status } as CanonicalSupportPlan),
  } as Pick<SupportPlanActionApi, 'getCurrent'>
}

function resourceApi(result: string | Error | null = 'Thở chậm ba phút') {
  return {
    getResource: jest.fn().mockImplementation(() =>
      typeof result === 'string'
        ? Promise.resolve({ title: result } as Awaited<
            ReturnType<ResourceApi['getResource']>
          >)
        : result instanceof Error
          ? Promise.reject(result)
          : Promise.reject(
              new ApiError({
                message: 'gone',
                code: 'NOT_FOUND',
                status: 404,
              }),
            ),
    ),
  } as Pick<ResourceApi, 'getResource'>
}

const props = (
  owner: RewardApi,
  planOwner: Pick<SupportPlanActionApi, 'getCurrent'> = plan(),
  resources: Pick<ResourceApi, 'getResource'> = resourceApi(),
) => ({
  api: owner,
  planApi: planOwner,
  resourceApi: resources,
  onBack: jest.fn(),
  onOpenResource: jest.fn(),
  timezone: 'Asia/Ho_Chi_Minh',
  now: () => new Date('2026-11-03T03:00:00.000Z'),
})

describe('mobile owner rewards, bookmarks and plan Bingo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
  })

  it('renders only owner facts and keeps verified, self-marked and retired Bingo distinct', async () => {
    const owner = api()
    const view = await render(<RewardCollectionScreen {...props(owner)} />)

    expect(await view.findByText('Cấp 2 · 120 XP')).toBeTruthy()
    expect(view.getByText('Tài nguyên đầu tiên')).toBeTruthy()
    expect(view.getByText('Nguồn chưa thể xác minh')).toBeTruthy()
    expect(view.getAllByText('Thở chậm ba phút')).toHaveLength(2)
    expect(view.getByText('Content đã xác minh')).toBeTruthy()
    expect(view.getByText('Không còn trong kế hoạch')).toBeTruthy()
    expect(
      view.getByText(/phiên bản tài nguyên không còn khả dụng/),
    ).toBeTruthy()

    await fireEvent.press(view.getByTestId('bingo-item-1'))
    await waitFor(() =>
      expect(owner.setBingoSelfConfirmation).toHaveBeenCalledWith(
        '2026-11-02',
        1,
        true,
        '"5"',
      ),
    )
    expect(await view.findByText('Bạn đã tự đánh dấu')).toBeTruthy()
    await fireEvent.press(view.getByTestId('bingo-item-1'))
    await waitFor(() =>
      expect(owner.setBingoSelfConfirmation).toHaveBeenLastCalledWith(
        '2026-11-02',
        1,
        false,
        '"6"',
      ),
    )
    expect(await view.findByText('Chưa đánh dấu')).toBeTruthy()
    expect(view.getByTestId('bingo-item-2')).toBeDisabled()
    expect(view.getByTestId('bingo-item-3')).toBeDisabled()
  })

  it('honors hidden presentation and makes paused plan Bingo read-only', async () => {
    const hiddenAchievements = {
      ...achievements,
      visibilityState: 'HIDDEN' as const,
    }
    const hiddenRewards = {
      ...rewards,
      visibilityState: 'HIDDEN' as const,
    }
    const owner = api({
      getAchievements: jest.fn().mockResolvedValue({
        collection: hiddenAchievements,
        etag: '"3"',
      }),
      getResourceRewards: jest.fn().mockResolvedValue(hiddenRewards),
      setAchievementVisibility: jest.fn().mockResolvedValue({
        collection: achievements,
        etag: '"4"',
      }),
      setResourceRewardVisibility: jest.fn().mockResolvedValue(rewards),
    })
    const view = await render(
      <RewardCollectionScreen {...props(owner, plan('PAUSED'))} />,
    )

    expect(await view.findByText(/Bạn đã ẩn điểm và cấp độ/)).toBeTruthy()
    expect(view.getByText(/Bộ sưu tập đang được ẩn/)).toBeTruthy()
    expect(view.getByText(/Bingo chỉ đọc/)).toBeTruthy()
    expect(view.getByTestId('bingo-item-1')).toBeDisabled()

    await fireEvent.press(view.getByRole('button', { name: 'Hiện bộ sưu tập' }))
    await waitFor(() =>
      expect(owner.setAchievementVisibility).toHaveBeenCalledWith(
        'Asia/Ho_Chi_Minh',
        'VISIBLE',
        '"3"',
      ),
    )
    expect(await view.findByText('Tài nguyên đầu tiên')).toBeTruthy()
  })

  it('does not label a superseded board as the current personal plan', async () => {
    const owner = api()
    const view = await render(
      <RewardCollectionScreen {...props(owner, plan('SUPERSEDED'))} />,
    )
    expect(await view.findByText('Bảng Bingo đã lưu trước đó')).toBeTruthy()
    expect(view.getByText(/bảng đã lưu từ một kế hoạch trước đó/)).toBeTruthy()
    expect(view.getByTestId('bingo-item-1')).toBeDisabled()
    expect(owner.getBingo).toHaveBeenCalledWith('2026-11-02')
    expect(owner.syncBingo).not.toHaveBeenCalled()
  })

  it('fails closed on stale visibility and uncertain bookmark mutations', async () => {
    const owner = api({
      setAchievementVisibility: jest.fn().mockRejectedValue(
        new ApiError({
          message: 'stale',
          code: 'PRECONDITION_FAILED',
          status: 412,
        }),
      ),
      deleteBookmark: jest.fn().mockRejectedValue(new Error('lost response')),
    })
    const view = await render(<RewardCollectionScreen {...props(owner)} />)
    await view.findByText('Tài nguyên đầu tiên')

    await fireEvent.press(view.getByRole('button', { name: 'Ẩn bộ sưu tập' }))
    expect(await view.findByText(/vừa thay đổi ở thiết bị khác/)).toBeTruthy()

    await fireEvent.press(view.getByRole('button', { name: 'Bỏ lưu' }))
    expect(await view.findByText(/Chưa thể tải tài nguyên đã lưu/)).toBeTruthy()
    expect(
      within(view.getByTestId('reward-bookmarks')).queryByText(
        'Thở chậm ba phút',
      ),
    ).toBeNull()
  })

  it('shows a deleted bookmark source as unavailable instead of inventing content', async () => {
    const view = await render(
      <RewardCollectionScreen {...props(api(), plan(), resourceApi(null))} />,
    )
    expect(
      await view.findByText('Tài nguyên đã lưu không còn khả dụng'),
    ).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Mở tài nguyên' })).toBeNull()
    expect(view.getByRole('button', { name: 'Bỏ lưu' })).toBeTruthy()
  })

  it('keeps an uncertain bookmark lookup distinct from an authoritative deletion and retries it', async () => {
    const unavailable = new ApiError({
      message: 'provider unavailable',
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
    })
    const resources = resourceApi(unavailable)
    jest
      .mocked(resources.getResource)
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce({ title: 'Tài nguyên đã phục hồi' } as Awaited<
        ReturnType<ResourceApi['getResource']>
      >)
    const view = await render(
      <RewardCollectionScreen {...props(api(), plan(), resources)} />,
    )

    expect(
      await view.findByText('Chưa thể kiểm tra tài nguyên đã lưu này'),
    ).toBeTruthy()
    expect(view.queryByText('Tài nguyên đã lưu không còn khả dụng')).toBeNull()
    await fireEvent.press(
      view.getByRole('button', { name: 'Thử tải lại tài nguyên' }),
    )
    expect(await view.findByText('Tài nguyên đã phục hồi')).toBeTruthy()
  })

  it('presents a board as historical when no current plan exists', async () => {
    const noCurrentPlan = {
      getCurrent: jest.fn().mockRejectedValue(
        new ApiError({
          message: 'no current plan',
          code: 'NOT_FOUND',
          status: 404,
        }),
      ),
    }
    const owner = api()
    const view = await render(
      <RewardCollectionScreen {...props(owner, noCurrentPlan)} />,
    )

    expect(await view.findByText('Bảng Bingo đã lưu trước đó')).toBeTruthy()
    expect(view.getByText(/không coi đây là kế hoạch hiện tại/)).toBeTruthy()
    expect(view.getByTestId('bingo-item-1')).toBeDisabled()
    expect(owner.getBingo).toHaveBeenCalledWith('2026-11-02')
    expect(owner.syncBingo).not.toHaveBeenCalled()
  })

  it('keeps the old snapshot visibly read-only while focus refreshes changed facts and plan state', async () => {
    let resolveRewards: ((value: typeof rewards) => void) | undefined
    const nextRewards = { ...rewards, level: 3, totalXp: 250 }
    const owner = api({
      getResourceRewards: jest
        .fn()
        .mockResolvedValueOnce(rewards)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRewards = resolve
            }),
        ),
    })
    const planOwner = {
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce({ status: 'ACTIVE' } as CanonicalSupportPlan)
        .mockResolvedValueOnce({ status: 'PAUSED' } as CanonicalSupportPlan),
    }
    const resources = resourceApi()
    const baseProps = props(owner, planOwner, resources)
    const view = await render(
      <RewardCollectionScreen {...baseProps} refreshToken={0} />,
    )
    await view.findByText('Cấp 2 · 120 XP')

    await view.rerender(
      <RewardCollectionScreen {...baseProps} refreshToken={1} />,
    )
    expect(await view.findByText(/Đang xác nhận dữ liệu mới nhất/)).toBeTruthy()
    expect(view.getByText('Cấp 2 · 120 XP')).toBeTruthy()
    expect(
      view.getByRole('button', { name: 'Đang làm mới dữ liệu…' }),
    ).toBeDisabled()

    await act(async () => resolveRewards?.(nextRewards))
    expect(await view.findByText('Cấp 3 · 250 XP')).toBeTruthy()
    expect(view.getByText(/Bingo chỉ đọc/)).toBeTruthy()
    expect(view.getByTestId('bingo-item-1')).toBeDisabled()
    expect(owner.getResourceRewards).toHaveBeenCalledTimes(2)
  })

  it('clears the old account snapshot and reloads every owner source on account switch', async () => {
    const owner = api()
    const view = await render(<RewardCollectionScreen {...props(owner)} />)
    await view.findByText('Cấp 2 · 120 XP')

    mockSession = {
      subject: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'USER',
    }
    await view.rerender(<RewardCollectionScreen {...props(owner)} />)
    await waitFor(() => expect(owner.getAchievements).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(owner.getBookmarks).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Cấp 2 · 120 XP')).toBeTruthy()
  })
})
