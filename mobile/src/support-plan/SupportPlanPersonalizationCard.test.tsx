import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { SupportPlanApi } from './support-plan-api'
import { SupportPlanPersonalizationCard } from './SupportPlanPersonalizationCard'

const notProvided = {
  value: {
    personalizationId: null,
    schemaVersion: 'support-plan-personalization-v1',
    revision: 0,
    status: 'NOT_PROVIDED',
    preferredFocus: null,
    desiredPace: null,
    dailyTimeBudgetMinutes: null,
    preferredDaypart: null,
    preferredActivityModes: [],
    commonBarriers: [],
    submittedAt: null,
    planReview: {
      required: false,
      supportPlanId: null,
      supportPlanVersion: null,
      reasonCode: null,
    },
  },
  etag: '"0"',
} as const

function makeApi(overrides: Partial<SupportPlanApi> = {}) {
  return {
    getPersonalization: jest.fn().mockResolvedValue(notProvided),
    replacePersonalization: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<SupportPlanApi>
}

async function renderCard(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  return await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe('mobile SupportPlan personalization', () => {
  it('renders the absent fallback with every field optional', async () => {
    const api = makeApi()
    await renderCard(
      <SupportPlanPersonalizationCard
        api={api}
        subject="user-1"
        onReviewPlan={jest.fn()}
      />,
    )

    expect(
      await screen.findByText('Điều gì giúp kế hoạch dễ thực hiện hơn?'),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: 'Ngủ và nghỉ ngơi' }).props
        .accessibilityState,
    ).toMatchObject({ checked: false })
    expect(
      screen.getByRole('button', { name: 'Lưu lựa chọn' }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true })
  })

  it('saves partial preferences with the loaded ETag', async () => {
    const api = makeApi({
      replacePersonalization: jest.fn().mockImplementation(async (request) => ({
        value: {
          ...notProvided.value,
          personalizationId: '10000000-0000-4000-8000-000000000638',
          revision: 1,
          status: 'PROVIDED',
          ...request,
          submittedAt: '2026-10-12T08:00:00Z',
        },
        etag: '"1"',
      })),
    })
    await renderCard(
      <SupportPlanPersonalizationCard
        api={api}
        subject="user-1"
        onReviewPlan={jest.fn()}
      />,
    )

    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Tìm lại động lực' }),
    )
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Thói quen nhỏ' }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu lựa chọn' }).props
          .accessibilityState,
      ).toMatchObject({ disabled: false }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    await waitFor(() =>
      expect(api.replacePersonalization).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredFocus: 'MOTIVATION',
          preferredActivityModes: ['ROUTINE'],
          commonBarriers: [],
        }),
        '"0"',
      ),
    )
    expect(
      await screen.findByText('Đã lưu cách bạn muốn kế hoạch đồng hành.'),
    ).toBeTruthy()
  })

  it('explains that a stale draft must be reviewed and regenerated explicitly', async () => {
    const onReviewPlan = jest.fn()
    const api = makeApi({
      getPersonalization: jest.fn().mockResolvedValue({
        value: {
          ...notProvided.value,
          personalizationId: '10000000-0000-4000-8000-000000000638',
          revision: 2,
          status: 'PROVIDED',
          preferredFocus: 'MOTIVATION',
          submittedAt: '2026-10-12T08:00:00Z',
          planReview: {
            required: true,
            supportPlanId: '20000000-0000-4000-8000-000000000638',
            supportPlanVersion: 1,
            reasonCode: 'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION',
          },
        },
        etag: '"2"',
      }),
    })
    await renderCard(
      <SupportPlanPersonalizationCard
        api={api}
        subject="user-1"
        onReviewPlan={onReviewPlan}
      />,
    )

    expect(
      await screen.findByText('Bản đề xuất hiện tại cần được tạo lại'),
    ).toBeTruthy()
    expect(screen.getByText(/bỏ bản cũ rồi tạo lại/i)).toBeTruthy()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem bản đề xuất bên dưới' }),
    )
    expect(onReviewPlan).toHaveBeenCalledTimes(1)
  })

  it('keeps local selections after a stale write and offers recovery', async () => {
    const api = makeApi({
      replacePersonalization: jest.fn().mockRejectedValue(
        new ApiError({
          message: 'stale',
          code: 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH',
          status: 412,
        }),
      ),
    })
    await renderCard(
      <SupportPlanPersonalizationCard
        api={api}
        subject="user-1"
        onReviewPlan={jest.fn()}
      />,
    )

    await fireEvent.press(
      await screen.findByRole('checkbox', { name: 'Ít năng lượng' }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu lựa chọn' }).props
          .accessibilityState,
      ).toMatchObject({ disabled: false }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    expect(await screen.findByText(/đã được cập nhật ở nơi khác/i)).toBeTruthy()
    expect(
      screen.getByRole('checkbox', { name: 'Ít năng lượng' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lựa chọn mới nhất' }),
    )
    await waitFor(() => expect(api.getPersonalization).toHaveBeenCalledTimes(2))
  })
})
