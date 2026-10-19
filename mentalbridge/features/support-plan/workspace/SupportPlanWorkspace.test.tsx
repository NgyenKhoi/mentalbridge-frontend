import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  emotionActionId,
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  emotionOccurrenceId,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'

const api = vi.hoisted(() => ({
  getCurrentSupportPlanActions: vi.fn(),
  getCurrentNativeSupportPlanDraft: vi.fn(),
  getSupportPlanActionHistory: vi.fn(),
  getSupportPlanActionOccurrences: vi.fn(),
  getNativeSupportPlanEvaluationSource: vi.fn(),
  proposeNativeSupportPlanDraft: vi.fn(),
  activateNativeSupportPlan: vi.fn(),
  changeNativeSupportPlanStatus: vi.fn(),
  changeNativeActionOccurrenceState: vi.fn(),
  continueSupportPlanCycle: vi.fn(),
  reconcileEmotionCheckInOccurrence: vi.fn(),
  reconcileJournalOccurrence: vi.fn(),
  replaceNativeOccurrenceEngagement: vi.fn(),
  replaceWithNativeSupportPlan: vi.fn(),
  reviewNativeSupportPlanReplacement: vi.fn(),
  getSupportPlanActionModel: vi.fn(),
}))
const legacy = vi.hoisted(() => ({
  activateSupportPlan: vi.fn(),
  changeSupportPlanOccurrenceState: vi.fn(),
  changeSupportPlanStatus: vi.fn(),
  getCurrentSupportPlanDraft: vi.fn(),
  getSupportPlanOccurrences: vi.fn(),
  getSupportPlanPersonalization: vi.fn(),
  replaceSupportPlanActionSchedule: vi.fn(),
  replaceSupportPlanChoices: vi.fn(),
  replaceSupportPlanOccurrenceEngagement: vi.fn(),
  requestSupportPlanActionCompanionExplanation: vi.fn(),
}))
const journey = vi.hoisted(() => ({ getGuidedJourney: vi.fn() }))
const feedback = vi.hoisted(() => ({ confirm: vi.fn() }))
const care = vi.hoisted(() => ({ getCurrentReassessmentSummary: vi.fn() }))
const companionShell = vi.hoisted(() => ({ render: vi.fn() }))

vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('../api/browser-support-plan', () => legacy)
vi.mock('@/features/support-guide/api/browser-support-guide', () => journey)
vi.mock('@/features/assessment/api/browser-care', () => care)
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => feedback,
}))
vi.mock('../components/SupportPlanPersonalization', () => ({
  default: ({
    onSaved,
    onReviewPlan,
  }: {
    onSaved?: (saved: unknown) => void
    onReviewPlan: (reason: string) => void
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onSaved?.({
            value: {
              revision: 1,
              planReview: {
                required: true,
                reasonCode: 'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION',
              },
            },
            etag: '"1"',
          })
        }
      >
        Lưu tùy chọn
      </button>
      <button
        type="button"
        onClick={() => onReviewPlan('PREFERENCES_CHANGED_AFTER_DRAFT_CREATION')}
      >
        Xem bản đề xuất
      </button>
    </>
  ),
}))
vi.mock('../components/SupportPlanScheduleEditor', () => ({
  default: ({
    onSave,
    onDirtyChange,
  }: {
    onSave: (actionId: string, request: unknown, key: string) => Promise<void>
    onDirtyChange: (dirty: boolean) => void
  }) => (
    <>
      <button
        type="button"
        onClick={() => void onSave('action-1', {}, 'schedule-key')}
      >
        Lưu lịch
      </button>
      <button type="button" onClick={() => onDirtyChange(true)}>
        Sửa giờ
      </button>
      <button type="button" onClick={() => onDirtyChange(false)}>
        Hoàn tác giờ
      </button>
    </>
  ),
}))
vi.mock('../components/SupportPlanCompanionShell', () => ({
  default: (props: unknown) => {
    companionShell.render(props)
    return null
  },
  useSupportPlanCompanionMuted: () => false,
}))
vi.mock('../components/ProfessionalSupportPath', () => ({
  default: () => null,
}))
import SupportPlanWorkspace from './SupportPlanWorkspace'

const evaluationId = '90000000-0000-4000-8000-000000000669'
const notFound = () =>
  new ApiError({
    code: 'SUPPORT_PLAN_NOT_FOUND',
    status: 404,
    message: 'Missing',
  })

function readyJourney(overrides: Partial<GuidedJourney> = {}): GuidedJourney {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: '80000000-0000-4000-8000-000000000669',
    episodeCompletedAt: '2026-10-17T01:00:00Z',
    presentationEvaluationId: evaluationId,
    supportGuideId: 'a0000000-0000-4000-8000-000000000669',
    nextAction: 'START_PLAN_PROPOSAL',
    currentSupportPlanId: null,
    entitlementStatus: 'VERIFIED',
    ...overrides,
  }
}

function todayInPlan() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function occurrence(
  overrides: Partial<ActionOccurrence> = {},
): ActionOccurrence {
  return {
    ...emotionOccurrenceFixture(),
    localDate: todayInPlan(),
    scheduledAt: `${todayInPlan()}T12:00:00Z`,
    displayState: 'SCHEDULED',
    ...overrides,
  } as ActionOccurrence
}

function draftPlan(): SupportPlanV3 {
  return { ...nativeSupportPlanFixture(), status: 'DRAFT', activatedAt: null }
}

