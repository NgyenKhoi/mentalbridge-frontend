import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Linking } from 'react-native'

import { ApiError } from '@/api/api-error'

import type { SupportPlanApi } from './support-plan-api'
import { SupportPlanScreen } from './SupportPlanScreen'
import {
  makeOccurrence,
  makeOccurrenceList,
  makePlan,
  makePlanChangeRequest,
  makeReassessmentSummary,
} from './support-plan-test-fixtures'

const mockBack = jest.fn()
const mockPush = jest.fn()
const mockSignOut = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    push: (path: string) => mockPush(path),
  },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: 'user-1', role: 'USER' },
    signOut: mockSignOut,
  }),
}))

function missing(code: string) {
  return new ApiError({ message: 'missing', code, status: 404 })
}

function makeApi(
  overrides: Partial<jest.Mocked<SupportPlanApi>> = {},
): jest.Mocked<SupportPlanApi> {
  return {
    getCurrent: jest.fn().mockRejectedValue(missing('SUPPORT_PLAN_NOT_FOUND')),
    getCurrentDraft: jest
      .fn()
      .mockRejectedValue(missing('SUPPORT_PLAN_DRAFT_NOT_FOUND')),
    getHistory: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    }),
    replaceChoices: jest.fn(),
    activate: jest.fn(),
    changeStatus: jest.fn(),
    getOccurrences: jest.fn().mockResolvedValue(makeOccurrenceList([])),
    replaceOccurrenceEngagement: jest.fn(),
    getPlanChangeRequest: jest.fn(),
    reviewPlanChangeRequest: jest.fn(),
    decidePlanChangeRequest: jest.fn(),
    reviewReplacement: jest.fn(),
    replaceCurrent: jest.fn(),
    ...overrides,
  }
}

