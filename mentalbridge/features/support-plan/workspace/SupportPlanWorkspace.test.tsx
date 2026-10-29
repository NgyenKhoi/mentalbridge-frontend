import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { nativeSupportPlanReviewFixture } from '../testing/native-support-plan-review-fixture'
import { isMamFeatureSuppressed } from '@/features/mam/mam-suppression'
import {
  findMamTarget,
  findMamTargetElement,
  getMamPageTarget,
  getMamResolver,
  subscribeMamTargets,
} from '@/features/mam/use-mam-target'
import type { MamIntent } from '@/features/mam/mam-targets'
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
import {
  adaptiveConfirmationFixture,
  adaptiveReviewFixture,
} from '../testing/adaptive-review-fixture'

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
  getAdaptiveSupportPlanReview: vi.fn(),
  confirmAdaptiveReviewOption: vi.fn(),
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

const planAccess = vi.hoisted(() => ({
  access: { status: 'paid', pendingPayment: false } as {
    status: 'loading' | 'paid' | 'free' | 'expired' | 'unavailable'
    pendingPayment: boolean
  },
  retry: vi.fn(),
}))

vi.mock('@/features/support-plan-access/use-plan-access', () => ({
  usePlanAccess: () => planAccess,
}))
beforeEach(() => {
  planAccess.access = { status: 'paid', pendingPayment: false }
})
vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('../api/browser-support-plan', () => legacy)
vi.mock('@/features/support-guide/api/browser-support-guide', () => journey)
vi.mock('@/features/assessment/api/browser-care', () => care)
const emotion = vi.hoisted(() => ({ getEmotionCheckInProgress: vi.fn() }))
vi.mock(
  '@/features/emotion-check-in/api/browser-emotion-check-in',
  () => emotion,
)
beforeEach(() => {
  emotion.getEmotionCheckInProgress.mockRejectedValue(new Error('offline'))
})
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

  it.each(['RESOURCE_COMPLETION', 'RESOURCE_PRACTICE_SESSION'] as const)(
    'shows accepted %s evidence as done in Today and Progress without a state toggle',
    async (kind) => {
      const user = userEvent.setup()
      const plan = nativeSupportPlanFixture()
      plan.focuses[0].actions[0].actionType = 'RESOURCE'
      const completed = occurrence({
        actionType: 'RESOURCE',
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        completionEvidence: {
          ...emotionCompletionFixture(),
          ownerDomain: 'CONTENT',
          kind,
          factRevision: '4',
        },
      })
      withCurrent(plan, [completed])
      render(<SupportPlanWorkspace />)

      expect(
        await screen.findByText('Đã ghi nhận từ bài luyện tập'),
      ).toBeVisible()
      expect(
        screen.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', {
          name: /Làm lại hôm nay|Hoàn tác|Đã làm xong/,
        }),
      ).toBeNull()

      await user.click(screen.getByRole('tab', { name: 'Tiến triển' }))
      const resourceCount = screen
        .getByText('Đã ghi nhận từ bài luyện tập')
        .closest<HTMLElement>('.mbw-fact')!
      expect(within(resourceCount).getByText('1 lần đã làm')).toBeVisible()
      expect(api.changeNativeActionOccurrenceState).not.toHaveBeenCalled()
      expect(legacy.changeSupportPlanOccurrenceState).not.toHaveBeenCalled()
    },
  )

  it('keeps explicit Resource acknowledgement available until Care accepts evidence', async () => {
    const user = userEvent.setup()
    const plan = nativeSupportPlanFixture()
    plan.focuses[0].actions[0].actionType = 'RESOURCE'
    withCurrent(plan, [occurrence({ actionType: 'RESOURCE' })])
    render(<SupportPlanWorkspace />)

    expect(
      await screen.findByRole('button', { name: 'Đã làm xong' }),
    ).toBeEnabled()
    expect(screen.queryByText('Đã ghi nhận từ bài luyện tập')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Tiến triển' }))
    expect(screen.getByText('0 lần đã làm')).toBeVisible()
    expect(screen.queryByText('Đã ghi nhận từ bài luyện tập')).toBeNull()
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
        name: 'Kế hoạch 14 ngày có trong gói Plus',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeNull()
  })

  it('shows the labelled example to FREE without asking Care for a plan', async () => {
    planAccess.access = { status: 'free', pendingPayment: false }
    withoutPlan()
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByText('Ví dụ minh hoạ, không phải kế hoạch của bạn'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Nâng cấp Plus' })).toHaveAttribute(
      'href',
      '/subscription',
    )
    expect(screen.queryByText(/Đang chuẩn bị kế hoạch/)).toBeNull()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
  })

  it('says the package expired instead of offering a first upgrade', async () => {
    planAccess.access = { status: 'expired', pendingPayment: false }
    withoutPlan()
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', { name: 'Gói của bạn đã hết hạn' }),
    ).toBeVisible()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('F1 shows an example before screening and F3 keeps it after remount', async () => {
    planAccess.access = { status: 'free', pendingPayment: false }
    withoutPlan()
    journey.getGuidedJourney.mockResolvedValue(
      readyJourney({ stage: 'ASSESSMENT_REQUIRED', supportGuideId: null }),
    )
    const first = render(<SupportPlanWorkspace />)
    expect(await screen.findByRole('figure')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Làm bài kiểm tra ngắn' }),
    ).toHaveAttribute('href', '/initial-check')
    first.unmount()
    render(<SupportPlanWorkspace />)
    expect(await screen.findByRole('figure')).toBeVisible()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('F2 returns a FREE user to their saved Guide without a proposal', async () => {
    planAccess.access = { status: 'free', pendingPayment: false }
    withoutPlan()
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('link', { name: 'Xem lại gợi ý hỗ trợ' }),
    ).toHaveAttribute(
      'href',
      `/support-guides/${readyJourney().supportGuideId}`,
    )
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it.each(['loading', 'unavailable'] as const)(
    'U1 preserves history without an upsell while access is %s',
    async (status) => {
      planAccess.access = { status, pendingPayment: false }
      withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
      render(<SupportPlanWorkspace />)
      expect(
        await screen.findByRole('heading', {
          name: 'Bạn chưa có kế hoạch đang dùng',
        }),
      ).toBeVisible()
      expect(screen.queryByRole('link', { name: /Plus/ })).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Xem đề xuất mới' }),
      ).toBeNull()
      expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    },
  )

  it('T1 uses payment status for expired history with a pending purchase', async () => {
    planAccess.access = { status: 'expired', pendingPayment: true }
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('link', { name: 'Xem trạng thái thanh toán' }),
    ).toHaveAttribute('href', '/subscription')
    expect(screen.queryByRole('figure')).toBeNull()
  })

  it.each(['current', 'draft'] as const)(
    'E2 preserves an expired owned %s with a truthful notice',
    async (kind) => {
      planAccess.access = { status: 'expired', pendingPayment: false }
      if (kind === 'current') withCurrent(nativeSupportPlanFixture())
      else {
        withoutPlan()
        api.getCurrentNativeSupportPlanDraft.mockResolvedValue(draftPlan())
      }
      render(<SupportPlanWorkspace />)
      expect(
        await screen.findByRole('link', { name: 'gia hạn Plus' }),
      ).toBeVisible()
      expect(screen.queryByRole('figure')).toBeNull()
      expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
      if (kind === 'current')
        expect(screen.getByRole('tab', { name: 'Hôm nay' })).toBeVisible()
      else
        expect(
          screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
        ).toBeVisible()
    },
  )

  it('S1 suppresses renewal on an owned plan when the fresh journey requests safety help', async () => {
    planAccess.access = { status: 'expired', pendingPayment: false }
    withCurrent(nativeSupportPlanFixture())
    journey.getGuidedJourney.mockResolvedValue(
      readyJourney({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
    )
    render(<SupportPlanWorkspace />)
    expect(await screen.findByRole('tab', { name: 'Hôm nay' })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Plus/ })).toBeNull()
  })

  it('points a pending checkout to its status, not a second purchase', async () => {
    planAccess.access = { status: 'free', pendingPayment: true }
    withoutPlan()
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('link', { name: 'Xem trạng thái thanh toán' }),
    ).toHaveAttribute('href', '/subscription')
    expect(screen.queryByRole('link', { name: 'Nâng cấp Plus' })).toBeNull()
  })

  it('never turns an unreadable package into an upgrade offer', async () => {
    planAccess.access = { status: 'unavailable', pendingPayment: false }
    withoutPlan()
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa kiểm tra được gói của bạn',
      }),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Nâng cấp Plus' })).toBeNull()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(planAccess.retry).toHaveBeenCalled()
  })

  it('keeps an unrelated 403 a failure rather than the FREE example', async () => {
    withoutPlan()
    api.proposeNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({ code: 'FORBIDDEN', status: 403, message: 'No' }),
    )
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa chuẩn bị được kế hoạch',
      }),
    ).toBeVisible()
    expect(
      screen.queryByText('Ví dụ minh hoạ, không phải kế hoạch của bạn'),
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

  it('E2 keeps owned history visible after Care denies a fresh paid proposal', async () => {
    withoutPlan([{ ...nativeSupportPlanFixture(), status: 'COMPLETED' }])
    api.proposeNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({
        code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
        status: 403,
        message: 'Denied',
      }),
    )
    render(<SupportPlanWorkspace />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Xem đề xuất mới' }),
    )
    expect(
      await screen.findByRole('link', { name: 'Nâng cấp Plus' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Bạn chưa có kế hoạch đang dùng' }),
    ).toBeVisible()
    expect(screen.queryByRole('figure')).toBeNull()
  })

  it('R1 waits for paid access before proposing once', async () => {
    withoutPlan()
    planAccess.access = { status: 'loading', pendingPayment: false }
    api.proposeNativeSupportPlanDraft.mockResolvedValue(draftPlan())
    const { rerender } = render(<SupportPlanWorkspace />)
    expect(await screen.findByText('Đang kiểm tra gói của bạn…')).toBeVisible()
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    planAccess.access = { status: 'paid', pendingPayment: false }
    rerender(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    rerender(<SupportPlanWorkspace />)
    expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledTimes(1)
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
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

  it.each(['paid', 'free', 'expired', 'unavailable'] as const)(
    'S1 puts safety help first with %s access',
    async (status) => {
      planAccess.access = { status, pendingPayment: true }
      withoutPlan()
      journey.getGuidedJourney.mockResolvedValue(
        readyJourney({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
      )
      render(<SupportPlanWorkspace />)
      expect(
        await screen.findByRole('link', { name: 'Xem số hỗ trợ gần bạn' }),
      ).toHaveAttribute('href', '/safety-directory')
      expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
      expect(screen.queryByRole('link', { name: /Plus/ })).toBeNull()
      expect(screen.queryByRole('figure')).toBeNull()
    },
  )

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

  function duePlan(): SupportPlanV3 {
    return {
      ...nativeSupportPlanFixture(),
      cycle: adaptiveReviewFixture().cycle,
    }
  }

  it('makes the review the next step when due and keeps the plan only on an explicit choice', async () => {
    const user = userEvent.setup()
    const due = duePlan()
    withCurrent(due, [occurrence()])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    api.confirmAdaptiveReviewOption.mockResolvedValue(
      adaptiveConfirmationFixture('CYCLE_CONTINUED'),
    )
    render(<SupportPlanWorkspace />)
    expect(
      await screen.findByRole('heading', {
        name: 'Đến lúc cùng xem lại kế hoạch',
      }),
    ).toBeVisible()
    expect(api.getAdaptiveSupportPlanReview).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Xem lại kế hoạch/ }))

    const evidence = await screen.findByLabelText('Những gì đã ghi nhận')
    expect(
      within(evidence).getByText(/9 lần đã làm, 3 lần bỏ qua/),
    ).toBeVisible()
    expect(
      within(evidence).getByText(/2 lần bạn ghi là thiếu năng lượng/),
    ).toBeVisible()
    expect(within(evidence).getByText('Khó khăn hơn trước')).toBeVisible()
    expect(
      screen.getByText(/Hai bài sàng lọc đang đi theo hai hướng khác nhau/),
    ).toBeVisible()
    // Sources stay separate: no combined score, ring or verdict.
    expect(screen.queryByText(/\d+\s*điểm|\/27|\/21/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('meter')).toBeNull()

    // Nothing is preselected and nothing is applied until the user confirms.
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).not.toBeChecked()
    await user.click(
      screen.getByRole('radio', { name: /Giữ nhịp này thêm 14 ngày/ }),
    )
    expect(api.confirmAdaptiveReviewOption).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Giữ nhịp này thêm 14 ngày' }),
    )
    await waitFor(() =>
      expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledWith(
        due.supportPlanId,
        1,
        {
          reviewFingerprint: adaptiveReviewFixture().reviewFingerprint,
          optionId: 'keep-current-1',
          reassessmentSummaryId:
            adaptiveReviewFixture().reassessment.summary?.summaryId,
        },
        expect.any(String),
      ),
    )
    expect(api.continueSupportPlanCycle).not.toHaveBeenCalled()
  })

  it('retries a lost confirmation with the same key and a new choice with a new key', async () => {
    const user = userEvent.setup()
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    api.confirmAdaptiveReviewOption
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(adaptiveConfirmationFixture('SCHEDULE_UPDATED'))
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(
      await screen.findByRole('radio', { name: /Giữ nhịp này thêm 14 ngày/ }),
    )
    const keep = screen.getByRole('button', {
      name: 'Giữ nhịp này thêm 14 ngày',
    })
    await user.click(keep)
    expect(
      await screen.findByText(/Chưa xác nhận được kết quả/),
    ).toHaveTextContent('Hãy thử lại')
    await user.click(keep)
    await waitFor(() =>
      expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(2),
    )
    await user.click(screen.getByRole('radio', { name: /Làm nhẹ bớt/ }))
    expect(screen.getByText('7 ngày mỗi tuần → 4 ngày mỗi tuần')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Áp dụng thay đổi này' }),
    )
    await waitFor(() =>
      expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(3),
    )
    const [first, second, third] = api.confirmAdaptiveReviewOption.mock.calls
    expect(second[3]).toBe(first[3])
    expect(third[3]).not.toBe(first[3])
  })

  it('reloads the review after a stale choice and asks the user to choose again', async () => {
    const user = userEvent.setup()
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    api.confirmAdaptiveReviewOption.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'ADAPTIVE_REVIEW_STALE',
        message: 'Review changed.',
      }),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(await screen.findByRole('radio', { name: /Làm nhẹ bớt/ }))
    await user.click(
      screen.getByRole('button', { name: 'Áp dụng thay đổi này' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('hãy chọn lại')
    await waitFor(() =>
      expect(api.getAdaptiveSupportPlanReview).toHaveBeenCalledTimes(2),
    )
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).not.toBeChecked()
    expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(1)
  })

  it('compares a prepared replacement before switching and binds the draft to the choice', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    review.options.push({
      optionId: 'alternative-1',
      kind: 'ALTERNATIVE_ACTION',
      executionKind: 'PREPARE_REPLACEMENT',
      actionId: emotionActionId,
      focusId: null,
      rationaleCodes: ['REPEATED_NOT_A_GOOD_FIT'],
      evidenceRefs: [],
      conflictingEvidenceRefs: [],
      changes: [
        { field: 'ACTION', before: 'Check-in cảm xúc', after: 'Viết nhật ký' },
      ],
    })
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    const prepared = adaptiveConfirmationFixture(
      'DRAFT_PREPARED',
      'alternative-1',
    )
    api.confirmAdaptiveReviewOption
      .mockImplementationOnce(async () => {
        // Care now holds the DRAFT; the workspace reload reads it back.
        api.getCurrentNativeSupportPlanDraft.mockResolvedValue(prepared.draft)
        return prepared
      })
      .mockResolvedValueOnce(
        adaptiveConfirmationFixture('REPLACED', 'alternative-1'),
      )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(
      await screen.findByRole('radio', { name: /Thay bằng hoạt động khác/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xem phương án thay thế' }),
    )
    expect(
      await screen.findByRole('group', {
        name: 'So sánh kế hoạch hiện tại và phương án thay thế',
      }),
    ).toBeVisible()
    expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(1)
    await user.click(
      screen.getByRole('button', { name: 'Chuyển sang phương án này' }),
    )
    await waitFor(() =>
      expect(api.confirmAdaptiveReviewOption).toHaveBeenLastCalledWith(
        nativeSupportPlanFixture().supportPlanId,
        1,
        expect.objectContaining({
          optionId: 'alternative-1',
          proposedPlanId: prepared.draft?.supportPlanId,
          proposedVersion: prepared.draft?.version,
        }),
        expect.any(String),
      ),
    )
  })

  it('shows a visible keep outcome before the checkpoint and never claims a failed refresh undid a change', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    review.reviewState = 'EARLY'
    review.options[0] = {
      ...review.options[0],
      executionKind: 'NO_CHANGE',
    }
    withCurrent(nativeSupportPlanFixture(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    api.confirmAdaptiveReviewOption
      .mockResolvedValueOnce(adaptiveConfirmationFixture('KEPT'))
      .mockResolvedValueOnce(
        adaptiveConfirmationFixture(
          'SCHEDULE_UPDATED',
          review.options[1].optionId,
        ),
      )
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: /Điều chỉnh/ }))
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(
      await screen.findByRole('radio', { name: /Giữ kế hoạch như hiện tại/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Giữ kế hoạch' }))
    expect(
      await screen.findByText(/Bạn giữ kế hoạch như hiện tại/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Giữ kế hoạch' })).toBeNull()

    api.getCurrentSupportPlanActions.mockRejectedValue(new Error('offline'))
    await user.click(screen.getByRole('radio', { name: /Làm nhẹ bớt/ }))
    await user.click(
      screen.getByRole('button', { name: 'Áp dụng thay đổi này' }),
    )
    expect(await screen.findByText(/Đã cập nhật kế hoạch/)).toBeVisible()
    expect(screen.queryByText(/chưa thay đổi/)).toBeNull()
  })

  it('records an optional skip reason and reuses it only when the user ticks the box', async () => {
    const user = userEvent.setup()
    const skipped = occurrence({ state: 'SKIPPED', displayState: 'SKIPPED' })
    withCurrent(nativeSupportPlanFixture(), [skipped])
    api.replaceNativeOccurrenceEngagement.mockResolvedValue({
      ...skipped,
      barrierCode: 'LOW_ENERGY',
    })
    render(<SupportPlanWorkspace />)
    const group = await screen.findByRole('group', {
      name: /Vì sao để .* sang hôm khác/,
    })
    const reuse = within(group).getByRole('checkbox', {
      name: 'Dùng câu trả lời này khi xem lại kế hoạch',
    })
    expect(reuse).not.toBeChecked()
    await user.click(reuse)
    await user.click(
      within(group).getByRole('button', { name: 'Thiếu năng lượng' }),
    )
    await waitFor(() =>
      expect(api.replaceNativeOccurrenceEngagement).toHaveBeenCalledWith(
        emotionOccurrenceId,
        skipped.version,
        expect.objectContaining({
          state: 'SKIPPED',
          barrierCode: 'LOW_ENERGY',
          helpfulness: null,
          summaryReuseApproved: true,
        }),
      ),
    )
  })

  it('keeps an unticked helpfulness answer out of the plan review', async () => {
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
        expect.objectContaining({ summaryReuseApproved: false }),
      ),
    )
  })

  it('resumes a prepared draft after going back and asks to discard it before preparing another', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    const alternative = (optionId: string, after: string) => ({
      optionId,
      kind: 'ALTERNATIVE_ACTION' as const,
      executionKind: 'PREPARE_REPLACEMENT' as const,
      actionId: emotionActionId,
      focusId: null,
      rationaleCodes: ['REPEATED_NOT_A_GOOD_FIT'],
      evidenceRefs: [],
      conflictingEvidenceRefs: [],
      changes: [
        { field: 'ACTION' as const, before: 'Check-in cảm xúc', after },
      ],
    })
    review.options.push(alternative('alternative-1', 'Viết nhật ký'), {
      ...alternative('alternative-2', 'Thở chậm'),
      kind: 'DIFFERENT_FOCUS',
    })
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    const prepared = adaptiveConfirmationFixture(
      'DRAFT_PREPARED',
      'alternative-1',
    )
    api.confirmAdaptiveReviewOption.mockImplementationOnce(async () => {
      api.getCurrentNativeSupportPlanDraft.mockResolvedValue(prepared.draft)
      return prepared
    })
    feedback.confirm.mockResolvedValue(true)
    api.changeNativeSupportPlanStatus.mockImplementation(async () => {
      api.getCurrentNativeSupportPlanDraft.mockRejectedValue(notFound())
      return { ...prepared.draft, status: 'DISCARDED' }
    })
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(
      await screen.findByRole('radio', { name: /Thay bằng hoạt động khác/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xem phương án thay thế' }),
    )
    const compare = await screen.findByRole('group', {
      name: 'So sánh kế hoạch hiện tại và phương án thay thế',
    })
    expect(compare).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Quay lại các lựa chọn' }),
    )
    expect(
      screen.getByText('Đã chuẩn bị phương án, chưa áp dụng.'),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'So sánh phương án đã chuẩn bị' }),
    )
    expect(
      await screen.findByRole('group', {
        name: 'So sánh kế hoạch hiện tại và phương án thay thế',
      }),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Quay lại các lựa chọn' }),
    )
    await user.click(screen.getByRole('radio', { name: /Đổi thứ tự ưu tiên/ }))
    expect(
      screen.getByText(/Hãy bỏ phương án đó trước khi chuẩn bị phương án mới/),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Bỏ phương án đã chuẩn bị' }),
    )
    await waitFor(() =>
      expect(api.changeNativeSupportPlanStatus).toHaveBeenCalledWith(
        prepared.draft?.supportPlanId,
        prepared.draft?.version,
        { status: 'DISCARDED' },
      ),
    )
    expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Xem phương án thay thế' }),
    ).toBeVisible()
  })

  it('shows the exact-period self-report without a summary and a deleted one as deleted', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    review.reassessment = {
      state: 'NOT_STARTED',
      reasonCode: 'REASSESSMENT_NOT_SUBMITTED',
      summary: null,
    }
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValueOnce(review)
    const { unmount } = render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    const evidence = await screen.findByRole('group', {
      name: 'Những gì đã ghi nhận',
    })
    expect(within(evidence).getByText('Khó khăn hơn trước')).toBeVisible()
    expect(
      screen.getByRole('radio', { name: /Dựa trên: Cảm nhận bạn đã chia sẻ/ }),
    ).toBeVisible()
    unmount()

    const deleted = adaptiveReviewFixture()
    deleted.evidenceContext = {
      ...deleted.evidenceContext!,
      selfReportedExperience: {
        state: 'INSUFFICIENT_DATA',
        unavailableReason: 'SOURCE_DELETED',
        source: null,
      },
    }
    api.getAdaptiveSupportPlanReview.mockResolvedValueOnce(deleted)
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    expect(
      await screen.findByText(/Bạn đã xoá câu trả lời cho giai đoạn này/),
    ).toBeVisible()
    expect(screen.queryByText('Khó khăn hơn trước')).toBeNull()
  })

  it('offers keep only when Care does and names each reassessment state', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    review.currentAdmission = 'INADMISSIBLE'
    review.outcome = 'CURRENT_PLAN_NOT_ADMISSIBLE'
    review.options = review.options.filter(
      (option) => option.kind !== 'KEEP_CURRENT',
    )
    review.reassessment = { ...review.reassessment, state: 'STALE' }
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    expect(
      await screen.findByText(/Bài kiểm tra lại cần được cập nhật/),
    ).toBeVisible()
    expect(screen.queryByText(/Bạn vẫn có thể giữ kế hoạch/)).toBeNull()
    expect(
      screen.getByText(/Kế hoạch hiện tại không còn phù hợp/),
    ).toBeVisible()
  })

  it('keeps the prepared draft bound to its option when discard is canceled or fails', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    const replacement = (
      optionId: string,
      kind: 'ALTERNATIVE_ACTION' | 'DIFFERENT_FOCUS',
    ) => ({
      optionId,
      kind,
      executionKind: 'PREPARE_REPLACEMENT' as const,
      actionId: emotionActionId,
      focusId: null,
      rationaleCodes: ['REPEATED_NOT_A_GOOD_FIT'],
      evidenceRefs: [],
      conflictingEvidenceRefs: [],
      changes: [],
    })
    review.options.push(
      replacement('alternative-1', 'ALTERNATIVE_ACTION'),
      replacement('focus-1', 'DIFFERENT_FOCUS'),
    )
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    const prepared = adaptiveConfirmationFixture(
      'DRAFT_PREPARED',
      'alternative-1',
    )
    api.confirmAdaptiveReviewOption.mockImplementationOnce(async () => {
      api.getCurrentNativeSupportPlanDraft.mockResolvedValue(prepared.draft)
      return prepared
    })
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(
      await screen.findByRole('radio', { name: /Thay bằng hoạt động khác/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xem phương án thay thế' }),
    )
    await screen.findByRole('group', {
      name: 'So sánh kế hoạch hiện tại và phương án thay thế',
    })
    await user.click(
      screen.getByRole('button', { name: 'Quay lại các lựa chọn' }),
    )
    // Cancel the discard confirmation, then let a confirmed discard fail.
    feedback.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    api.changeNativeSupportPlanStatus.mockRejectedValueOnce(
      new Error('offline'),
    )
    for (let attempt = 0; attempt < 2; attempt++) {
      await user.click(
        screen.getByRole('radio', { name: /Đổi thứ tự ưu tiên/ }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Bỏ phương án đã chuẩn bị' }),
      )
      await waitFor(() =>
        expect(feedback.confirm).toHaveBeenCalledTimes(attempt + 1),
      )
      await user.click(
        screen.getByRole('radio', { name: /Thay bằng hoạt động khác/ }),
      )
      // Still bound: the same option reopens its comparison, no discard step.
      expect(
        await screen.findByRole('group', {
          name: 'So sánh kế hoạch hiện tại và phương án thay thế',
        }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Bỏ phương án đã chuẩn bị' }),
      ).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Quay lại các lựa chọn' }),
      )
    }
    expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed 412 recovery stale and unconfirmable until a reload succeeds', async () => {
    const user = userEvent.setup()
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    api.confirmAdaptiveReviewOption.mockRejectedValueOnce(
      new ApiError({
        status: 412,
        code: 'SUPPORT_PLAN_VERSION_MISMATCH',
        message: 'Changed.',
      }),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(await screen.findByRole('radio', { name: /Làm nhẹ bớt/ }))
    api.getCurrentSupportPlanActions.mockRejectedValueOnce(new Error('offline'))
    await user.click(
      screen.getByRole('button', { name: 'Áp dụng thay đổi này' }),
    )
    expect(await screen.findByText(/Chưa tải lại được kế hoạch/)).toBeVisible()
    expect(screen.queryByText(/Phần xem lại đã được cập nhật/)).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Áp dụng thay đổi này' }),
    ).toBeNull()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
      expect(radio).toBeDisabled()
    }
    await user.click(
      screen.getByRole('button', { name: 'Tải lại phần xem lại' }),
    )
    await waitFor(() => {
      for (const radio of screen.getAllByRole('radio'))
        expect(radio).toBeEnabled()
    })
    expect(api.confirmAdaptiveReviewOption).toHaveBeenCalledTimes(1)
  })

  it('reloads the plan and the review after a 412 and requires a new choice', async () => {
    const user = userEvent.setup()
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    api.confirmAdaptiveReviewOption.mockRejectedValueOnce(
      new ApiError({
        status: 412,
        code: 'SUPPORT_PLAN_VERSION_MISMATCH',
        message: 'Changed.',
      }),
    )
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    await user.click(await screen.findByRole('radio', { name: /Làm nhẹ bớt/ }))
    const plansBefore = api.getCurrentSupportPlanActions.mock.calls.length
    await user.click(
      screen.getByRole('button', { name: 'Áp dụng thay đổi này' }),
    )
    expect(
      await screen.findByText(/Kế hoạch vừa thay đổi ở nơi khác/),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        api.getCurrentSupportPlanActions.mock.calls.length,
      ).toBeGreaterThan(plansBefore),
    )
    await waitFor(() =>
      expect(api.getAdaptiveSupportPlanReview).toHaveBeenCalledTimes(2),
    )
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).not.toBeChecked()
  })

  it('shows dated Emotion check-in coverage separately and keeps the review when it fails', async () => {
    const user = userEvent.setup()
    emotion.getEmotionCheckInProgress.mockResolvedValueOnce({
      asOfLocalDate: '2026-10-17',
      timezone: 'Asia/Ho_Chi_Minh',
      currentEmotion: null,
      currentStreak: 2,
      longestStreak: 4,
      windows: [7, 14, 30].map((totalDays) => ({
        totalDays,
        checkedInDays: totalDays === 14 ? 9 : 3,
        distribution: {},
      })),
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
    })
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    expect(
      await screen.findByText(/9 trong 14 ngày gần nhất có ghi lại/),
    ).toBeVisible()
    expect(screen.getByText(/17\/10\/2026/)).toBeVisible()
    expect(
      screen.getByText('Chỉ để bạn tham khảo, không dùng cho gợi ý.'),
    ).toBeVisible()
    expect(api.confirmAdaptiveReviewOption).not.toHaveBeenCalled()
  })

  it('reopens the review when returning from the reassessment it asked for', async () => {
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
    render(<SupportPlanWorkspace openReview />)
    expect(
      await screen.findByRole('group', { name: 'Những gì đã ghi nhận' }),
    ).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Điều chỉnh' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(api.confirmAdaptiveReviewOption).not.toHaveBeenCalled()
  })

  it('offers professional support as navigation only and explains missing reassessment', async () => {
    const user = userEvent.setup()
    const review = adaptiveReviewFixture()
    review.reassessment = {
      state: 'NOT_STARTED',
      reasonCode: 'REASSESSMENT_NOT_SUBMITTED',
      summary: null,
    }
    review.contradictions = []
    withCurrent(duePlan(), [])
    api.getAdaptiveSupportPlanReview.mockResolvedValue(review)
    render(<SupportPlanWorkspace />)
    await user.click(
      await screen.findByRole('button', { name: /Xem lại kế hoạch/ }),
    )
    expect(
      await screen.findByText(/Bạn chưa làm bài kiểm tra lại/),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Làm bài kiểm tra lại' }),
    ).toHaveAttribute(
      'href',
      '/initial-check?purpose=reassessment&returnTo=plan-review',
    )
    await user.click(
      screen.getByRole('radio', { name: /Trao đổi với chuyên gia/ }),
    )
    expect(
      within(document.getElementById('mbw-review')!).getByRole('link', {
        name: 'Tìm chuyên gia',
      }),
    ).toHaveAttribute('href', '/specialists')
    expect(api.confirmAdaptiveReviewOption).not.toHaveBeenCalled()
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

  async function reachConfirmation(
    user: ReturnType<typeof userEvent.setup>,
    mamEnabled = false,
  ) {
    render(<SupportPlanWorkspace mamEnabled={mamEnabled} />)
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
  })

  it('opens the review reading inline with the global Mầm, with no model call and no mutation', async () => {
    const user = userEvent.setup()
    api.reviewNativeSupportPlanReplacement.mockResolvedValue({
      ...nativeSupportPlanReviewFixture(),
      currentPlan: current,
      proposedPlan: replacement,
    })
    await reachConfirmation(user, true)
    const toggle = screen.getByRole('button', {
      name: 'Mầm xem lại tuần của bạn',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('region', { name: 'Mầm xem lại tuần của bạn' }),
    ).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const reading = await screen.findByRole('region', {
      name: 'Mầm xem lại tuần của bạn',
    })
    expect(toggle).toHaveAttribute('aria-controls', reading.id)
    expect(
      within(reading).getByText('Điều MentalBridge đã ghi nhận'),
    ).toBeVisible()
    expect(
      within(reading).queryByRole('button', {
        name: /Xem chi tiết tại mục Điều chỉnh/,
      }),
    ).toBeNull()
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()
    expect(api.replaceWithNativeSupportPlan).not.toHaveBeenCalled()
    expect(api.changeNativeSupportPlanStatus).not.toHaveBeenCalled()

    await user.click(within(reading).getByRole('button', { name: 'Thu gọn' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Mầm xem lại tuần của bạn' }),
      ).toBeNull(),
    )
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('has no Mầm review button with the legacy presentation', async () => {
    const user = userEvent.setup()
    await reachConfirmation(user)
    expect(
      screen.queryByRole('button', { name: 'Mầm xem lại tuần của bạn' }),
    ).toBeNull()
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

describe('SupportPlan workspace with the global Mầm', () => {
  const signal = new AbortController().signal
  const isRegistered = (kind: Parameters<typeof findMamTargetElement>[0]) =>
    findMamTargetElement(kind) !== null
  const ask = (element: Element, intent: MamIntent = 'EXPLAIN') => {
    const found = findMamTarget(element)
    return getMamResolver(found!.target)!(intent, { signal, isRegistered })
  }
  const askPage = (intent: MamIntent) =>
    getMamResolver(getMamPageTarget()!)!(intent, { signal, isRegistered })
  const cardOf = async (title: string) =>
    (await screen.findByRole('heading', { name: title })).closest('section')!
  const resourcePlan = () => {
    const plan = nativeSupportPlanFixture()
    plan.focuses[0].actions[0].actionType = 'RESOURCE'
    return plan
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    feedback.confirm.mockResolvedValue(true)
    journey.getGuidedJourney.mockResolvedValue(readyJourney())
    api.getNativeSupportPlanEvaluationSource.mockResolvedValue(evaluationId)
    legacy.getSupportPlanPersonalization.mockResolvedValue({
      value: { revision: 0 },
      etag: '"0"',
    })
  })

  it('swaps the legacy entry for Mầm and asks nothing on entry', async () => {
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace mamEnabled />)
    const card = await cardOf('Check-in cảm xúc')
    expect(
      within(card).getByRole('button', {
        name: 'Mầm giải thích: Check-in cảm xúc',
      }),
    ).toBeVisible()
    expect(screen.queryByText('Giải thích')).toBeNull()
    expect(document.querySelector('.mbw-aside')).toBeNull()
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()
  })

  it('keeps only the per-card Giải thích pill, no aside and no Mầm button, with the flag off', async () => {
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace />)
    const card = await cardOf('Check-in cảm xúc')
    expect(within(card).getByText('Giải thích')).toBeVisible()
    expect(document.querySelector('.mbw-aside')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Mầm giải thích/ })).toBeNull()
    expect(getMamPageTarget()).toBeNull()
  })

  it('shares one Care request per action and answers with text only', async () => {
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    legacy.requestSupportPlanActionCompanionExplanation.mockResolvedValueOnce({
      text: 'Check-in giúp bạn gọi tên cảm xúc.',
      delivery: 'GENERATED',
    })
    render(<SupportPlanWorkspace mamEnabled />)
    const card = await cardOf('Check-in cảm xúc')

    const [first, second] = await Promise.all([ask(card), ask(card)])
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledWith(
      nativeSupportPlanFixture().supportPlanId,
      emotionActionId,
      'TODAY',
      expect.any(AbortSignal),
    )
    expect(first).toBe(second)
    expect(first).toEqual({
      text: 'Check-in giúp bạn gọi tên cảm xúc.',
      generated: true,
    })

    // A template answer is not marked as generated; a failure rejects.
    legacy.requestSupportPlanActionCompanionExplanation.mockResolvedValueOnce({
      text: 'Mẫu có sẵn.',
      delivery: 'TEMPLATE',
    })
    const template = await ask(card)
    expect(template).toEqual({ text: 'Mẫu có sẵn.' })
    legacy.requestSupportPlanActionCompanionExplanation.mockRejectedValueOnce(
      new Error('offline'),
    )
    await expect(ask(card)).rejects.toThrow('offline')
  })

  it('puts the Mầm button on Plan rows and asks for the PLAN surface', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    legacy.requestSupportPlanActionCompanionExplanation.mockResolvedValue({
      text: 'Hoạt động này nằm trong kế hoạch.',
      delivery: 'TEMPLATE',
    })
    render(<SupportPlanWorkspace mamEnabled />)
    await user.click(await screen.findByRole('tab', { name: 'Kế hoạch' }))
    const button = await screen.findByRole('button', {
      name: 'Mầm giải thích: Check-in cảm xúc',
    })
    expect(screen.queryByText('Giải thích')).toBeNull()
    await ask(button.closest('li')!)
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledWith(
      nativeSupportPlanFixture().supportPlanId,
      emotionActionId,
      'PLAN',
      expect.any(AbortSignal),
    )
  })

  it('answers the dock starters from the tab and the real Today focus, with no request', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace mamEnabled />)
    await cardOf('Check-in cảm xúc')
    expect(await askPage('EXPLAIN')).toEqual({
      text: expect.stringContaining('Tab Hôm nay'),
    })
    expect(await askPage('WHERE_TO_START')).toEqual({
      text: 'Việc nên làm tiếp: “Check-in cảm xúc”.',
      focusKind: 'support-plan.focus',
      focusLabel: 'Đến việc này',
    })

    await user.click(screen.getByRole('tab', { name: 'Kế hoạch' }))
    expect(await askPage('EXPLAIN')).toEqual({
      text: expect.stringContaining('Tab Kế hoạch'),
    })
    // The focus card is no longer on the page, so there is nothing to lead to.
    expect(await askPage('WHERE_TO_START')).toEqual({
      text: 'Việc nên làm tiếp: “Check-in cảm xúc”. Mở tab Hôm nay để làm.',
    })
    expect(
      legacy.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()
  })

  it('has no page target while there is no plan', async () => {
    withoutPlan()
    render(<SupportPlanWorkspace mamEnabled />)
    await screen.findByText('Chưa có kế hoạch')
    expect(getMamPageTarget()).toBeNull()
  })

  describe('save acknowledgement', () => {
    const saved = vi.fn()
    beforeEach(() => {
      saved.mockClear()
      window.addEventListener('mam:saved', saved)
      withCurrent(resourcePlan(), [occurrence({ actionType: 'RESOURCE' })])
    })
    afterEach(() => window.removeEventListener('mam:saved', saved))

    it('fires once, only after Care confirms the acknowledgement', async () => {
      const user = userEvent.setup()
      let confirm!: (value: unknown) => void
      api.changeNativeActionOccurrenceState.mockReturnValue(
        new Promise((resolve) => {
          confirm = resolve
        }),
      )
      render(<SupportPlanWorkspace mamEnabled />)
      await user.click(
        await screen.findByRole('button', { name: 'Đã làm xong' }),
      )
      expect(api.changeNativeActionOccurrenceState).toHaveBeenCalledTimes(1)
      expect(saved).not.toHaveBeenCalled()

      await act(async () => {
        confirm({
          ...occurrence({ actionType: 'RESOURCE' }),
          state: 'COMPLETED',
          version: 2,
        })
      })
      await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    })

    it('stays silent when the delayed reply arrives after leaving the screen', async () => {
      const user = userEvent.setup()
      let confirm!: (value: unknown) => void
      api.changeNativeActionOccurrenceState.mockReturnValue(
        new Promise((resolve) => {
          confirm = resolve
        }),
      )
      const { unmount } = render(<SupportPlanWorkspace mamEnabled />)
      await user.click(
        await screen.findByRole('button', { name: 'Đã làm xong' }),
      )
      expect(api.changeNativeActionOccurrenceState).toHaveBeenCalledTimes(1)
      unmount()
      await act(async () => {
        confirm({
          ...occurrence({ actionType: 'RESOURCE' }),
          state: 'COMPLETED',
          version: 2,
        })
      })
      expect(saved).not.toHaveBeenCalled()
    })

    it('stays silent when Care rejects it', async () => {
      const user = userEvent.setup()
      api.changeNativeActionOccurrenceState.mockRejectedValue(
        new Error('offline'),
      )
      render(<SupportPlanWorkspace mamEnabled />)
      await user.click(
        await screen.findByRole('button', { name: 'Đã làm xong' }),
      )
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(saved).not.toHaveBeenCalled()
    })

    it('does not fire for skipping, or with the flag off', async () => {
      const user = userEvent.setup()
      api.changeNativeActionOccurrenceState.mockImplementation(
        async (id: string, version: number, state: string) => ({
          ...occurrence({ actionType: 'RESOURCE' }),
          occurrenceId: id,
          state,
          version: version + 1,
        }),
      )
      const { unmount } = render(<SupportPlanWorkspace mamEnabled />)
      await user.click(
        await screen.findByRole('button', { name: 'Để hôm khác' }),
      )
      await waitFor(() =>
        expect(api.changeNativeActionOccurrenceState).toHaveBeenCalled(),
      )
      expect(saved).not.toHaveBeenCalled()
      unmount()

      render(<SupportPlanWorkspace />)
      await user.click(
        await screen.findByRole('button', { name: 'Đã làm xong' }),
      )
      await waitFor(() =>
        expect(api.changeNativeActionOccurrenceState).toHaveBeenCalledTimes(2),
      )
      expect(saved).not.toHaveBeenCalled()
    })
  })

  it('reports unsaved edits to Mầm as a no-interrupt zone until they are undone', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace mamEnabled />)
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Lịch và thời lượng'))
    expect(isMamFeatureSuppressed()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Sửa giờ' }))
    expect(isMamFeatureSuppressed()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Hoàn tác giờ' }))
    expect(isMamFeatureSuppressed()).toBe(false)
  })

  describe('safety-first states', () => {
    it('removes every Mầm control on an active plan in a positive safety screen, and restores them after', async () => {
      const plan = resourcePlan()
      plan.safety.status = 'POSITIVE_SAFETY_SCREEN'
      withCurrent(plan, [occurrence({ actionType: 'RESOURCE' })])
      const { unmount } = render(<SupportPlanWorkspace mamEnabled />)
      await waitFor(() => expect(isMamFeatureSuppressed()).toBe(true))
      // The safety actions stay; no Mầm character remains, so no summon.
      expect(
        screen.getByRole('link', { name: 'Xem số hỗ trợ gần bạn' }),
      ).toHaveAttribute('href', '/safety-directory')
      expect(
        screen.queryByRole('button', {
          name: 'Mầm giải thích: Check-in cảm xúc',
        }),
      ).toBeNull()
      expect(
        legacy.requestSupportPlanActionCompanionExplanation,
      ).not.toHaveBeenCalled()
      unmount()
      expect(isMamFeatureSuppressed()).toBe(false)

      // Once the safety state is gone the same control is back.
      withCurrent(resourcePlan(), [occurrence({ actionType: 'RESOURCE' })])
      render(<SupportPlanWorkspace mamEnabled />)
      expect(
        await screen.findByRole('button', {
          name: 'Mầm giải thích: Check-in cảm xúc',
        }),
      ).toBeInTheDocument()
    })

    it('suppresses Mầm in the no-plan safety view', async () => {
      withoutPlan()
      journey.getGuidedJourney.mockResolvedValue(
        readyJourney({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
      )
      const { unmount } = render(<SupportPlanWorkspace mamEnabled />)
      await screen.findByRole('link', { name: 'Xem số hỗ trợ gần bạn' })
      expect(isMamFeatureSuppressed()).toBe(true)
      expect(getMamPageTarget()).toBeNull()
      unmount()
      expect(isMamFeatureSuppressed()).toBe(false)
    })

    it('does not suppress a normal plan, or any plan with the flag off', async () => {
      withCurrent(nativeSupportPlanFixture(), [occurrence()])
      const { unmount } = render(<SupportPlanWorkspace mamEnabled />)
      await cardOf('Check-in cảm xúc')
      expect(isMamFeatureSuppressed()).toBe(false)
      unmount()

      const plan = nativeSupportPlanFixture()
      plan.safety.status = 'POSITIVE_SAFETY_SCREEN'
      withCurrent(plan, [occurrence()])
      render(<SupportPlanWorkspace />)
      await screen.findByRole('heading', { name: 'Check-in cảm xúc' })
      expect(isMamFeatureSuppressed()).toBe(false)
    })
  })

  describe('page answer lifetime', () => {
    const pageTarget = () => getMamPageTarget()

    it('retires the page target when the tab changes by keyboard, without a request', async () => {
      const user = userEvent.setup()
      withCurrent(nativeSupportPlanFixture(), [occurrence()])
      render(<SupportPlanWorkspace mamEnabled />)
      await cardOf('Check-in cảm xúc')
      const first = pageTarget()
      expect(first).not.toBeNull()
      const subscriber = vi.fn(() => {
        if (pageTarget() === first) return
        seen.push(pageTarget())
      })
      const seen: unknown[] = []
      const unsubscribe = subscribeMamTargets(subscriber)

      screen.getByRole('tab', { name: 'Hôm nay' }).focus()
      await user.keyboard('{ArrowRight}')
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Kế hoạch' })).toHaveAttribute(
          'aria-selected',
          'true',
        ),
      )
      unsubscribe()
      // A host holding the old target sees it go (null), then a new one.
      expect(seen[0]).toBeNull()
      expect(pageTarget()).not.toBeNull()
      expect(pageTarget()).not.toBe(first)
      expect(
        legacy.requestSupportPlanActionCompanionExplanation,
      ).not.toHaveBeenCalled()
    })

    it('retires the page target when the focus action changes', async () => {
      const user = userEvent.setup()
      withCurrent(resourcePlan(), [occurrence({ actionType: 'RESOURCE' })])
      render(<SupportPlanWorkspace mamEnabled />)
      await cardOf('Check-in cảm xúc')
      const first = pageTarget()
      // Completing the focus action moves the focus to the "done" state.
      const done = occurrence({
        actionType: 'RESOURCE',
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        version: 2,
      })
      api.changeNativeActionOccurrenceState.mockResolvedValue(done)
      withCurrent(resourcePlan(), [done])
      await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
      await waitFor(() => expect(pageTarget()).not.toBe(first))
      expect(pageTarget()).not.toBeNull()
    })
  })

  it('never reports a no-interrupt zone with the flag off', async () => {
    const user = userEvent.setup()
    withCurrent(nativeSupportPlanFixture(), [occurrence()])
    render(<SupportPlanWorkspace />)
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    await user.click(screen.getByText('Lịch và thời lượng'))
    await user.click(screen.getByRole('button', { name: 'Sửa giờ' }))
    expect(isMamFeatureSuppressed()).toBe(false)
  })
})