function withCurrent(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[] = [],
) {
  api.getCurrentSupportPlanActions.mockResolvedValue(plan)
  api.getCurrentNativeSupportPlanDraft.mockRejectedValue(notFound())
  api.getSupportPlanActionOccurrences.mockResolvedValue({
    supportPlanId: plan.supportPlanId,
    supportPlanStatus: plan.status,
    representationMode: plan.representationMode,
    from: todayInPlan(),
    through: todayInPlan(),
    occurrences,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  })
}

function withoutPlan(historyItems: SupportPlanV3[] = []) {
  api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
  api.getCurrentNativeSupportPlanDraft.mockRejectedValue(notFound())
  api.getSupportPlanActionHistory.mockResolvedValue({
    items: historyItems,
    nextCursor: null,
    hasMore: false,
  })
}

describe('SupportPlan workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    feedback.confirm.mockResolvedValue(true)
    journey.getGuidedJourney.mockResolvedValue(readyJourney())
    api.getNativeSupportPlanEvaluationSource.mockResolvedValue(evaluationId)
    legacy.getSupportPlanPersonalization.mockResolvedValue({
      value: { revision: 0 },
      etag: '"0"',
    })
    api.getSupportPlanActionHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
  })

  it('renders the current plan with one next action on Today', async () => {
    api.getCurrentSupportPlanActions.mockResolvedValue(
      nativeSupportPlanFixture(),
    )
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', { name: 'Check-in cảm xúc' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Ghi lại cảm xúc/ }),
    ).toHaveAttribute('href', expect.stringContaining('#emotion-check-in'))
    expect(screen.getByRole('tab', { name: 'Hôm nay' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('auto-proposes once with the deterministic key and shows the preview', async () => {
    withoutPlan()
    api.proposeNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    render(
      <StrictMode>
        <SupportPlanWorkspace />
      </StrictMode>,
    )
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    expect(screen.getByText(/phút mỗi ngày/)).toBeVisible()
    expect(screen.getByText('Việc đầu tiên')).toBeVisible()
    expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledTimes(1)
    expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledWith(
      evaluationId,
      `auto-proposal-${evaluationId}-p0`,
    )
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
  })

  it('retrying activation reuses the idempotency key', async () => {
    const user = userEvent.setup()
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    api.activateNativeSupportPlan
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(nativeSupportPlanFixture())
    withCurrent(nativeSupportPlanFixture(), [])
    api.getCurrentSupportPlanActions.mockRejectedValueOnce(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValueOnce(draftPlan())
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy thử lại')
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }))
    await screen.findByRole('tab', { name: 'Hôm nay' })
    const [first, second] = api.activateNativeSupportPlan.mock.calls
    expect(first[2]).toBe(second[2])
  })

  it('shows the plan grouped by focus with plain cadence', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [])
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Kế hoạch' }))
    expect(
      screen.getByRole('heading', { name: 'Một nhịp chăm sóc phù hợp' }),
    ).toBeVisible()
    expect(screen.getByText('Mỗi ngày · khoảng 5 phút')).toBeVisible()
  })

  it('auto-reconciles a matching emotion origin once', async () => {
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    api.reconcileEmotionCheckInOccurrence.mockResolvedValue({
      schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
      occurrenceId: emotionOccurrenceId,
      actionId: emotionActionId,
      localDate: todayInPlan(),
      sourceState: 'RECORDED',
      occurrenceState: 'COMPLETED',
      version: 1,
      completedAt: `${todayInPlan()}T13:00:00Z`,
      completionEvidence: null,
    })
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'emotion',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: todayInPlan(),
        }}
      />,
    )
    expect(
      await screen.findByText('Đã ghi nhận: Check-in cảm xúc.'),
    ).toBeInTheDocument()
    expect(api.reconcileEmotionCheckInOccurrence).toHaveBeenCalledTimes(1)
    expect(api.reconcileEmotionCheckInOccurrence).toHaveBeenCalledWith(
      emotionOccurrenceId,
    )
  })

  it('ignores a return origin that does not match a current occurrence', async () => {
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'journal',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: todayInPlan(),
          journalId: '70000000-0000-4000-8000-000000000642',
        }}
      />,
    )
    expect(
      await screen.findByText(/Không tìm thấy hoạt động bạn vừa mở/),
    ).toBeInTheDocument()
    expect(api.reconcileJournalOccurrence).not.toHaveBeenCalled()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
  })

  it('shows the FREE state when Care declines the proposal for the plan tier', async () => {
    withoutPlan()
    api.proposeNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({
        code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
        status: 403,
        message: 'Upgrade',
      }),
    )
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Kế hoạch theo ngày có trong gói Plus và Premium',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()
  })

  it('never auto-proposes after a previous plan', async () => {
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Bạn chưa có kế hoạch đang dùng',
      }),
    ).toBeVisible()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('grounds an explicit new proposal on the newest reassessment, falling back to the first check', async () => {
    const user = userEvent.setup()
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    api.getNativeSupportPlanEvaluationSource.mockImplementation(
      async (purpose: string) => {
        if (purpose === 'REASSESSMENT')
          throw new ApiError({
            code: 'REASSESSMENT_INCOMPLETE',
            status: 409,
            message: 'None',
          })
        return evaluationId
      },
    )
    api.proposeNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    expect(
      api.getNativeSupportPlanEvaluationSource.mock.calls.map(
        ([purpose]) => purpose,
      ),
    ).toEqual(['REASSESSMENT', 'INITIAL_CHECK'])
    expect(api.proposeNativeSupportPlanDraft.mock.calls[0][1]).not.toMatch(
      /^auto-proposal-/,
    )
  })

  it('puts safety help first and proposes nothing when the journey asks for it', async () => {
    withoutPlan()
    journey.getGuidedJourney.mockResolvedValue(
      readyJourney({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
    )
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('link', { name: 'Xem số hỗ trợ gần bạn' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('records helpfulness for a completed native activity', async () => {
    const user = userEvent.setup()
    const done = occurrence({ state: 'COMPLETED', displayState: 'COMPLETED' })
    withCurrent(nativeSupportPlanFixture(), [done])
    api.replaceNativeOccurrenceEngagement.mockResolvedValue({
      ...done,
      helpfulness: 'HELPFUL',
    })
    render(<SupportPlanWorkspace />)
    const group = await screen.findByRole('group', {
      name: /có giúp bạn không/i,
    })
    await user.click(within(group).getByRole('button', { name: 'Có' }))
    await waitFor(() =>
      expect(api.replaceNativeOccurrenceEngagement).toHaveBeenCalledWith(
        emotionOccurrenceId,
        done.version,
        expect.objectContaining({ state: 'COMPLETED', helpfulness: 'HELPFUL' }),
      ),
    )
  })

  it('progress renders separate facts and no percent sign', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [
      occurrence({ state: 'COMPLETED', displayState: 'COMPLETED' }),
    ])
    const { container } = render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Tiến triển' }))
    expect(await screen.findByText('1 ngày')).toBeVisible()
    expect(container.textContent).not.toContain('%')
  })

  it('pauses only after confirmation', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [])
    api.changeNativeSupportPlanStatus.mockResolvedValue({
      ...nativeSupportPlanFixture(),
      status: 'PAUSED',
    })
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Tạm dừng hoặc kết thúc'))
    feedback.confirm.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Tạm dừng kế hoạch' }))
    expect(api.changeNativeSupportPlanStatus).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Tạm dừng kế hoạch' }))
    await waitFor(() =>
      expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledWith(
        nativeSupportPlanFixture().supportPlanId,
        nativeSupportPlanFixture().version,
        { status: 'PAUSED' },
      ),
    )
  })

  it('makes the review the next step when due and keeps the plan only on request', async () => {
    const user = userEvent.setup()
    const due: SupportPlanV3 = {
      ...nativeSupportPlanFixture(),
      cycle: {
        policyVersion: 'support-plan-cycle-v1',
        lengthDays: 14,
        timezone: 'Asia/Ho_Chi_Minh',
        cycleNumber: 1,
        startedOn: '2026-10-01',
        reviewDueOn: '2026-10-14',
        currentDay: 14,
        pausedDays: 0,
        state: 'REVIEW_DUE',
      },
    }
    withCurrent(due, [occurrence()])
    api.continueSupportPlanCycle.mockResolvedValue({
      ...due,
      cycle: {
        ...due.cycle!,
        cycleNumber: 2,
        state: 'IN_PROGRESS',
        currentDay: 1,
      },
    })
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Đến lúc cùng xem lại kế hoạch',
      }),
    ).toBeVisible()
    expect(api.continueSupportPlanCycle).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Xem lại kế hoạch/ }))
    await user.click(
      await screen.findByRole('button', { name: 'Tiếp tục thêm 14 ngày' }),
    )
    await waitFor(() =>
      expect(api.continueSupportPlanCycle).toHaveBeenCalledWith(
        due.supportPlanId,
        due.version,
        expect.any(String),
      ),
    )
  })

  it('retries a lost continuation with the same key', async () => {
    const user = userEvent.setup()
    const due: SupportPlanV3 = {
      ...nativeSupportPlanFixture(),
      cycle: {
        policyVersion: 'support-plan-cycle-v1',
        lengthDays: 14,
        timezone: 'Asia/Ho_Chi_Minh',
        cycleNumber: 1,
        startedOn: '2026-10-01',
        reviewDueOn: '2026-10-14',
        currentDay: 14,
        pausedDays: 0,
        state: 'REVIEW_DUE',
      },
    }
    withCurrent(due, [])
    api.continueSupportPlanCycle
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        ...due,
        cycle: { ...due.cycle!, cycleNumber: 2, state: 'IN_PROGRESS' },
      })
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    const keep = await screen.findByRole('button', {
      name: 'Tiếp tục thêm 14 ngày',
    })
    await user.click(keep)
    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy thử lại')
    await user.click(keep)
    await waitFor(() =>
      expect(api.continueSupportPlanCycle).toHaveBeenCalledTimes(2),
    )
    const [first, second] = api.continueSupportPlanCycle.mock.calls
    expect(second[2]).toBe(first[2])
  })
})

