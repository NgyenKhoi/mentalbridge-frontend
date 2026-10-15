import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import type { SupportPlanV3 } from '../api/support-plan-contract'
import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanJourney from './SupportPlanJourney'

const api = vi.hoisted(() => ({
  activateSupportPlan: vi.fn(),
  changeSupportPlanOccurrenceState: vi.fn(),
  changeSupportPlanStatus: vi.fn(),
  getCurrentSupportPlan: vi.fn(),
  getCurrentSupportPlanDraft: vi.fn(),
  getCurrentSupportPlanDraftActions: vi.fn(),
  getSupportPlan: vi.fn(),
  getSupportPlanHistory: vi.fn(),
  getSupportPlanActions: vi.fn(),
  getSupportPlanOccurrences: vi.fn(),
  getSupportPlanPersonalization: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
  replaceSupportPlan: vi.fn(),
  replaceSupportPlanChoices: vi.fn(),
  replaceSupportPlanActionSchedule: vi.fn(),
  replaceSupportPlanPersonalization: vi.fn(),
  reviewSupportPlanReplacement: vi.fn(),
  requestSupportPlanActionCompanionExplanation: vi.fn(),
}))

const assessmentApi = vi.hoisted(() => ({
  getCurrentReassessmentSummary: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => api)
vi.mock('@/features/assessment/api/browser-care', () => assessmentApi)

const reassessmentSummary = {
  summaryId: '40000000-0000-4000-8000-000000000001',
  summaryVersion: 'reassessment-summary-v2',
  composedAt: '2026-09-24T00:01:02Z',
  previousPeriod: {
    startAt: '2026-08-27T00:00:00Z',
    endAt: '2026-09-10T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-10T00:00:00Z',
    endAt: '2026-09-24T00:00:00Z',
  },
  screening: { state: 'AVAILABLE', trends: [] },
  journalContext: {
    state: 'UNAVAILABLE',
    unavailableReason: 'PROVIDER_TIMEOUT',
    changesComparedWithPreviousPeriod: [],
    provenance: null,
  },
  supportPlanEngagement: {
    state: 'INSUFFICIENT_DATA',
    previousPeriod: { completedCount: 0, skippedCount: 0 },
    currentPeriod: { completedCount: 0, skippedCount: 0 },
  },
  selfReportedExperience: null,
  activityReflection: { state: 'INSUFFICIENT_DATA', sources: [] },
  disclaimerCode: 'FOUR_DIMENSIONS_NOT_COMBINED',
}

function problem(code: string, status: number) {
  return new ApiError({ message: code, code, status })
}

function activePlan() {
  return {
    ...supportPlanFixture(),
    status: 'ACTIVE' as const,
    version: 1,
    activatedAt: '2026-09-20T05:00:00Z',
  }
}

function scheduleProjection(
  version: number,
  firstDuration = 15,
  secondDuration = 20,
): SupportPlanV3 {
  const action = (
    ordinal: number,
    duration: number,
  ): SupportPlanV3['focuses'][number]['actions'][number] => ({
    actionId: `20000000-0000-4000-8000-00000000064${ordinal}`,
    actionType: 'ROUTINE_SELF_MANAGEMENT' as const,
    actionVersion: 1,
    representationMode: 'NATIVE_V3' as const,
    status: 'DRAFT' as const,
    pathRole: 'PRIMARY' as const,
    purposeCode: 'WELLBEING_ROUTINE',
    rationale: null,
    ordinal,
    source: null,
    provenance: {
      category: 'USER_SELECTED',
      referenceId: null,
      referenceVersion: null,
      acceptedAt: '2026-10-12T01:00:00Z',
    },
    presentation: {
      title: `Hoạt động ${ordinal}`,
      summary: null,
      instructions: null,
      externalUrl: null,
    },
    schedules: [
      {
        scheduleId: `30000000-0000-4000-8000-00000000064${ordinal}`,
        version: 1,
        schedulePolicyVersion: 'support-plan-activity-schedule-v2',
        recurrenceType: 'WEEKLY' as const,
        recurrenceDayOfWeek: null,
        daysOfWeek: [1],
        preferredDaypart: 'MORNING' as const,
        estimatedDurationMinutes: duration,
        localTime: `0${7 + ordinal}:00:00`,
        timezone: 'Asia/Ho_Chi_Minh',
        effectiveFrom: '2099-01-01',
        effectiveUntil: null,
        reminderEnabled: true,
        status: 'DRAFT' as const,
      },
    ],
    createdAt: '2026-10-12T01:00:00Z',
    updatedAt: '2026-10-12T01:00:00Z',
    activatedAt: null,
    endedAt: null,
  })

  return {
    supportPlanId: supportPlanFixture().supportPlanId,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-selection-v2',
    representationMode: 'NATIVE_V3',
    status: 'DRAFT',
    version,
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'STANDARD',
      policyVersion: 'safety-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Safety guidance.',
    },
    focuses: [
      {
        focusId: 'focus-1',
        title: 'Hỗ trợ nhịp hoạt động',
        rationale: null,
        personalizationProvenance: null,
        ordinal: 1,
        actions: [action(1, firstDuration), action(2, secondDuration)],
      },
    ],
    createdAt: '2026-10-12T01:00:00Z',
    updatedAt: '2026-10-12T01:00:00Z',
    activatedAt: null,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'Wellbeing support.',
  }
}

describe('SupportPlanJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCurrentSupportPlan.mockRejectedValue(
      problem('SUPPORT_PLAN_CURRENT_NOT_FOUND', 404),
    )
    api.getSupportPlanOccurrences.mockResolvedValue({
      supportPlanId: '10000000-0000-4000-8000-000000000373',
      supportPlanStatus: 'ACTIVE',
      schedulePolicyVersion: 'support-plan-activity-schedule-v1',
      from: '2026-09-21',
      through: '2026-10-04',
      occurrences: [],
      interpretationCode:
        'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    })
    api.getSupportPlanHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    api.getSupportPlanActions.mockResolvedValue({
      supportPlanId: '10000000-0000-4000-8000-000000000373',
      focuses: [
        {
          focusId: 'focus-1',
          title: 'Hỗ trợ tâm trạng',
          rationale: 'Nội dung được chọn theo chính sách hỗ trợ hiện hành.',
          personalizationProvenance: null,
          actions: [],
        },
      ],
    })
    api.getCurrentSupportPlanDraftActions.mockImplementation(() =>
      api.getSupportPlanActions(),
    )
    api.requestSupportPlanActionCompanionExplanation.mockResolvedValue({
      schemaVersion: 'support-plan-companion-message-v1',
      supportPlanId: supportPlanFixture().supportPlanId,
      actionId: '20000000-0000-4000-8000-000000000650',
      intent: 'EXPLAIN_ACTION',
      surface: 'PLAN',
      text: 'Phản hồi đã kiểm duyệt.',
      delivery: 'GENERATED',
      policyVersion: 'support-plan-companion-policy-v1',
      promptVersion: 'support-plan-companion-prompt-v1',
      templateVersion: 'support-plan-companion-template-v1',
      provider: 'OPENAI',
      model: 'test-model',
      fallbackReason: null,
    })
    api.getSupportPlanPersonalization.mockResolvedValue({
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
    })
    assessmentApi.getCurrentReassessmentSummary.mockResolvedValue(
      reassessmentSummary,
    )
  })

  it('renders the authoritative current active plan before looking for a draft', async () => {
    api.getCurrentSupportPlan.mockResolvedValue(activePlan())

    render(<SupportPlanJourney />)

    expect(await screen.findByText('Kế hoạch đang thực hiện')).toBeVisible()
    expect(api.getCurrentSupportPlan).toHaveBeenCalledTimes(1)
    expect(api.getCurrentSupportPlanDraft).toHaveBeenCalledTimes(1)
  })

  it('deduplicates rapid and cross-card contextual requests until the admitted request settles', async () => {
    const user = userEvent.setup()
    const plan = activePlan()
    const firstActionId = '20000000-0000-4000-8000-000000000650'
    const secondActionId = '20000000-0000-4000-8000-000000000651'
    const action = (actionId: string, title: string) => ({
      actionId,
      actionType: 'RESOURCE' as const,
      actionVersion: 1,
      representationMode: 'V2_RESOURCE_ADAPTER' as const,
      status: 'ACTIVE' as const,
      pathRole: 'PRIMARY' as const,
      purposeCode: 'UNDERSTAND_CURRENT_PATTERN',
      rationale: 'Lý do đã duyệt.',
      ordinal: 1,
      source: null,
      provenance: {
        category: 'SYSTEM_POLICY' as const,
        referenceId: null,
        referenceVersion: null,
        acceptedAt: '2026-10-14T00:00:00Z',
      },
      presentation: {
        title,
        summary: null,
        instructions: null,
        externalUrl: null,
      },
      schedules: [],
      createdAt: '2026-10-14T00:00:00Z',
      updatedAt: '2026-10-14T00:00:00Z',
      activatedAt: '2026-10-14T00:00:00Z',
      endedAt: null,
    })
    api.getCurrentSupportPlan.mockResolvedValue(plan)
    api.getSupportPlanActions.mockResolvedValue({
      ...scheduleProjection(1),
      supportPlanId: plan.supportPlanId,
      status: 'ACTIVE',
      focuses: [
        {
          focusId: 'focus-companion',
          title: 'Trọng tâm',
          rationale: null,
          personalizationProvenance: null,
          ordinal: 1,
          actions: [
            action(firstActionId, 'Hoạt động A'),
            action(secondActionId, 'Hoạt động B'),
          ],
        },
      ],
    })
    let release: (() => void) | undefined
    api.requestSupportPlanActionCompanionExplanation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              schemaVersion: 'support-plan-companion-message-v1',
              supportPlanId: plan.supportPlanId,
              actionId: firstActionId,
              intent: 'EXPLAIN_ACTION',
              surface: 'PLAN',
              text: 'Phản hồi đầu tiên.',
              delivery: 'GENERATED',
              policyVersion: 'support-plan-companion-policy-v1',
              promptVersion: 'support-plan-companion-prompt-v1',
              templateVersion: 'support-plan-companion-template-v1',
              provider: 'OPENAI',
              model: 'test-model',
              fallbackReason: null,
            })
        }),
    )

    render(<SupportPlanJourney />)
    await user.click(await screen.findByRole('tab', { name: 'Kế hoạch' }))
    const first = await screen.findByRole('button', { name: /Hoạt động A/ })
    const second = screen.getByRole('button', { name: /Hoạt động B/ })
    fireEvent.click(first)
    fireEvent.click(first)
    fireEvent.click(second)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)
    expect(second).toBeDisabled()

    release?.()
    expect(await screen.findAllByText('Phản hồi đầu tiên.')).not.toHaveLength(0)
    await user.click(
      screen.getAllByRole('button', { name: 'Đóng lời giải thích' })[0],
    )
    await user.click(second)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(2)
  })

  it('keeps generic loading neutral instead of pretending to wait for a user choice', async () => {
    api.getCurrentSupportPlan.mockImplementationOnce(
      () => new Promise(() => undefined),
    )
    api.getCurrentSupportPlanDraft.mockImplementationOnce(
      () => new Promise(() => undefined),
    )

    render(<SupportPlanJourney />)

    await waitFor(() =>
      expect(api.getCurrentSupportPlan).toHaveBeenCalledOnce(),
    )
    expect(
      screen.getByText('Đang tải kế hoạch hỗ trợ hiện tại…'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Chờ bạn quyết định')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/xác nhận khi đã sẵn sàng/),
    ).not.toBeInTheDocument()
  })

  it('uses greeting only for route entry and keeps Progress neutral without an approved next step', async () => {
    api.getCurrentSupportPlan.mockResolvedValue(activePlan())

    render(<SupportPlanJourney />)

    expect(screen.getAllByText('Chào bạn').length).toBeGreaterThan(0)
    const progressTab = await screen.findByRole('tab', { name: 'Tiến triển' })
    fireEvent.click(progressTab)

    await waitFor(() =>
      expect(screen.getAllByText('Nghỉ nhẹ').length).toBeGreaterThan(0),
    )
    expect(screen.queryByText('Khích lệ nhẹ')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Hôm nay' }))
    expect(screen.queryByText('Chào bạn')).not.toBeInTheDocument()
    expect(screen.getAllByText('Nghỉ nhẹ').length).toBeGreaterThan(0)
  })

  it('exposes the four journey tabs and supports roving keyboard navigation', async () => {
    api.getCurrentSupportPlan.mockResolvedValue(activePlan())

    render(<SupportPlanJourney />)

    const todayTab = await screen.findByRole('tab', { name: 'Hôm nay' })
    const planTab = screen.getByRole('tab', { name: 'Kế hoạch' })
    const progressTab = screen.getByRole('tab', { name: 'Tiến triển' })
    const adjustTab = screen.getByRole('tab', { name: 'Điều chỉnh' })

    expect(todayTab).toHaveAttribute('aria-selected', 'true')
    expect(planTab).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(todayTab, { key: 'ArrowRight' })
    await waitFor(() => expect(planTab).toHaveFocus())
    expect(planTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(planTab, { key: 'End' })
    await waitFor(() => expect(adjustTab).toHaveFocus())
    expect(adjustTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Xem lại nhẹ nhàng').length).toBeGreaterThan(0)

    fireEvent.keyDown(adjustTab, { key: 'Home' })
    await waitFor(() => expect(todayTab).toHaveFocus())
    expect(todayTab).toHaveAttribute('aria-selected', 'true')
    expect(progressTab).toHaveAttribute('aria-selected', 'false')
  })

  it('falls back to the persisted draft without proposing again', async () => {
    api.getCurrentSupportPlanDraft.mockResolvedValue(supportPlanFixture())

    render(<SupportPlanJourney />)

    expect(await screen.findByText('Reviewed primary resource')).toBeVisible()
    expect(api.getCurrentSupportPlanDraft).toHaveBeenCalledTimes(1)
    expect(api.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('reports unsaved resource choices and clears the entry guard when the original choice is restored', async () => {
    const onDirtyChange = vi.fn()
    api.getCurrentSupportPlanDraft.mockResolvedValue(supportPlanFixture())
    render(<SupportPlanJourney onDirtyChange={onDirtyChange} />)
    const alternative = await screen.findByRole('radio', {
      name: /Reviewed alternative/,
    })
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
    fireEvent.click(alternative)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    fireEvent.click(
      screen.getByRole('radio', { name: /Reviewed primary resource/ }),
    )
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it('combines schedule and personalization drafts without clearing the guard when only one is undone', async () => {
    const onDirtyChange = vi.fn()
    const draft = { ...supportPlanFixture(), version: 2 }
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.getCurrentSupportPlanDraftActions.mockResolvedValue(
      scheduleProjection(2),
    )
    const view = render(<SupportPlanJourney onDirtyChange={onDirtyChange} />)
    const durations = await screen.findAllByLabelText(
      'Thời lượng dự kiến (phút)',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Điều chỉnh' }))
    await screen.findByRole('radio', { name: '10 phút' })
    fireEvent.change(durations[0], { target: { value: '25' } })
    fireEvent.click(screen.getByRole('radio', { name: '10 phút' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    fireEvent.change(durations[0], { target: { value: '15' } })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(api.replaceSupportPlanPersonalization).not.toHaveBeenCalled()
    view.unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('preserves another action draft when saving one schedule advances the plan version', async () => {
    const draft = { ...supportPlanFixture(), version: 2 }
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.getCurrentSupportPlanDraftActions.mockResolvedValue(
      scheduleProjection(2),
    )
    api.replaceSupportPlanActionSchedule.mockResolvedValue(
      scheduleProjection(3, 25, 20),
    )

    render(<SupportPlanJourney />)

    const durations = await screen.findAllByLabelText(
      'Thời lượng dự kiến (phút)',
    )
    fireEvent.change(durations[0], { target: { value: '25' } })
    fireEvent.change(durations[1], { target: { value: '35' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu lịch' })[0])

    await waitFor(() =>
      expect(api.replaceSupportPlanActionSchedule).toHaveBeenCalledOnce(),
    )
    expect(
      screen.getAllByLabelText('Thời lượng dự kiến (phút)')[1],
    ).toHaveValue(35)
  })

  it('reloads the stale action while preserving another unsaved schedule draft', async () => {
    const draft = { ...supportPlanFixture(), version: 2 }
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.getCurrentSupportPlanDraftActions.mockResolvedValue(
      scheduleProjection(2),
    )
    api.replaceSupportPlanActionSchedule.mockRejectedValue(
      problem('SUPPORT_PLAN_VERSION_MISMATCH', 412),
    )

    render(<SupportPlanJourney />)

    const durations = await screen.findAllByLabelText(
      'Thời lượng dự kiến (phút)',
    )
    fireEvent.change(durations[0], { target: { value: '25' } })
    fireEvent.change(durations[1], { target: { value: '35' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu lịch' })[0])

    const reload = await screen.findByRole('button', {
      name: 'Tải lịch mới',
    })
    api.getCurrentSupportPlanDraft.mockResolvedValue({ ...draft, version: 3 })
    api.getCurrentSupportPlanDraftActions.mockResolvedValue(
      scheduleProjection(3, 30, 20),
    )
    fireEvent.click(reload)

    await waitFor(() => {
      const reloadedDurations = screen.getAllByLabelText(
        'Thời lượng dự kiến (phút)',
      )
      expect(reloadedDurations[0]).toHaveValue(30)
      expect(reloadedDurations[1]).toHaveValue(35)
    })
  })

  it('opens progress when only immutable plan history remains', async () => {
    const completed = {
      ...activePlan(),
      status: 'COMPLETED' as const,
      version: 2,
      updatedAt: '2026-09-21T05:00:00Z',
      completedAt: '2026-09-21T05:00:00Z',
      completionReason: null,
    }
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
    )
    api.getSupportPlanHistory.mockResolvedValue({
      items: [completed],
      nextCursor: null,
      hasMore: false,
    })

    render(<SupportPlanJourney />)

    expect(await screen.findByText('Đã kết thúc')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Tiến triển' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('routes a Free user to the one-time Support Guide without creating a draft', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_ENTITLEMENT_REQUIRED', 403),
    )

    render(<SupportPlanJourney />)

    const link = await screen.findByRole('link', {
      name: 'Xem gợi ý hỗ trợ',
    })
    expect(link).toHaveAttribute('href', '/support-guides')
    expect(screen.getByText(/dành cho gói Plus và Premium/)).toBeVisible()
    expect(api.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('creates a bounded draft from the empty state and retains one retry key', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
    )
    api.proposeSupportPlanDraft.mockResolvedValue(supportPlanFixture())

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tạo kế hoạch hỗ trợ',
      }),
    )

    expect(await screen.findByText('Reviewed primary resource')).toBeVisible()
    expect(api.proposeSupportPlanDraft).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'INITIAL_CHECK',
    )
  })

  it.each([
    { persona: 'A', action: 'save' as const, preferredFocus: 'SLEEP' },
    { persona: 'B', action: 'skip' as const, preferredFocus: null },
  ])(
    'lets first-plan Persona $persona save or skip preferences before generation',
    async ({ action, preferredFocus }) => {
      api.getCurrentSupportPlanDraft.mockRejectedValue(
        problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
      )
      api.replaceSupportPlanPersonalization.mockImplementation(
        async (request) => {
          const authority = await api.getSupportPlanPersonalization()
          return {
            value: {
              ...authority.value,
              personalizationId: '10000000-0000-4000-8000-000000000638',
              revision: 1,
              status: request.preferredFocus === null ? 'SKIPPED' : 'PROVIDED',
              ...request,
              submittedAt: '2026-10-12T08:00:00Z',
            },
            etag: '"1"',
          }
        },
      )
      api.proposeSupportPlanDraft.mockResolvedValue(supportPlanFixture())

      render(<SupportPlanJourney />)
      expect(
        await screen.findByText(
          'Điều gì giúp kế hoạch dễ thực hiện hơn?',
          undefined,
          { timeout: 5_000 },
        ),
      ).toBeVisible()

      if (action === 'save') {
        fireEvent.click(screen.getByRole('radio', { name: 'Ngủ và nghỉ ngơi' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua tất cả' }))
      }
      await waitFor(() =>
        expect(api.replaceSupportPlanPersonalization).toHaveBeenCalledWith(
          expect.objectContaining({ preferredFocus }),
          '"0"',
        ),
      )

      fireEvent.click(
        screen.getByRole('button', { name: 'Tạo kế hoạch hỗ trợ' }),
      )
      await waitFor(() =>
        expect(api.proposeSupportPlanDraft).toHaveBeenCalled(),
      )
      expect(
        api.replaceSupportPlanPersonalization.mock.invocationCallOrder[0],
      ).toBeLessThan(api.proposeSupportPlanDraft.mock.invocationCallOrder[0])
    },
  )

  it.each([
    {
      name: 'personalized',
      title: 'Bắt đầu bằng bước nhỏ',
      rationale: 'Lý do đã được Care xác nhận từ lựa chọn của bạn.',
      provenance: { reasonCode: 'USER_PREFERENCE_AND_CARE_POLICY' },
      badge: true,
    },
    {
      name: 'fallback',
      title: 'Hỗ trợ tâm trạng',
      rationale: 'Lý do theo chính sách hỗ trợ hiện hành.',
      provenance: null,
      badge: false,
    },
  ])('shows the admitted $name focus rationale', async (example) => {
    const plan = activePlan()
    api.getCurrentSupportPlan.mockResolvedValue(plan)
    api.getSupportPlanActions.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      focuses: [
        {
          focusId: 'focus-1',
          title: example.title,
          rationale: example.rationale,
          personalizationProvenance: example.provenance,
          actions: [],
        },
      ],
    })

    render(<SupportPlanJourney />)

    expect(await screen.findByText(example.title)).toBeVisible()
    expect(screen.getByText(example.rationale)).toBeVisible()
    if (example.badge) {
      expect(screen.getByText('Được sắp xếp từ lựa chọn của bạn')).toBeVisible()
    } else {
      expect(
        screen.queryByText('Được sắp xếp từ lựa chọn của bạn'),
      ).not.toBeInTheDocument()
    }
  })

  it('directs the user to screening history when either required result is unavailable', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
    )
    api.proposeSupportPlanDraft.mockRejectedValue(
      problem('INITIAL_CHECK_INCOMPLETE', 409),
    )

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tạo kế hoạch hỗ trợ',
      }),
    )

    expect(
      await screen.findByText(/Bạn chỉ cần hoàn tất bài còn thiếu/),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem các bài sàng lọc' }),
    ).toHaveAttribute('href', '/assessments')
  })

  it('saves an admitted alternative with the draft version', async () => {
    const draft = supportPlanFixture()
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    const changed = {
      ...draft,
      version: 1,
      slots: [
        {
          ...draft.slots[0],
          selectedResource: draft.slots[0].allowedAlternatives[0],
        },
      ],
    }
    api.replaceSupportPlanChoices.mockResolvedValue(changed)

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('radio', { name: /Reviewed alternative/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    await waitFor(() =>
      expect(api.replaceSupportPlanChoices).toHaveBeenCalledWith(
        draft.supportPlanId,
        0,
        {
          slotSelections: [
            {
              slotId: 'depressive-psychoeducation',
              resourceId: '50000000-0000-4000-8000-000000000372',
              contentVersion: '2',
            },
          ],
        },
      ),
    )
    expect(await screen.findByText('Đã lưu lựa chọn của bạn.')).toBeVisible()
  })

  it('activates once and then displays only the reloaded current plan', async () => {
    const draft = supportPlanFixture()
    const active = activePlan()
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.activateSupportPlan.mockResolvedValue(active)
    api.getCurrentSupportPlan
      .mockRejectedValueOnce(problem('SUPPORT_PLAN_CURRENT_NOT_FOUND', 404))
      .mockResolvedValueOnce(active)

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    )

    expect(await screen.findByText('Kế hoạch đang thực hiện')).toBeVisible()
    expect(api.activateSupportPlan).toHaveBeenCalledWith(
      draft.supportPlanId,
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(api.getCurrentSupportPlan).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the complete draft and explains a stale activation failure', async () => {
    api.getCurrentSupportPlanDraft.mockResolvedValue(supportPlanFixture())
    api.activateSupportPlan.mockRejectedValue(
      problem('RESOURCE_VERSION_STALE', 409),
    )

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    )

    expect(await screen.findByText(/nội dung hỗ trợ đã thay đổi/)).toBeVisible()
    expect(screen.getByText('Reviewed primary resource')).toBeVisible()
  })

  it('keeps the current plan usable until replacement is explicitly confirmed', async () => {
    const current = activePlan()
    const draft = {
      ...supportPlanFixture(),
      supportPlanId: '10000000-0000-4000-8000-000000000399',
    }
    const activated = {
      ...draft,
      status: 'ACTIVE' as const,
      version: 2,
      activatedAt: '2026-09-24T01:00:00Z',
    }
    api.getCurrentSupportPlan.mockResolvedValue(current)
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.reviewSupportPlanReplacement.mockResolvedValue({
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      rationaleCodes: ['CURRENT_PLAN_ADMISSIBLE', 'PROPOSED_SELECTION_DIFFERS'],
      comparison: [
        {
          change: 'CHANGED',
          currentSlotId: current.slots[0].slotId,
          currentResource: current.slots[0].selectedResource,
          proposedSlotId: draft.slots[0].slotId,
          proposedResource: draft.slots[0].allowedAlternatives[0],
        },
      ],
      currentPlan: current,
      proposedPlan: draft,
      reassessmentSummary,
      reviewedAt: '2026-09-24T00:02:00Z',
    })
    api.replaceSupportPlan.mockResolvedValue(activated)

    render(<SupportPlanJourney />)

    expect(
      await screen.findByText('Có phương án hỗ trợ khác để cân nhắc'),
    ).toBeVisible()
    expect(screen.getByText('Kế hoạch đang thực hiện')).toBeVisible()
    expect(screen.getByText('Phương án thay thế')).toBeVisible()
    expect(api.replaceSupportPlan).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Xác nhận dùng phương án mới' }),
    )

    await waitFor(() => expect(api.replaceSupportPlan).toHaveBeenCalledOnce())
    expect(api.replaceSupportPlan).toHaveBeenCalledWith(
      draft.supportPlanId,
      draft.version,
      {
        currentSupportPlanId: current.supportPlanId,
        currentVersion: current.version,
        reassessmentSummaryId: reassessmentSummary.summaryId,
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
  })

  it('keeps stale replacement review in Adjust and scrolls to the draft', async () => {
    const current = activePlan()
    const draft = {
      ...supportPlanFixture(),
      supportPlanId: '10000000-0000-4000-8000-000000000399',
    }
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    api.getCurrentSupportPlan.mockResolvedValue(current)
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.reviewSupportPlanReplacement.mockRejectedValue(
      problem('SUPPORT_PLAN_REVIEW_UNAVAILABLE', 503),
    )
    api.getSupportPlanPersonalization.mockResolvedValue({
      value: {
        personalizationId: '10000000-0000-4000-8000-000000000638',
        schemaVersion: 'support-plan-personalization-v1',
        revision: 2,
        status: 'PROVIDED',
        preferredFocus: 'MOTIVATION',
        desiredPace: null,
        dailyTimeBudgetMinutes: null,
        preferredDaypart: null,
        preferredActivityModes: [],
        commonBarriers: [],
        submittedAt: '2026-10-12T08:00:00Z',
        planReview: {
          required: true,
          supportPlanId: draft.supportPlanId,
          supportPlanVersion: draft.version,
          reasonCode: 'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION',
        },
      },
      etag: '"2"',
    })

    render(<SupportPlanJourney />)

    const reviewDraft = await screen.findByRole('button', {
      name: 'Xem bản đề xuất',
    })
    const adjustTab = screen.getByRole('tab', { name: 'Điều chỉnh' })
    expect(adjustTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(reviewDraft)

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce())
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    expect(adjustTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Phương án thay thế')).toBeVisible()
  })

  it('keeps a replacement conflict visible after reloading the authoritative review', async () => {
    const current = activePlan()
    const draft = {
      ...supportPlanFixture(),
      supportPlanId: '10000000-0000-4000-8000-000000000399',
    }
    api.getCurrentSupportPlan.mockResolvedValue(current)
    api.getCurrentSupportPlanDraft.mockResolvedValue(draft)
    api.reviewSupportPlanReplacement.mockResolvedValue({
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      rationaleCodes: ['CURRENT_PLAN_ADMISSIBLE', 'PROPOSED_SELECTION_DIFFERS'],
      comparison: [
        {
          change: 'CHANGED',
          currentSlotId: current.slots[0].slotId,
          currentResource: current.slots[0].selectedResource,
          proposedSlotId: draft.slots[0].slotId,
          proposedResource: draft.slots[0].allowedAlternatives[0],
        },
      ],
      currentPlan: current,
      proposedPlan: draft,
      reassessmentSummary,
      reviewedAt: '2026-09-24T00:02:00Z',
    })
    api.replaceSupportPlan.mockRejectedValue(
      problem('SUPPORT_PLAN_VERSION_MISMATCH', 412),
    )

    render(<SupportPlanJourney />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: /phương án mới/,
      }),
    )

    await waitFor(() =>
      expect(api.reviewSupportPlanReplacement).toHaveBeenCalledTimes(2),
    )
    expect(screen.getByText(/Kế hoạch đang thực hiện/)).toBeVisible()
    expect(screen.getByText(/phương án hỗ trợ khác/)).toBeVisible()
    expect(
      await screen.findByText(/Kế hoạch đã thay đổi ở nơi khác/),
    ).toBeVisible()
  })

  it('confirms completion, forwards the optional reason, and reloads current state and history', async () => {
    const active = activePlan()
    const completed = {
      ...active,
      status: 'COMPLETED' as const,
      version: 2,
      updatedAt: '2026-09-21T05:00:00Z',
      completedAt: '2026-09-21T05:00:00Z',
      completionReason: 'PLAN_NO_LONGER_FITS' as const,
    }
    api.getCurrentSupportPlan
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(problem('SUPPORT_PLAN_CURRENT_NOT_FOUND', 404))
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
    )
    api.changeSupportPlanStatus.mockResolvedValue(completed)
    api.getSupportPlanHistory
      .mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false })
      .mockResolvedValueOnce({
        items: [completed],
        nextCursor: null,
        hasMore: false,
      })

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kết thúc kế hoạch' }),
    )
    await screen.findByRole('dialog', { name: 'Kết thúc kế hoạch?' })
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Lý do (không bắt buộc)' }),
    )
    fireEvent.click(
      screen.getByRole('option', { name: 'Kế hoạch không còn phù hợp' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kết thúc' }))

    await waitFor(() =>
      expect(api.changeSupportPlanStatus).toHaveBeenCalledWith(
        active.supportPlanId,
        1,
        'COMPLETED',
        'PLAN_NO_LONGER_FITS',
      ),
    )
    expect(await screen.findByText('Đã kết thúc')).toBeVisible()
    expect(
      screen.getByText('Hoạt động đã được ghi nhận hoàn thành.'),
    ).toBeVisible()
    expect(api.getCurrentSupportPlan).toHaveBeenCalledTimes(2)
    expect(api.getSupportPlanHistory).toHaveBeenCalledTimes(2)
  })

  it('reconciles a terminal concurrency conflict and exposes only the persisted history state', async () => {
    const active = activePlan()
    const completed = {
      ...active,
      status: 'COMPLETED' as const,
      version: 2,
      updatedAt: '2026-09-21T05:00:00Z',
      completedAt: '2026-09-21T05:00:00Z',
      completionReason: null,
    }
    api.getCurrentSupportPlan
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(problem('SUPPORT_PLAN_CURRENT_NOT_FOUND', 404))
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_DRAFT_NOT_FOUND', 404),
    )
    api.changeSupportPlanStatus.mockRejectedValue(
      problem('SUPPORT_PLAN_VERSION_MISMATCH', 412),
    )
    api.getSupportPlanHistory
      .mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false })
      .mockResolvedValueOnce({
        items: [completed],
        nextCursor: null,
        hasMore: false,
      })

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kết thúc kế hoạch' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận kết thúc' }),
    )

    expect(await screen.findByText('Đã kết thúc')).toBeVisible()
    expect(
      screen.queryByText('Hoạt động đã được ghi nhận hoàn thành.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Kế hoạch đã thay đổi ở nơi khác/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Kết thúc kế hoạch' }),
    ).not.toBeInTheDocument()
    expect(api.getSupportPlanHistory).toHaveBeenCalledTimes(2)
  })
})
