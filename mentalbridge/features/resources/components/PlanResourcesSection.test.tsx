import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { PlanAccessStatus } from '@/features/support-plan-access/plan-access'
import * as resourceExperience from '../model/resource-experience'
import { PlanResourcesSection } from './PlanResourcesSection'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  sync: vi.fn(),
  toggle: vi.fn(),
  retryAccess: vi.fn(),
  access: 'paid' as PlanAccessStatus,
}))
vi.mock('@/features/support-plan-access/use-plan-access', () => ({
  usePlanAccess: () => ({
    access: { status: api.access },
    retry: api.retryAccess,
  }),
}))
vi.mock('@/features/support-plan/api/browser-support-plan-actions', () => ({
  getCurrentPlanResourceActions: api.get,
}))
vi.mock('../api/browser-resource-engagement', () => ({
  syncResourceBingoWithPlan: api.sync,
  setResourceBingoSelfConfirmation: api.toggle,
}))

const action = {
  actionId: 'action-1',
  actionVersion: 2,
  title: 'Thở chậm',
  resource: {
    resourceId: 'resource-1',
    resourceVersion: '7',
    publicationId: 'pub-1',
  },
  schedule: null,
  today: {
    occurrenceId: 'occurrence-1',
    occurrenceVersion: 3,
    displayState: 'SCHEDULED',
  },
}
const plan = {
  planState: 'ACTIVE',
  localDate: '2026-10-21',
  timeZone: 'Asia/Bangkok',
  actions: [action],
}
const tile = {
  position: 1,
  resourceId: 'resource-1',
  actionId: 'action-1',
  contentVersion: '7',
  label: 'Thở chậm',
  evidence: 'NONE',
  selfConfirmedAt: null,
  retired: false,
}
const board = {
  weekStart: '2026-10-19',
  timeZone: 'Asia/Bangkok',
  version: '0',
  items: [tile],
  unavailableActions: [],
}