const reassessmentId = '90000000-0000-4000-8000-000000000670'
const otherDraftId = 'b0000000-0000-4000-8000-000000000669'

function bySource() {
  api.getNativeSupportPlanEvaluationSource.mockImplementation(
    async (purpose: string) =>
      purpose === 'REASSESSMENT' ? reassessmentId : evaluationId,
  )
}

function adapterPlan(): SupportPlanV3 {
  const plan = nativeSupportPlanFixture()
  return JSON.parse(
    JSON.stringify(plan).replaceAll('"NATIVE_V3"', '"V2_RESOURCE_ADAPTER"'),
  ) as SupportPlanV3
}

function v1Row(overrides: Record<string, unknown> = {}) {
  return {
    occurrenceId: emotionOccurrenceId,
    version: 4,
    hidden: false,
    helpfulness: null,
    barrierCode: null,
    reflection: 'riêng tư',
    summaryReuseApproved: true,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function occurrenceList(plan: SupportPlanV3, occurrences: ActionOccurrence[]) {
  return {
    supportPlanId: plan.supportPlanId,
    supportPlanStatus: plan.status,
    representationMode: plan.representationMode,
    from: todayInPlan(),
    through: todayInPlan(),
    occurrences,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}

describe('SupportPlan workspace recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    feedback.confirm.mockResolvedValue(true)
    journey.getGuidedJourney.mockResolvedValue(readyJourney())
    api.getNativeSupportPlanEvaluationSource.mockResolvedValue(evaluationId)
    legacy.getSupportPlanPersonalization.mockResolvedValue({
      value: { revision: 0 },
      etag: '"0"',
    })
  })

  it('retries a lost explicit proposal from the same reassessment with the same key', async () => {
    const user = userEvent.setup()
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    // A newer reassessment completes elsewhere before the retry.
    api.getNativeSupportPlanEvaluationSource
      .mockResolvedValueOnce(reassessmentId)
      .mockResolvedValue(otherDraftId)
    api.proposeNativeSupportPlanDraft
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(draftPlan())
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    const [first, second] = api.proposeNativeSupportPlanDraft.mock.calls
    expect(first).toEqual([reassessmentId, expect.any(String)])
    expect(second).toEqual(first)
    expect(api.getNativeSupportPlanEvaluationSource).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh lookup after a definite proposal refusal', async () => {
    const user = userEvent.setup()
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    bySource()
    api.proposeNativeSupportPlanDraft
      .mockRejectedValueOnce(
        new ApiError({ code: 'CONFLICT', status: 409, message: 'No' }),
      )
      .mockResolvedValueOnce(draftPlan())
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' })
    const [first, second] = api.proposeNativeSupportPlanDraft.mock.calls
    expect(second[1]).not.toBe(first[1])
  })

  it('treats a missing reassessment as absent but keeps an outage an error', async () => {
    const user = userEvent.setup()
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    api.getNativeSupportPlanEvaluationSource.mockRejectedValue(
      new ApiError({ code: 'CARE_UNAVAILABLE', status: 503, message: 'Down' }),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa chuẩn bị được kế hoạch',
      }),
    ).toBeVisible()
    expect(
      api.getNativeSupportPlanEvaluationSource.mock.calls.map(([p]) => p),
    ).toEqual(['REASSESSMENT'])
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('regenerates from the same reassessment after saving preferences, then starts', async () => {
    const user = userEvent.setup()
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    bySource()
    const regenerated = { ...draftPlan(), supportPlanId: otherDraftId }
    api.proposeNativeSupportPlanDraft
      .mockResolvedValueOnce(draftPlan())
      .mockResolvedValueOnce(regenerated)
    api.changeNativeSupportPlanStatus.mockResolvedValue({
      ...draftPlan(),
      status: 'DISCARDED',
    })
    api.activateNativeSupportPlan.mockResolvedValue(nativeSupportPlanFixture())
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      occurrenceList(nativeSupportPlanFixture(), []),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' })
    legacy.getSupportPlanPersonalization.mockResolvedValue({
      value: { revision: 1 },
      etag: '"1"',
    })
    await user.click(screen.getByText('Điều chỉnh theo ý bạn (không bắt buộc)'))
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    await waitFor(() =>
      expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledTimes(2),
    )
    expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledWith(
      draftPlan().supportPlanId,
      draftPlan().version,
      { status: 'DISCARDED' },
    )
    expect(api.proposeNativeSupportPlanDraft.mock.calls[1]).toEqual([
      reassessmentId,
      `auto-proposal-${reassessmentId}-p1`,
    ])
    await user.click(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    )
    await waitFor(() =>
      expect(api.activateNativeSupportPlan).toHaveBeenCalledWith(
        otherDraftId,
        regenerated.version,
        expect.any(String),
      ),
    )
  })

  it('shows a discard at once and retries only the re-proposal', async () => {
    const user = userEvent.setup()
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    api.changeNativeSupportPlanStatus.mockResolvedValue({
      ...draftPlan(),
      status: 'DISCARDED',
    })
    api.proposeNativeSupportPlanDraft
      .mockRejectedValueOnce(
        new ApiError({
          code: 'SUPPORT_PLAN_TIME_BUDGET_INCOMPATIBLE',
          status: 409,
          message: 'Budget',
        }),
      )
      .mockResolvedValueOnce({ ...draftPlan(), supportPlanId: otherDraftId })
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByText('Điều chỉnh theo ý bạn (không bắt buộc)'),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa chuẩn bị được kế hoạch',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledTimes(1)
    const [first, second] = api.proposeNativeSupportPlanDraft.mock.calls
    expect(second).toEqual(first)
  })

  it('renders a replayed DISCARDED proposal as no draft with an explicit fresh proposal', async () => {
    const user = userEvent.setup()
    withoutPlan()
    api.proposeNativeSupportPlanDraft
      .mockResolvedValueOnce({ ...draftPlan(), status: 'DISCARDED' })
      .mockResolvedValueOnce(draftPlan())
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Kế hoạch này đã được cất vào lịch sử',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem đề xuất mới' }))
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    const [auto, fresh] = api.proposeNativeSupportPlanDraft.mock.calls
    expect(auto[1]).toBe(`auto-proposal-${evaluationId}-p0`)
    expect(fresh[1]).not.toMatch(/^auto-proposal-/)
  })

  it('reloads the plan when a proposal replay is already active', async () => {
    withoutPlan()
    api.proposeNativeSupportPlanDraft.mockImplementation(async () => {
      withCurrent(nativeSupportPlanFixture(), [occurrence()])
      return nativeSupportPlanFixture()
    })
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', { name: 'Check-in cảm xúc' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()
  })

  it('does not reconcile an origin from a prior day', async () => {
    withCurrent(nativeSupportPlanFixture(), [
      occurrence({ localDate: '2026-01-01' }),
    ])
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'emotion',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: '2026-01-01',
        }}
      />,
    )
    expect(
      await screen.findByText(/Không tìm thấy hoạt động bạn vừa mở/),
    ).toBeVisible()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
  })

  it('leaves a paused plan to explain itself and reconciles nothing', async () => {
    withCurrent({ ...nativeSupportPlanFixture(), status: 'PAUSED' }, [
      occurrence(),
    ])
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'emotion',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: todayInPlan(),
        }}
      />,
    )
    expect(
      await screen.findByRole('heading', { name: 'Kế hoạch đang tạm dừng' }),
    ).toBeVisible()
    expect(screen.queryByText(/Không tìm thấy hoạt động bạn vừa mở/)).toBeNull()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
  })

  it('keeps unsaved time edits: saving preferences does not discard the draft', async () => {
    const user = userEvent.setup()
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByText('Đổi giờ và nhịp'))
    await user.click(screen.getByRole('button', { name: 'Sửa giờ' }))
    await user.click(screen.getByText('Điều chỉnh theo ý bạn (không bắt buộc)'))
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hãy lưu hoặc hoàn tác thay đổi giờ',
    )
    expect(api.changeNativeSupportPlanStatus).not.toHaveBeenCalled()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    // Start explains why it waits instead of silently doing nothing.
    expect(
      screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toHaveAccessibleDescription(/Hãy lưu hoặc hoàn tác thay đổi đang dở/)
  })

  it('keeps Start blocked when the discard after saving preferences fails, then recovers with the fresh version', async () => {
    const user = userEvent.setup()
    const regenerated = { ...draftPlan(), supportPlanId: otherDraftId }
    const fresher = { ...draftPlan(), version: draftPlan().version + 1 }
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft
      .mockResolvedValueOnce(draftPlan())
      .mockResolvedValue(fresher)
    api.changeNativeSupportPlanStatus
      .mockRejectedValueOnce(
        new ApiError({
          code: 'SUPPORT_PLAN_VERSION_MISMATCH',
          status: 412,
          message: 'Stale',
        }),
      )
      .mockResolvedValueOnce({ ...fresher, status: 'DISCARDED' })
    api.proposeNativeSupportPlanDraft.mockResolvedValue(regenerated)
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByText('Điều chỉnh theo ý bạn (không bắt buộc)'),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kế hoạch vừa thay đổi ở nơi khác',
    )
    expect(
      screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeDisabled()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Xem bản đề xuất' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
      ).toBeEnabled(),
    )
    expect(api.changeNativeSupportPlanStatus).toHaveBeenLastCalledWith(
      fresher.supportPlanId,
      fresher.version,
      { status: 'DISCARDED' },
    )
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
  })

  it('regenerates when the discard landed but its reply was lost', async () => {
    const user = userEvent.setup()
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft
      .mockResolvedValueOnce(draftPlan())
      .mockRejectedValue(notFound())
    api.changeNativeSupportPlanStatus.mockRejectedValueOnce(
      new Error('network'),
    )
    api.proposeNativeSupportPlanDraft.mockResolvedValue({
      ...draftPlan(),
      supportPlanId: otherDraftId,
    })
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByText('Điều chỉnh theo ý bạn (không bắt buộc)'),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    await waitFor(() =>
      expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledTimes(1),
    )
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeEnabled()
    expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledTimes(1)
  })

  it('keeps a stale draft unstartable until it is regenerated after undoing time edits', async () => {
    const user = userEvent.setup()
    const regenerated = { ...draftPlan(), supportPlanId: otherDraftId }
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    api.changeNativeSupportPlanStatus.mockResolvedValue({
      ...draftPlan(),
      status: 'DISCARDED',
    })
    api.proposeNativeSupportPlanDraft.mockResolvedValue(regenerated)
    api.activateNativeSupportPlan.mockResolvedValue(nativeSupportPlanFixture())
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      occurrenceList(nativeSupportPlanFixture(), []),
    )
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByText('Đổi giờ và nhịp'))
    await user.click(screen.getByRole('button', { name: 'Sửa giờ' }))
    await user.click(screen.getByText('Điều chỉnh theo ý bạn (không bắt buộc)'))
    await user.click(screen.getByRole('button', { name: 'Lưu tùy chọn' }))
    await user.click(screen.getByRole('button', { name: 'Hoàn tác giờ' }))
    const start = screen.getByRole('button', { name: 'Bắt đầu kế hoạch' })
    expect(start).toBeDisabled()
    expect(
      screen.getByText(/để cập nhật kế hoạch trước khi bắt đầu/),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Xem bản đề xuất' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
      ).toBeEnabled(),
    )
    expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }))
    await waitFor(() =>
      expect(api.activateNativeSupportPlan).toHaveBeenCalledWith(
        otherDraftId,
        regenerated.version,
        expect.any(String),
      ),
    )
  })

  it('does not reconcile an origin whose action has ended', async () => {
    const plan = nativeSupportPlanFixture()
    const ended = JSON.parse(
      JSON.stringify(plan).replaceAll('"status":"ACTIVE"', '"status":"ENDED"'),
    ) as SupportPlanV3
    withCurrent({ ...ended, status: 'ACTIVE' }, [occurrence()])
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'emotion',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: todayInPlan(),
        }}
      />,
    )
    expect(
      await screen.findByText(/Không tìm thấy hoạt động bạn vừa mở/),
    ).toBeInTheDocument()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
  })

  it('keeps a command result when an older read lands afterwards', async () => {
    const user = userEvent.setup()
    const plan = nativeSupportPlanFixture()
    withCurrent(plan, [occurrence()])
    const late = deferred<ReturnType<typeof occurrenceList>>()
    legacy.replaceSupportPlanActionSchedule.mockResolvedValue({
      ...plan,
      version: 2,
    })
    render(<SupportPlanWorkspace />)
    await screen.findByRole('heading', { name: 'Check-in cảm xúc' })
    api.getSupportPlanActionOccurrences.mockReturnValueOnce(late.promise)
    await user.click(screen.getByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Lịch và thời lượng'))
    await user.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await waitFor(() =>
      expect(api.getSupportPlanActionOccurrences).toHaveBeenCalledTimes(2),
    )
    await user.click(screen.getByRole('tab', { name: 'Hôm nay' }))
    api.changeNativeActionOccurrenceState.mockResolvedValue(
      occurrence({ state: 'SKIPPED', displayState: 'SKIPPED', version: 1 }),
    )
    await user.click(screen.getByRole('button', { name: 'Để hôm khác' }))
    expect(
      await screen.findByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
    late.resolve(occurrenceList(plan, [occurrence()]))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
      ).toBeVisible(),
    )
    expect(screen.queryByRole('button', { name: 'Để hôm khác' })).toBeNull()
  })

  it('keeps a newer read when an older command reply lands afterwards', async () => {
    const user = userEvent.setup()
    const plan = nativeSupportPlanFixture()
    withCurrent(plan, [occurrence()])
    const reply = deferred<ActionOccurrence>()
    api.changeNativeActionOccurrenceState.mockReturnValue(reply.promise)
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('button', { name: 'Để hôm khác' }))
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      occurrenceList(plan, [
        occurrence({
          state: 'COMPLETED',
          displayState: 'COMPLETED',
          version: 2,
        }),
      ]),
    )
    await user.click(screen.getByRole('tab', { name: 'Điều chỉnh' }))
    legacy.replaceSupportPlanActionSchedule.mockResolvedValue({
      ...plan,
      version: 2,
    })
    await user.click(screen.getByText('Lịch và thời lượng'))
    await user.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await waitFor(() =>
      expect(api.getSupportPlanActionOccurrences).toHaveBeenCalledTimes(2),
    )
    reply.resolve(
      occurrence({ state: 'SKIPPED', displayState: 'SKIPPED', version: 1 }),
    )
    await user.click(screen.getByRole('tab', { name: 'Hôm nay' }))
    expect(await screen.findByText('Đã xong')).toBeVisible()
    expect(screen.queryByText('Để hôm khác', { selector: 'p' })).toBeNull()
  })

  it('rates and reopens adapter activities through the v1 engagement read', async () => {
    const user = userEvent.setup()
    const plan = adapterPlan()
    const done = occurrence({
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      representationMode: 'V2_RESOURCE_ADAPTER',
      version: 4,
    })
    withCurrent(plan, [done])
    legacy.getSupportPlanOccurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      occurrences: [v1Row({ state: 'COMPLETED' })],
    })
    legacy.replaceSupportPlanOccurrenceEngagement.mockResolvedValue(
      v1Row({ helpfulness: 'HELPFUL', version: 5 }),
    )
    render(<SupportPlanWorkspace />)
    const group = await screen.findByRole('group', {
      name: /có giúp bạn không/i,
    })
    await user.click(within(group).getByRole('button', { name: 'Có' }))
    await waitFor(() =>
      expect(
        legacy.replaceSupportPlanOccurrenceEngagement,
      ).toHaveBeenCalledWith(emotionOccurrenceId, 4, {
        state: 'COMPLETED',
        hidden: false,
        helpfulness: 'HELPFUL',
        barrierCode: null,
        reflection: 'riêng tư',
        summaryReuseApproved: true,
      }),
    )
    expect(api.replaceNativeOccurrenceEngagement).not.toHaveBeenCalled()
  })

  it('reopens a skipped adapter activity without outcome metadata', async () => {
    const user = userEvent.setup()
    const plan = adapterPlan()
    withCurrent(plan, [
      occurrence({
        state: 'SKIPPED',
        displayState: 'SKIPPED',
        representationMode: 'V2_RESOURCE_ADAPTER',
        version: 4,
      }),
    ])
    legacy.getSupportPlanOccurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      occurrences: [v1Row({ state: 'SKIPPED', barrierCode: 'LOW_ENERGY' })],
    })
    legacy.replaceSupportPlanOccurrenceEngagement.mockResolvedValue(
      v1Row({ state: 'SCHEDULED', version: 5 }),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: 'Làm lại hôm nay' }),
    )
    await waitFor(() =>
      expect(
        legacy.replaceSupportPlanOccurrenceEngagement,
      ).toHaveBeenCalledWith(emotionOccurrenceId, 4, {
        state: 'SCHEDULED',
        hidden: false,
        helpfulness: null,
        barrierCode: null,
        reflection: null,
        summaryReuseApproved: false,
      }),
    )
  })

  it('keeps an accepted Journal entry reachable while paused, without reconciling', async () => {
    const journalId = '70000000-0000-4000-8000-000000000642'
    const journalPlan = JSON.parse(
      JSON.stringify(nativeSupportPlanFixture()).replaceAll(
        '"actionType":"EMOTION_CHECK_IN"',
        '"actionType":"JOURNAL"',
      ),
    ) as SupportPlanV3
    withCurrent({ ...journalPlan, status: 'PAUSED' }, [
      occurrence({
        actionType: 'JOURNAL',
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        completionEvidence: {
          ...emotionCompletionFixture(),
          kind: 'JOURNAL_ENTRY',
          factId: journalId,
        },
      }),
    ])
    render(
      <SupportPlanWorkspace
        returnOrigin={{
          kind: 'journal',
          occurrenceId: emotionOccurrenceId,
          actionId: emotionActionId,
          localDate: todayInPlan(),
          journalId: '70000000-0000-4000-8000-000000000999',
        }}
      />,
    )
    expect(
      await screen.findByRole('link', { name: /^Xem bài đã viết/ }),
    ).toHaveAttribute('href', expect.stringContaining(`journalId=${journalId}`))
    expect(api.reconcileJournalOccurrence).not.toHaveBeenCalled()
  })

  it('hides adapter rating when the v1 engagement read is unavailable', async () => {
    const plan = adapterPlan()
    withCurrent(plan, [
      occurrence({
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        representationMode: 'V2_RESOURCE_ADAPTER',
      }),
    ])
    legacy.getSupportPlanOccurrences.mockRejectedValue(new Error('network'))
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('group', { name: /có giúp bạn không/i }),
    ).toBeNull()
  })

  it.each([
    ['rating', 'COMPLETED', 'SCHEDULED'],
    ['reopening', 'SKIPPED', 'COMPLETED'],
  ] as const)(
    'offers no adapter %s when the two reads disagree',
    async (_, shown, other) => {
      const plan = adapterPlan()
      withCurrent(plan, [
        occurrence({
          state: shown,
          displayState: shown,
          representationMode: 'V2_RESOURCE_ADAPTER',
          version: 4,
        }),
      ])
      // Another tab changed the row between the two reads.
      legacy.getSupportPlanOccurrences.mockResolvedValue({
        supportPlanId: plan.supportPlanId,
        occurrences: [v1Row({ state: other, version: 5 })],
      })
      render(<SupportPlanWorkspace />)
      expect(
        await screen.findByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('group', { name: /có giúp bạn không/i }),
      ).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Làm lại hôm nay' }),
      ).toBeNull()
      expect(
        legacy.replaceSupportPlanOccurrenceEngagement,
      ).not.toHaveBeenCalled()
    },
  )

  it('lets an older resource-based draft change its resource choices', async () => {
    const user = userEvent.setup()
    const draft = { ...adapterPlan(), status: 'DRAFT' as const, version: 3 }
    const resource = (id: string, title: string) => ({
      resourceId: id,
      contentVersion: '1',
      publicationId: id,
      role: 'PRIMARY' as const,
      category: 'BREATHING' as const,
      title,
      summary: `${title} ngắn.`,
    })
    const chosen = resource('d0000000-0000-4000-8000-000000000001', 'Thở 4-7-8')
    const other = resource('d0000000-0000-4000-8000-000000000002', 'Thở hộp')
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draft)
    legacy.getCurrentSupportPlanDraft.mockResolvedValue({
      supportPlanId: draft.supportPlanId,
      status: 'DRAFT',
      version: 3,
      slots: [
        {
          slotId: 'core-1',
          kind: 'CORE',
          targetDomain: 'ANXIETY_SYMPTOMS',
          purposeCode: 'CALM',
          selectedResource: chosen,
          allowedAlternatives: [other],
        },
      ],
    })
    legacy.replaceSupportPlanChoices.mockResolvedValue({
      supportPlanId: draft.supportPlanId,
      status: 'DRAFT',
      version: 4,
      slots: [],
    })
    api.getSupportPlanActionModel.mockResolvedValue({ ...draft, version: 4 })
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByText(/^Chọn nội dung/))
    await user.click(screen.getByRole('radio', { name: /Thở hộp/ }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await waitFor(() =>
      expect(legacy.replaceSupportPlanChoices).toHaveBeenCalledWith(
        draft.supportPlanId,
        3,
        {
          slotSelections: [
            {
              slotId: 'core-1',
              resourceId: other.resourceId,
              contentVersion: '1',
            },
          ],
        },
      ),
    )
  })

  it('shows no resource choices for a native draft', async () => {
    api.getCurrentSupportPlanActions.mockRejectedValue(notFound())
    api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    render(<SupportPlanWorkspace />)
    await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' })
    expect(screen.queryByText(/^Chọn nội dung/)).toBeNull()
    expect(legacy.getCurrentSupportPlanDraft).not.toHaveBeenCalled()
  })
})