async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 30_000 },
      mutations: { gcTime: Infinity, retry: false },
    },
  })
  return await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe('mobile SupportPlan journey', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the source-empty state without inventing a local plan', async () => {
    const api = makeApi()
    await renderScreen(<SupportPlanScreen api={api} />)

    expect(await screen.findByText('Chưa có kế hoạch hỗ trợ')).toBeTruthy()
    expect(api.activate).not.toHaveBeenCalled()
    expect(api.changeStatus).not.toHaveBeenCalled()
  })

  it('keeps one activation command across an ambiguous retry', async () => {
    const draft = makePlan('DRAFT')
    const active = makePlan('ACTIVE')
    const api = makeApi({
      getCurrentDraft: jest.fn().mockResolvedValue(draft),
      activate: jest
        .fn()
        .mockRejectedValueOnce(
          new ApiError({ message: 'timeout', code: 'REQUEST_TIMEOUT' }),
        )
        .mockResolvedValueOnce(active),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    const activate = await screen.findByRole('button', {
      name: 'Bắt đầu kế hoạch',
    })
    await fireEvent.press(activate)
    expect(
      await screen.findByText(/Không có thay đổi nào được xác nhận/),
    ).toBeTruthy()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    )

    await waitFor(() => expect(api.activate).toHaveBeenCalledTimes(2))
    expect(api.activate.mock.calls[0]?.[1]).toBe(
      api.activate.mock.calls[1]?.[1],
    )
  })

  it('sends a complete server-admitted selection and opening a resource does not mutate the plan', async () => {
    const draft = makePlan('DRAFT')
    const saved = makePlan('DRAFT', {
      version: 4,
      slots: [
        {
          ...draft.slots[0]!,
          selectedResource: draft.slots[0]!.allowedAlternatives[1]!,
        },
      ],
    })
    const api = makeApi({
      getCurrentDraft: jest.fn().mockResolvedValue(draft),
      replaceChoices: jest.fn().mockResolvedValue(saved),
    })
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    await renderScreen(<SupportPlanScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Mở Thở chậm trong 3 phút',
      }),
    )
    expect(openUrl).toHaveBeenCalledWith(
      'https://example.test/resources/breathing',
    )
    expect(api.activate).not.toHaveBeenCalled()
    expect(api.changeStatus).not.toHaveBeenCalled()

    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Thư giãn có hướng dẫn' }),
    )
    await waitFor(() =>
      expect(api.replaceChoices).toHaveBeenCalledWith(draft, [
        expect.objectContaining({
          slotId: 'breathing-core',
          resourceId: draft.slots[0]!.allowedAlternatives[1]!.resourceId,
          contentVersion: '2',
        }),
      ]),
    )

    openUrl.mockRestore()
  })

  it('uses the governed replacement action instead of activating a draft over a current plan', async () => {
    const current = makePlan('ACTIVE')
    const draft = makePlan('DRAFT')
    const replaced = makePlan('ACTIVE', {
      supportPlanId: draft.supportPlanId,
      version: 4,
    })
    const review = {
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE' as const,
      rationaleCodes: [
        'CURRENT_PLAN_ADMISSIBLE' as const,
        'PROPOSED_PLAN_ADMISSIBLE' as const,
      ],
      currentPlan: current,
      proposedPlan: draft,
      comparison: [
        {
          change: 'UNCHANGED' as const,
          currentSlotId: current.slots[0]!.slotId,
          currentResource: current.slots[0]!.selectedResource,
          proposedSlotId: draft.slots[0]!.slotId,
          proposedResource: draft.slots[0]!.selectedResource,
        },
      ],
      reassessmentSummary: makeReassessmentSummary(),
      reviewedAt: '2026-10-07T02:00:00.000Z',
    }
    const api = makeApi({
      getCurrent: jest.fn().mockResolvedValue(current),
      getCurrentDraft: jest.fn().mockResolvedValue(draft),
      reviewReplacement: jest.fn().mockResolvedValue(review),
      replaceCurrent: jest.fn().mockResolvedValue(replaced),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    expect(
      await screen.findByRole('button', { name: 'Dùng phương án mới' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Dùng phương án mới' }),
    )
    await waitFor(() =>
      expect(api.replaceCurrent).toHaveBeenCalledWith(
        current,
        draft,
        review,
        expect.any(String),
      ),
    )
    expect(api.activate).not.toHaveBeenCalled()
  })

  it('does not reuse fresh occurrences from a replaced current plan', async () => {
    const current = makePlan('ACTIVE')
    const draft = makePlan('DRAFT')
    const replaced = makePlan('ACTIVE', {
      supportPlanId: draft.supportPlanId,
      version: 4,
    })
    const oldOccurrence = makeOccurrence({
      source: {
        ...makeOccurrence().source,
        title: 'Hoạt động của kế hoạch cũ',
      },
    })
    const newOccurrence = makeOccurrence({
      occurrenceId: '50000000-0000-4000-8000-000000000099',
      supportPlanId: replaced.supportPlanId,
      version: 1,
      source: {
        ...makeOccurrence().source,
        supportPlanVersion: replaced.version,
        title: 'Hoạt động của kế hoạch mới',
      },
    })
    const review = {
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE' as const,
      rationaleCodes: [
        'CURRENT_PLAN_ADMISSIBLE' as const,
        'PROPOSED_PLAN_ADMISSIBLE' as const,
      ],
      currentPlan: current,
      proposedPlan: draft,
      comparison: [
        {
          change: 'UNCHANGED' as const,
          currentSlotId: current.slots[0]!.slotId,
          currentResource: current.slots[0]!.selectedResource,
          proposedSlotId: draft.slots[0]!.slotId,
          proposedResource: draft.slots[0]!.selectedResource,
        },
      ],
      reassessmentSummary: makeReassessmentSummary(),
      reviewedAt: '2026-10-07T02:00:00.000Z',
    }
    const api = makeApi({
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(replaced),
      getCurrentDraft: jest
        .fn()
        .mockResolvedValueOnce(draft)
        .mockRejectedValueOnce(missing('SUPPORT_PLAN_DRAFT_NOT_FOUND')),
      getOccurrences: jest
        .fn()
        .mockResolvedValueOnce(makeOccurrenceList([oldOccurrence]))
        .mockResolvedValueOnce({
          ...makeOccurrenceList([newOccurrence]),
          supportPlanId: replaced.supportPlanId,
          occurrences: [newOccurrence],
        }),
      reviewReplacement: jest.fn().mockResolvedValue(review),
      replaceCurrent: jest.fn().mockResolvedValue(replaced),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    expect(await screen.findByText('Hoạt động của kế hoạch cũ')).toBeTruthy()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Dùng phương án mới' }),
    )

    expect(await screen.findByText('Hoạt động của kế hoạch mới')).toBeTruthy()
    expect(screen.queryByText('Hoạt động của kế hoạch cũ')).toBeNull()
    expect(api.getOccurrences).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole('button', { name: 'Đã hoàn thành' }),
    ).not.toBeDisabled()
  })

  it('fails closed when occurrence authority does not match the current plan', async () => {
    const current = makePlan('ACTIVE')
    const wrongPlanOccurrence = makeOccurrence({
      supportPlanId: '10000000-0000-4000-8000-000000000099',
    })
    const api = makeApi({
      getCurrent: jest.fn().mockResolvedValue(current),
      getOccurrences: jest.fn().mockResolvedValue({
        ...makeOccurrenceList([wrongPlanOccurrence]),
        supportPlanId: wrongPlanOccurrence.supportPlanId,
        occurrences: [wrongPlanOccurrence],
      }),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    expect(
      await screen.findByText(/Hoạt động vừa thay đổi theo kế hoạch mới/),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đã hoàn thành' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Tạm dừng kế hoạch' }),
    ).toBeDisabled()
    expect(api.replaceOccurrenceEngagement).not.toHaveBeenCalled()
  })

  it('shows only server-valid lifecycle actions for active, paused and completed states', async () => {
    const paused = makePlan('PAUSED')
    const api = makeApi({ getCurrent: jest.fn().mockResolvedValue(paused) })
    const rendered = await renderScreen(<SupportPlanScreen api={api} />)

    expect(
      await screen.findByRole('button', { name: 'Tiếp tục kế hoạch' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Tạm dừng kế hoạch' }),
    ).toBeNull()

    await rendered.unmount()
    const completedApi = makeApi({
      getHistory: jest.fn().mockResolvedValue({
        items: [makePlan('COMPLETED')],
        nextCursor: null,
        hasMore: false,
      }),
    })
    await renderScreen(<SupportPlanScreen api={completedApi} />)
    expect(await screen.findByText('Đã kết thúc')).toBeTruthy()
  })

  it('keeps persisted occurrences read-only while the authoritative plan is paused', async () => {
    const paused = makePlan('PAUSED')
    const scheduled = makeOccurrence()
    const completed = makeOccurrence({
      occurrenceId: '50000000-0000-4000-8000-000000000002',
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      completedAt: '2026-10-07T02:05:00.000Z',
    })
    const api = makeApi({
      getCurrent: jest.fn().mockResolvedValue(paused),
      getOccurrences: jest
        .fn()
        .mockResolvedValue(makeOccurrenceList([scheduled, completed])),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    expect(
      await screen.findAllByText(
        'Tiếp tục kế hoạch để ghi nhận hoạt động này.',
      ),
    ).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Đã hoàn thành' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bỏ qua lần này' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Mở lại hoạt động' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hữu ích' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lưu ghi chú' })).toBeNull()
    expect(
      screen.queryByLabelText(`Ghi chú cho ${completed.source.title}`),
    ).toBeNull()
    expect(api.replaceOccurrenceEngagement).not.toHaveBeenCalled()
  })

  it('records occurrence completion and helpfulness without creating a score', async () => {
    const current = makePlan('ACTIVE')
    const scheduled = makeOccurrence()
    const completed = makeOccurrence({
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 3,
      completedAt: '2026-10-07T02:05:00.000Z',
    })
    const helpful = makeOccurrence({
      ...completed,
      version: 4,
      helpfulness: 'HELPFUL',
    })
    const api = makeApi({
      getCurrent: jest.fn().mockResolvedValue(current),
      getOccurrences: jest
        .fn()
        .mockResolvedValue(makeOccurrenceList([scheduled])),
      replaceOccurrenceEngagement: jest
        .fn()
        .mockResolvedValueOnce(completed)
        .mockResolvedValueOnce(helpful),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Đã hoàn thành' }),
    )
    expect(
      await screen.findByText('Đã lưu ghi nhận cho hoạt động.'),
    ).toBeTruthy()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Hữu ích' }),
    )

    await waitFor(() =>
      expect(api.replaceOccurrenceEngagement).toHaveBeenLastCalledWith(
        expect.objectContaining({ version: 3 }),
        expect.objectContaining({
          state: 'COMPLETED',
          helpfulness: 'HELPFUL',
        }),
      ),
    )
    expect(screen.queryByText(/điểm tuân thủ/i)).toBeTruthy()
  })

  it('keeps commands locked after a successful pause until refreshed authority resolves', async () => {
    const active = makePlan('ACTIVE')
    const paused = makePlan('PAUSED', { version: 4 })
    const scheduled = makeOccurrence()
    let resolveRefresh: (plan: typeof paused) => void = () => undefined
    const pendingRefresh = new Promise<typeof paused>((resolve) => {
      resolveRefresh = resolve
    })
    const api = makeApi({
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce(active)
        .mockReturnValueOnce(pendingRefresh),
      getOccurrences: jest
        .fn()
        .mockResolvedValue(makeOccurrenceList([scheduled])),
      changeStatus: jest.fn().mockResolvedValue(paused),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    const complete = await screen.findByRole('button', {
      name: 'Đã hoàn thành',
    })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạm dừng kế hoạch' }),
    )

    expect(
      await screen.findByText('Đang tải lại trạng thái có thẩm quyền…'),
    ).toBeTruthy()
    const stalePause = screen.getByRole('button', {
      name: 'Tạm dừng kế hoạch',
    })
    expect(stalePause).toBeDisabled()
    expect(complete).toBeDisabled()
    await fireEvent.press(stalePause)
    await fireEvent.press(complete)
    expect(api.changeStatus).toHaveBeenCalledTimes(1)
    expect(api.replaceOccurrenceEngagement).not.toHaveBeenCalled()

    await act(async () => resolveRefresh(paused))

    expect(
      await screen.findByRole('button', { name: 'Tiếp tục kế hoạch' }),
    ).not.toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Tạm dừng kế hoạch' }),
    ).toBeNull()
    expect(
      await screen.findByText('Tiếp tục kế hoạch để ghi nhận hoạt động này.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đã hoàn thành' })).toBeNull()
  })

  it('stays fail-closed when authority refresh fails after a successful lifecycle command', async () => {
    const active = makePlan('ACTIVE')
    const paused = makePlan('PAUSED', { version: 4 })
    const api = makeApi({
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce(active)
        .mockRejectedValueOnce(
          new ApiError({
            message: 'offline',
            code: 'CARE_UNAVAILABLE',
            status: 503,
          }),
        )
        .mockResolvedValueOnce(paused),
      getOccurrences: jest.fn().mockResolvedValue(makeOccurrenceList([])),
      changeStatus: jest.fn().mockResolvedValue(paused),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Tạm dừng kế hoạch' }),
    )

    expect(await screen.findByText(/Các thay đổi đang bị khóa/)).toBeTruthy()
    const stalePause = screen.getByRole('button', {
      name: 'Tạm dừng kế hoạch',
    })
    expect(stalePause).toBeDisabled()
    await fireEvent.press(stalePause)
    expect(api.changeStatus).toHaveBeenCalledTimes(1)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lại trạng thái an toàn' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Tiếp tục kế hoạch' }),
    ).not.toBeDisabled()
    expect(api.getCurrent).toHaveBeenCalledTimes(3)
  })

  it('blocks governed actions until stale recovery resolves with new authority', async () => {
    const active = makePlan('ACTIVE')
    const paused = makePlan('PAUSED', { version: 4 })
    let resolveRefresh: (plan: typeof paused) => void = () => undefined
    const pendingRefresh = new Promise<typeof paused>((resolve) => {
      resolveRefresh = resolve
    })
    const api = makeApi({
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce(active)
        .mockReturnValueOnce(pendingRefresh),
      getOccurrences: jest.fn().mockResolvedValue(makeOccurrenceList([])),
      changeStatus: jest.fn().mockRejectedValue(
        new ApiError({
          message: 'stale',
          code: 'SUPPORT_PLAN_VERSION_MISMATCH',
          status: 412,
        }),
      ),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Tạm dừng kế hoạch' }),
    )

    expect(await screen.findByText(/vừa thay đổi ở nơi khác/)).toBeTruthy()
    const blockedPause = screen.getByRole('button', {
      name: 'Tạm dừng kế hoạch',
    })
    expect(blockedPause).toBeDisabled()
    await fireEvent.press(blockedPause)
    expect(api.changeStatus).toHaveBeenCalledTimes(1)

    await act(async () => resolveRefresh(paused))

    expect(
      await screen.findByRole('button', { name: 'Tiếp tục kế hoạch' }),
    ).not.toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Tạm dừng kế hoạch' }),
    ).toBeNull()
    expect(api.getCurrent).toHaveBeenCalledTimes(2)
  })

  it('stays fail-closed after recovery failure until an explicit reload succeeds', async () => {
    const active = makePlan('ACTIVE')
    const paused = makePlan('PAUSED', { version: 4 })
    const api = makeApi({
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce(active)
        .mockRejectedValueOnce(
          new ApiError({
            message: 'offline',
            code: 'CARE_UNAVAILABLE',
            status: 503,
          }),
        )
        .mockResolvedValueOnce(paused),
      getOccurrences: jest.fn().mockResolvedValue(makeOccurrenceList([])),
      changeStatus: jest.fn().mockRejectedValueOnce(
        new ApiError({
          message: 'stale',
          code: 'SUPPORT_PLAN_VERSION_MISMATCH',
          status: 412,
        }),
      ),
    })
    await renderScreen(<SupportPlanScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Tạm dừng kế hoạch' }),
    )

    expect(await screen.findByText(/Các thay đổi đang bị khóa/)).toBeTruthy()
    const blockedPause = screen.getByRole('button', {
      name: 'Tạm dừng kế hoạch',
    })
    expect(blockedPause).toBeDisabled()
    await fireEvent.press(blockedPause)
    expect(api.changeStatus).toHaveBeenCalledTimes(1)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lại trạng thái an toàn' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Tiếp tục kế hoạch' }),
    ).not.toBeDisabled()
    expect(api.getCurrent).toHaveBeenCalledTimes(3)
  })

  it('reviews and explicitly accepts a specialist proposal from its deep link', async () => {
    const pending = makePlanChangeRequest()
    const accepted = makePlanChangeRequest({
      status: 'ACCEPTED',
      outcomeCode: 'PROPOSAL_APPLIED',
      version: 1,
      decidedAt: '2026-10-07T02:00:00.000Z',
      replacementSupportPlanId: '10000000-0000-4000-8000-000000000003',
      replacementSupportPlanVersion: 1,
    })
    const api = makeApi({
      getPlanChangeRequest: jest.fn().mockResolvedValue(pending),
      decidePlanChangeRequest: jest.fn().mockResolvedValue(accepted),
    })
    await renderScreen(
      <SupportPlanScreen api={api} proposalId={pending.sourceProposalId} />,
    )

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Chấp nhận đề xuất' }),
    )

    await waitFor(() =>
      expect(api.decidePlanChangeRequest).toHaveBeenCalledWith(
        pending,
        'ACCEPT',
        expect.any(String),
      ),
    )
    expect(await screen.findByText(/Đã áp dụng đề xuất/)).toBeTruthy()
  })

  it.each([
    [401, 'Phiên đăng nhập đã hết hạn'],
    [403, 'không có quyền'],
    [503, 'Chưa thể tải kế hoạch hỗ trợ lúc này'],
  ])(
    'fails closed when the owner query returns %s',
    async (status, message) => {
      const error = new ApiError({
        message: 'failed',
        code: status === 401 ? 'UNAUTHORIZED' : 'CARE_UNAVAILABLE',
        status,
      })
      const api = makeApi({
        getCurrent: jest.fn().mockRejectedValue(error),
        getCurrentDraft: jest.fn().mockRejectedValue(error),
      })
      await renderScreen(<SupportPlanScreen api={api} />)

      expect(await screen.findByText(new RegExp(message))).toBeTruthy()
      expect(api.activate).not.toHaveBeenCalled()
      expect(api.changeStatus).not.toHaveBeenCalled()
    },
  )
})