describe('My Plan resources boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T05:00:00Z'))
    vi.clearAllMocks()
    api.access = 'paid'
    api.get.mockResolvedValue(plan)
    api.sync.mockResolvedValue({ board, etag: '"0"' })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  it.each(['free', 'expired', 'unavailable'] as const)(
    'gates %s before any plan or board request',
    async (access) => {
      api.access = access
      render(<PlanResourcesSection />)
      expect(
        await screen.findByText(
          access === 'unavailable'
            ? 'Chưa kiểm tra được kế hoạch của bạn lúc này.'
            : 'Kế hoạch hỗ trợ chưa được mở với tài khoản của bạn.',
          { ignore: '[role="status"]' },
        ),
      ).toBeVisible()
      expect(api.get).not.toHaveBeenCalled()
      expect(api.sync).not.toHaveBeenCalled()
    },
  )
  it('has two stable skeletons while access is loading', () => {
    api.access = 'loading'
    render(<PlanResourcesSection />)
    const loading = screen.getByLabelText('Đang tải tài nguyên kế hoạch')
    expect(loading.children).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…')
    expect(api.get).not.toHaveBeenCalled()
  })
  it('opens the exact version without completing anything', async () => {
    render(<PlanResourcesSection />)
    const link = await screen.findByRole('link', { name: 'Mở tài nguyên' })
    expect(link).toHaveAttribute(
      'href',
      '/resources/resource-1?from=support-plan&contentVersion=7&actionId=action-1&localDate=2026-10-21&occurrenceId=occurrence-1',
    )
    expect(link).toHaveAccessibleDescription(action.title)
    expect(
      screen.getByRole('link', { name: 'Xem trong kế hoạch' }),
    ).toHaveAccessibleDescription(action.title)
    expect(api.toggle).not.toHaveBeenCalled()
  })
  it('uses the plan Monday when the browser is still on Sunday', async () => {
    vi.setSystemTime(new Date('2026-10-19T01:00:00Z'))
    vi.spyOn(resourceExperience, 'localDate').mockReturnValue('2026-10-18')
    api.get
      .mockResolvedValueOnce({
        ...plan,
        localDate: '2026-10-18',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      .mockResolvedValueOnce({
        ...plan,
        localDate: '2026-10-19',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    render(<PlanResourcesSection />)
    const link = await screen.findByRole('link', { name: 'Mở tài nguyên' })
    expect(api.get).toHaveBeenNthCalledWith(1, '2026-10-18')
    expect(api.get).toHaveBeenNthCalledWith(2, '2026-10-19')
    expect(api.sync).toHaveBeenCalledWith('2026-10-19', 'Asia/Ho_Chi_Minh')
    expect(link).toHaveAttribute(
      'href',
      '/resources/resource-1?from=support-plan&contentVersion=7&actionId=action-1&localDate=2026-10-19&occurrenceId=occurrence-1',
    )
  })
  it('keeps paused cards openable and Bingo read only', async () => {
    api.get.mockResolvedValue({ ...plan, planState: 'PAUSED' })
    render(<PlanResourcesSection />)
    expect(
      await screen.findByText(/Kế hoạch đang tạm dừng/, {
        ignore: '[role="status"]',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Mở tài nguyên' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Tự đánh dấu/ }),
    ).not.toBeInTheDocument()
  })
  it('syncs NONE to retire history but hides its tiles', async () => {
    api.get.mockResolvedValue({ ...plan, planState: 'NONE', actions: [] })
    render(<PlanResourcesSection />)
    expect(
      await screen.findByText('Bạn chưa có kế hoạch hỗ trợ.', {
        ignore: '[role="status"]',
      }),
    ).toBeVisible()
    expect(api.sync).toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: /Bingo hoạt động/ }),
    ).not.toBeInTheDocument()
  })
  it('does not mistake BOARD_FULL for an unavailable resource', async () => {
    api.sync.mockResolvedValue({
      board: {
        ...board,
        unavailableActions: [
          { actionId: action.actionId, reason: 'BOARD_FULL' },
        ],
      },
      etag: '"0"',
    })
    render(<PlanResourcesSection />)
    expect(
      await screen.findByRole('link', { name: 'Mở tài nguyên' }),
    ).toBeVisible()
  })
  it('does not offer an unpublished version', async () => {
    api.sync.mockResolvedValue({
      board: {
        ...board,
        items: [],
        unavailableActions: [
          { actionId: action.actionId, reason: 'RESOURCE_VERSION_UNAVAILABLE' },
        ],
      },
      etag: '"0"',
    })
    render(<PlanResourcesSection />)
    expect(
      await screen.findByText('Tài nguyên này hiện không còn khả dụng.'),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Mở tài nguyên' }),
    ).not.toBeInTheDocument()
  })
  it('separates self-confirmation from Care and hides stale state after 412', async () => {
    const user = userEvent.setup()
    api.toggle
      .mockResolvedValueOnce({
        board: {
          ...board,
          items: [
            {
              ...tile,
              evidence: 'SELF_CONFIRMED',
              selfConfirmedAt: '2026-10-21T02:00:00Z',
            },
          ],
        },
        etag: '"1"',
      })
      .mockRejectedValueOnce(
        new ApiError({ message: 'stale', code: 'STALE_VERSION', status: 412 }),
      )
    render(<PlanResourcesSection />)
    await user.click(
      await screen.findByRole('button', { name: 'Tự đánh dấu Thở chậm' }),
    )
    expect(api.toggle).toHaveBeenLastCalledWith('2026-10-19', 1, true, '"0"')
    expect(await screen.findByText('Bạn đã đánh dấu')).toBeVisible()
    const card = screen.getByRole('article')
    expect(within(card).getByText('Chưa làm')).toBeVisible()
    const toggle = screen.getByRole('button', { name: 'Tự đánh dấu Thở chậm' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list')).queryByText('Chưa làm')).toBeNull()
    await user.click(toggle)
    expect(
      await screen.findByText('Kế hoạch vừa thay đổi.', {
        ignore: '[role="status"]',
      }),
    ).toBeVisible()
    expect(screen.queryByText('Bạn đã đánh dấu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeVisible()
  })
  it('keeps the board and previous check on save failure, focuses retry, and retries only the save', async () => {
    const user = userEvent.setup()
    api.toggle
      .mockRejectedValueOnce(
        new ApiError({ message: 'offline', code: 'UNAVAILABLE', status: 503 }),
      )
      .mockResolvedValueOnce({
        board: {
          ...board,
          items: [
            {
              ...tile,
              evidence: 'SELF_CONFIRMED',
              selfConfirmedAt: '2026-10-21T05:00:00Z',
            },
          ],
        },
        etag: '"1"',
      })
    render(<PlanResourcesSection />)
    const toggle = await screen.findByRole('button', {
      name: 'Tự đánh dấu Thở chậm',
    })
    await user.click(toggle)
    const error = await screen.findByRole('alert')
    const retry = within(error).getByRole('button', { name: 'Thử lại' })
    expect(error).toHaveTextContent('Chưa lưu được đánh dấu của bạn.')
    expect(retry).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('listitem')).toContainElement(toggle)
    expect(screen.getByRole('link', { name: 'Mở tài nguyên' })).toBeVisible()
    expect(
      screen.queryByText(
        'Chưa tải được kế hoạch của bạn. Danh mục bên dưới vẫn dùng được.',
      ),
    ).toBeNull()
    await user.click(retry)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.toggle).toHaveBeenNthCalledWith(2, '2026-10-19', 1, true, '"0"')
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.sync).toHaveBeenCalledTimes(1)
  })
  it('keeps toggle focus and its fixed label while the persistent live region announces saving', async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => undefined
    api.toggle.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<PlanResourcesSection />)
    const liveRegion = screen.getByRole('status')
    const toggle = await screen.findByRole('button', {
      name: 'Tự đánh dấu Thở chậm',
    })
    await user.click(toggle)
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(toggle).not.toBeDisabled()
    expect(liveRegion).toHaveTextContent('Đang lưu đánh dấu…')
    expect(screen.getByRole('status')).toBe(liveRegion)
    await user.click(toggle)
    expect(api.toggle).toHaveBeenCalledTimes(1)
    await act(async () =>
      finish({
        board: {
          ...board,
          items: [
            {
              ...tile,
              evidence: 'SELF_CONFIRMED',
              selfConfirmedAt: '2026-10-21T05:00:00Z',
            },
          ],
        },
        etag: '"1"',
      }),
    )
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-disabled', 'false')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAccessibleName('Tự đánh dấu Thở chậm')
  })
  it('publishes the loaded plan projection and clears it when access is unavailable', async () => {
    const onPlanChange = vi.fn()
    const { rerender } = render(
      <PlanResourcesSection onPlanChange={onPlanChange} />,
    )
    await waitFor(() => expect(onPlanChange).toHaveBeenLastCalledWith(plan))
    api.access = 'unavailable'
    rerender(<PlanResourcesSection onPlanChange={onPlanChange} />)
    await waitFor(() => expect(onPlanChange).toHaveBeenLastCalledWith(null))
  })
  it('keeps a failed plan load local to the section', async () => {
    api.sync.mockRejectedValue(
      new ApiError({ message: 'offline', code: 'UNAVAILABLE', status: 503 }),
    )
    render(<PlanResourcesSection />)
    expect(
      await screen.findByText(
        'Chưa tải được kế hoạch của bạn. Danh mục bên dưới vẫn dùng được.',
        { ignore: '[role="status"]' },
      ),
    ).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
  it('reveals all cards in plan order and never toggles retired tiles', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({
      ...plan,
      actions: Array.from({ length: 5 }, (_, index) => ({
        ...action,
        actionId: `action-${index}`,
        title: `Hoạt động ${index}`,
      })),
    })
    api.sync.mockResolvedValue({
      board: { ...board, items: [{ ...tile, retired: true }] },
      etag: '"0"',
    })
    render(<PlanResourcesSection />)
    await screen.findByText('Hoạt động 0')
    expect(screen.queryByText('Hoạt động 3')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xem tất cả \(5\)/ }))
    await waitFor(() => expect(screen.getByText('Hoạt động 4')).toBeVisible())
    expect(
      screen
        .getAllByRole('article')
        .map((element) => within(element).getByRole('heading').textContent),
    ).toEqual(Array.from({ length: 5 }, (_, index) => `Hoạt động ${index}`))
    expect(screen.getByText('Không còn trong kế hoạch')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Tự đánh dấu/ }),
    ).not.toBeInTheDocument()
  })
})