describe('SupportPlan workspace day boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    journey.getGuidedJourney.mockResolvedValue(readyJourney())
    withCurrent(nativeSupportPlanFixture(), [])
  })
  afterEach(() => vi.useRealTimers())

  it('moves to the next local day at plan midnight and re-reads the plan', async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
    })
    // 23:59:30 in Asia/Ho_Chi_Minh.
    vi.setSystemTime(new Date('2026-10-17T16:59:30Z'))
    render(<SupportPlanWorkspace />)
    await screen.findByRole('tab', { name: 'Hôm nay' })
    await waitFor(() =>
      expect(api.getSupportPlanActionOccurrences).toHaveBeenLastCalledWith(
        '2026-10-11',
        '2026-10-24',
      ),
    )
    const reads = api.getCurrentSupportPlanActions.mock.calls.length
    await vi.advanceTimersByTimeAsync(31_000)
    await waitFor(() =>
      expect(
        api.getCurrentSupportPlanActions.mock.calls.length,
      ).toBeGreaterThan(reads),
    )
    await waitFor(() =>
      expect(api.getSupportPlanActionOccurrences).toHaveBeenLastCalledWith(
        '2026-10-12',
        '2026-10-25',
      ),
    )
  })

  it('re-reads the plan when a stale tab comes back on a new day', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-17T05:00:00Z'))
    render(<SupportPlanWorkspace />)
    await screen.findByRole('tab', { name: 'Hôm nay' })
    const reads = api.getCurrentSupportPlanActions.mock.calls.length
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(api.getCurrentSupportPlanActions).toHaveBeenCalledTimes(reads)
    vi.setSystemTime(new Date('2026-10-18T05:00:00Z'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() =>
      expect(
        api.getCurrentSupportPlanActions.mock.calls.length,
      ).toBeGreaterThan(reads),
    )
  })
})

describe('SupportPlan workspace replacement', () => {
  const current = nativeSupportPlanFixture()
  const replacement = { ...draftPlan(), supportPlanId: otherDraftId }
  const summaryId = 'c0000000-0000-4000-8000-000000000669'

  beforeEach(() => {
    vi.clearAllMocks()
    feedback.confirm.mockResolvedValue(true)
    journey.getGuidedJourney.mockResolvedValue(readyJourney())
    bySource()
    withCurrent(current, [])
    api.proposeNativeSupportPlanDraft.mockResolvedValue(replacement)
    care.getCurrentReassessmentSummary.mockResolvedValue({ summaryId })
    api.reviewNativeSupportPlanReplacement.mockResolvedValue({
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      reassessmentSummary: { summaryId },
      currentPlan: current,
      proposedPlan: replacement,
    })
  })

  async function reachConfirmation(user: ReturnType<typeof userEvent.setup>) {
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Phương án khác'))
    await user.click(screen.getByRole('button', { name: 'Xem phương án mới' }))
    await user.click(
      await screen.findByRole('button', {
        name: 'So sánh với kế hoạch hiện tại',
      }),
    )
    return screen.findByRole('button', { name: 'Chuyển sang phương án mới' })
  }

  it('proposes and reviews from the reassessment without touching the current plan', async () => {
    const user = userEvent.setup()
    await reachConfirmation(user)
    expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledWith(
      reassessmentId,
      expect.any(String),
    )
    expect(api.reviewNativeSupportPlanReplacement).toHaveBeenCalledWith(
      otherDraftId,
      replacement.version,
      {
        currentSupportPlanId: current.supportPlanId,
        currentVersion: current.version,
        reassessmentSummaryId: summaryId,
      },
    )
    expect(api.replaceWithNativeSupportPlan).not.toHaveBeenCalled()
    expect(api.changeNativeSupportPlanStatus).not.toHaveBeenCalled()
    expect(companionShell.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        guidedContext: expect.objectContaining({
          review: expect.objectContaining({
            outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
            currentPlan: current,
            proposedPlan: replacement,
          }),
        }),
      }),
    )
  })

  it('replaces only after confirmation and retries a lost reply with the same payload and key', async () => {
    const user = userEvent.setup()
    const confirmButton = await reachConfirmation(user)
    feedback.confirm.mockResolvedValueOnce(false)
    await user.click(confirmButton)
    expect(api.replaceWithNativeSupportPlan).not.toHaveBeenCalled()
    api.replaceWithNativeSupportPlan
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ...replacement, status: 'ACTIVE' })
    await user.click(confirmButton)
    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy thử lại')
    await user.click(confirmButton)
    await waitFor(() =>
      expect(api.replaceWithNativeSupportPlan).toHaveBeenCalledTimes(2),
    )
    const [first, second] = api.replaceWithNativeSupportPlan.mock.calls
    expect(second).toEqual(first)
    expect(first.slice(0, 3)).toEqual([
      otherDraftId,
      replacement.version,
      {
        currentSupportPlanId: current.supportPlanId,
        currentVersion: current.version,
        reassessmentSummaryId: summaryId,
      },
    ])
  })

  it('retries a lost replacement proposal with the same screening and key', async () => {
    const user = userEvent.setup()
    api.getNativeSupportPlanEvaluationSource
      .mockReset()
      .mockResolvedValueOnce(reassessmentId)
      .mockResolvedValue(otherDraftId)
    api.proposeNativeSupportPlanDraft
      .mockReset()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(replacement)
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Phương án khác'))
    const propose = screen.getByRole('button', { name: 'Xem phương án mới' })
    await user.click(propose)
    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy thử lại')
    await user.click(propose)
    await screen.findByRole('button', { name: 'So sánh với kế hoạch hiện tại' })
    const [first, second] = api.proposeNativeSupportPlanDraft.mock.calls
    expect(first[0]).toBe(reassessmentId)
    expect(second).toEqual(first)
  })

  it('keeps the current plan when a stale version is rejected', async () => {
    const user = userEvent.setup()
    const confirmButton = await reachConfirmation(user)
    api.replaceWithNativeSupportPlan.mockRejectedValue(
      new ApiError({
        code: 'SUPPORT_PLAN_VERSION_MISMATCH',
        status: 412,
        message: 'Stale',
      }),
    )
    const reads = api.getCurrentSupportPlanActions.mock.calls.length
    await user.click(confirmButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kế hoạch vừa thay đổi ở nơi khác',
    )
    expect(api.getCurrentSupportPlanActions).toHaveBeenCalledTimes(reads)
    expect(
      screen.getByRole('group', { name: 'So sánh hai phương án' }),
    ).toBeVisible()
  })
})
