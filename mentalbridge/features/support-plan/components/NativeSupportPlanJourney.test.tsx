import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import {
  emotionActionId,
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  emotionOccurrenceId,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import type {
  SupportPlanV3,
  UpdateActionScheduleRequest,
} from '../api/support-plan-contract'

const api = vi.hoisted(() => ({
  activateNativeSupportPlan: vi.fn(),
  changeNativeActionOccurrenceState: vi.fn(),
  changeNativeSupportPlanStatus: vi.fn(),
  getCurrentNativeSupportPlanDraft: vi.fn(),
  getCurrentSupportPlanActions: vi.fn(),
  getNativeSupportPlanEvaluationSource: vi.fn(),
  getSupportPlanActionHistory: vi.fn(),
  getSupportPlanActionModel: vi.fn(),
  getSupportPlanActionOccurrences: vi.fn(),
  proposeNativeSupportPlanDraft: vi.fn(),
  reconcileEmotionCheckInOccurrence: vi.fn(),
  replaceWithNativeSupportPlan: vi.fn(),
  reviewNativeSupportPlanReplacement: vi.fn(),
  getCurrentReassessmentSummary: vi.fn(),
  replaceSupportPlanActionSchedule: vi.fn(),
  changeSupportPlanStatus: vi.fn(),
  requestSupportPlanActionCompanionExplanation: vi.fn(),
}))
const feedback = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('../api/browser-support-plan', () => api)
vi.mock('@/features/assessment/api/browser-care', () => api)
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => feedback,
}))
vi.mock('@/features/emotion-check-in/EmotionProgress', () => ({
  EmotionProgress: () => <p>Factual Emotion progress</p>,
}))
vi.mock('./ProfessionalSupportPath', () => ({
  default: () => <p>Professional support remains available</p>,
}))
vi.mock('./SupportPlanPersonalization', () => ({
  default: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void
  }) => (
    <section aria-label="Lựa chọn cá nhân">
      <button onClick={() => onDirtyChange?.(true)}>
        Sửa lựa chọn chưa lưu
      </button>
      <button onClick={() => onDirtyChange?.(false)}>Lưu lựa chọn</button>
    </section>
  ),
}))
vi.mock('./SupportPlanScheduleEditor', () => ({
  default: ({
    plan,
    onDirtyChange,
    onSave,
  }: {
    plan: SupportPlanV3
    onDirtyChange?: (dirty: boolean) => void
    onSave: (
      id: string,
      request: UpdateActionScheduleRequest,
      key: string,
    ) => Promise<void>
  }) => (
    <section aria-label="Lịch đang chỉnh sửa">
      <p>{plan.representationMode}</p>
      <input
        aria-label="Ghi chú chỉnh sửa"
        defaultValue=""
        onChange={() => onDirtyChange?.(true)}
      />
      <button
        onClick={() =>
          void onSave(
            emotionActionId,
            { schedule: null },
            'schedule-command-0001',
          ).then(() => onDirtyChange?.(false))
        }
      >
        Lưu lịch của hoạt động
      </button>
    </section>
  ),
}))
import NativeSupportPlanJourney from './NativeSupportPlanJourney'

const origin = {
  occurrenceId: emotionOccurrenceId,
  actionId: emotionActionId,
  localDate: '2026-10-13',
}
function result(
  sourceState: 'RECORDED' | 'MISSING' | 'DELETED',
  completed = false,
) {
  return {
    schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
    ...origin,
    sourceState,
    occurrenceState: completed ? 'COMPLETED' : 'SCHEDULED',
    version: completed ? 1 : 0,
    completedAt: completed ? '2026-10-13T13:01:00Z' : null,
    completionEvidence: completed ? emotionCompletionFixture() : null,
  }
}
function windowFixture() {
  return {
    supportPlanId: nativeSupportPlanFixture().supportPlanId,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    from: '2026-10-13',
    through: '2026-10-13',
    occurrences: [emotionOccurrenceFixture()],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}
function mount() {
  return render(
    <NativeSupportPlanJourney
      initialCurrent={nativeSupportPlanFixture()}
      origin={origin}
    />,
  )
}

describe('Native SupportPlan Emotion journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    feedback.confirm.mockResolvedValue(true)
    api.getSupportPlanActionOccurrences.mockResolvedValue(windowFixture())
    api.getSupportPlanActionHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    api.getCurrentSupportPlanActions.mockResolvedValue(
      nativeSupportPlanFixture(),
    )
    api.getCurrentNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({
        code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
        status: 404,
        message: 'Missing',
      }),
    )
    api.requestSupportPlanActionCompanionExplanation.mockResolvedValue({
      schemaVersion: 'support-plan-companion-message-v1',
      supportPlanId: nativeSupportPlanFixture().supportPlanId,
      actionId: emotionActionId,
      intent: 'EXPLAIN_ACTION',
      surface: 'TODAY',
      text: 'Đây là một hoạt động đã được Care chọn cho kế hoạch của bạn.',
      delivery: 'GENERATED',
      policyVersion: 'support-plan-companion-policy-v1',
      promptVersion: 'support-plan-companion-prompt-v1',
      templateVersion: 'support-plan-companion-template-v1',
      provider: 'OPENAI',
      model: 'test-model',
      fallbackReason: null,
    })
  })
  it('requests a contextual response only after click and preserves the source action', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = await screen.findByRole(
      'button',
      {
        name: 'Nhờ bạn đồng hành giải thích: Check-in cảm xúc',
      },
      { timeout: 5_000 },
    )
    trigger.focus()
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()
    await user.click(trigger)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledWith(
      nativeSupportPlanFixture().supportPlanId,
      emotionActionId,
      'TODAY',
    )
    expect(
      await screen.findAllByText(
        'Đây là một hoạt động đã được Care chọn cho kế hoạch của bạn.',
      ),
    ).not.toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Ghi nhận cảm xúc' })).toBeVisible()
  })
  it('keeps an unsaved schedule intact while guided prompting stays quiet', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('tab', { name: 'Điều chỉnh' }))
    const note = screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' })
    await user.type(note, 'giữ thay đổi của tôi')

    const open = screen.getByRole('button', {
      name: 'Mở hướng dẫn có giới hạn',
    })
    expect(open).toBeDisabled()
    expect(open).toHaveAccessibleDescription(
      'Bạn đồng hành đang tạm lắng trong khi bạn chỉnh sửa hoặc xác nhận.',
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    expect(note).toHaveValue('giữ thay đổi của tôi')
    expect(api.replaceSupportPlanActionSchedule).not.toHaveBeenCalled()
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()
  })
  it('dismisses a pending guided request, ignores its late answer, and allows retry after settlement', async () => {
    const user = userEvent.setup()
    let release: (() => void) | undefined
    api.requestSupportPlanActionCompanionExplanation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              schemaVersion: 'support-plan-companion-message-v1',
              supportPlanId: nativeSupportPlanFixture().supportPlanId,
              actionId: emotionActionId,
              intent: 'EXPLAIN_ACTION',
              surface: 'TODAY',
              text: 'Phản hồi đến sau khi panel đã đóng.',
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
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Mở hướng dẫn có giới hạn' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Vì sao hoạt động này có trong kế hoạch?',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Đóng hướng dẫn Bạn đồng hành',
      }),
    )

    expect(
      document.querySelector('.support-plan-companion-contextual-tray'),
    ).toBeNull()
    release?.()
    expect(screen.queryByText('Phản hồi đến sau khi panel đã đóng.')).toBeNull()
    expect(
      document.querySelector('.support-plan-companion-contextual-tray'),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Mở hướng dẫn có giới hạn' }),
    )
    let retry = screen.getByRole('button', {
      name: 'Vì sao hoạt động này có trong kế hoạch?',
    })
    await waitFor(() => expect(retry).toBeEnabled())
    await user.click(
      screen.getByRole('button', {
        name: 'Đóng hướng dẫn Bạn đồng hành',
      }),
    )
    expect(screen.queryByText('Phản hồi đến sau khi panel đã đóng.')).toBeNull()
    expect(
      document.querySelector('.support-plan-companion-contextual-tray'),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Mở hướng dẫn có giới hạn' }),
    )
    retry = screen.getByRole('button', {
      name: 'Vì sao hoạt động này có trong kế hoạch?',
    })
    await user.click(retry)
    expect(
      await screen.findByText(
        'Đây là một hoạt động đã được Care chọn cho kế hoạch của bạn.',
      ),
    ).toBeVisible()
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(2)
  })
  it('admits one journey-wide request across rapid clicks and tab changes, then allows retry after settlement', async () => {
    const user = userEvent.setup()
    let release: (() => void) | undefined
    api.requestSupportPlanActionCompanionExplanation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              schemaVersion: 'support-plan-companion-message-v1',
              supportPlanId: nativeSupportPlanFixture().supportPlanId,
              actionId: emotionActionId,
              intent: 'EXPLAIN_ACTION',
              surface: 'TODAY',
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
    mount()
    const todayTrigger = await screen.findByRole(
      'button',
      {
        name: 'Nhờ bạn đồng hành giải thích: Check-in cảm xúc',
      },
      { timeout: 5_000 },
    )
    fireEvent.click(todayTrigger)
    fireEvent.click(todayTrigger)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('tab', { name: 'Kế hoạch' }))
    const planTrigger = await screen.findByRole(
      'button',
      {
        name: 'Nhờ bạn đồng hành giải thích: Check-in cảm xúc',
      },
      { timeout: 5_000 },
    )
    expect(planTrigger).toBeDisabled()
    fireEvent.click(planTrigger)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)

    release?.()
    await waitFor(() => expect(planTrigger).toBeEnabled())
    await user.click(planTrigger)
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(2)
  })
  it('invalidates a pending card response when an external dialog opens and allows retry after settlement', async () => {
    const user = userEvent.setup()
    let release: (() => void) | undefined
    api.requestSupportPlanActionCompanionExplanation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              schemaVersion: 'support-plan-companion-message-v1',
              supportPlanId: nativeSupportPlanFixture().supportPlanId,
              actionId: emotionActionId,
              intent: 'EXPLAIN_ACTION',
              surface: 'TODAY',
              text: 'Late native response must stay hidden.',
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
    mount()
    const trigger = await screen.findByRole('button', { name: /Check-in/ })
    fireEvent.click(trigger)

    const dialog = document.createElement('section')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', 'Xác nhận bên ngoài')
    const confirm = document.createElement('button')
    confirm.textContent = 'Tiếp tục xác nhận'
    dialog.append(confirm)
    document.body.append(dialog)
    confirm.focus()

    await waitFor(() =>
      expect(document.querySelector('.support-plan-companion')).toHaveAttribute(
        'data-interrupted',
        'true',
      ),
    )
    expect(confirm).toHaveFocus()
    expect(screen.getByRole('link', { name: /Ghi nhận cảm xúc/ })).toBeVisible()

    release?.()
    await waitFor(() => expect(trigger).toBeDisabled())
    expect(
      screen.queryByText('Late native response must stay hidden.'),
    ).toBeNull()
    expect(
      document.querySelector(
        '.support-plan-contextual-bubble[role="status"], .support-plan-contextual-bubble[aria-live], .support-plan-companion-contextual-tray',
      ),
    ).toBeNull()

    dialog.remove()
    await waitFor(() => expect(trigger).toBeEnabled())
    await user.click(trigger)
    await waitFor(() =>
      expect(
        api.requestSupportPlanActionCompanionExplanation,
      ).toHaveBeenCalledTimes(2),
    )
    expect(
      document.querySelector('.support-plan-contextual-bubble'),
    ).not.toBeNull()
  })
  it('opens the canonical form with exact activity identity and focuses return without hidden completion', async () => {
    mount()
    const heading = await screen.findByRole('heading', {
      name: 'Check-in cảm xúc',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    const link = screen.getByRole('link', { name: 'Ghi nhận cảm xúc' })
    expect(link).toHaveAttribute(
      'href',
      `/dashboard?occurrenceId=${emotionOccurrenceId}&actionId=${emotionActionId}&localDate=2026-10-13#emotion-check-in`,
    )
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
    expect(api.changeNativeActionOccurrenceState).not.toHaveBeenCalled()
  })
  it('checks only on explicit action, prevents duplicates, and keeps missing separate from completion', async () => {
    const user = userEvent.setup()
    let resolve: ((value: ReturnType<typeof result>) => void) | undefined
    api.reconcileEmotionCheckInOccurrence.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    mount()
    const check = await screen.findByRole('button', {
      name: 'Kiểm tra ghi nhận',
    })
    await user.click(check)
    expect(
      screen.getByRole('button', { name: 'Đang kiểm tra…' }),
    ).toBeDisabled()
    fireEvent.click(check)
    expect(api.reconcileEmotionCheckInOccurrence).toHaveBeenCalledTimes(1)
    if (!resolve) throw new Error('Expected pending check')
    resolve(result('MISSING'))
    await screen.findByText(
      'Chưa có ghi nhận cảm xúc phù hợp cho hoạt động ngày này.',
    )
    expect(screen.getByText('Chưa ghi nhận hoàn thành')).toBeVisible()
    api.reconcileEmotionCheckInOccurrence.mockResolvedValue(
      result('RECORDED', true),
    )
    await user.click(screen.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await screen.findByText('Đã tìm thấy ghi nhận cảm xúc phù hợp.')
    expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
    api.reconcileEmotionCheckInOccurrence.mockResolvedValue(
      result('DELETED', true),
    )
    await user.click(screen.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await screen.findByText(
      'Ghi nhận cảm xúc gốc đã được xóa. Lần hoàn thành được chấp nhận trước đó vẫn được giữ.',
    )
    expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
    expect(api.reconcileEmotionCheckInOccurrence).toHaveBeenLastCalledWith(
      emotionOccurrenceId,
    )
  })
  it('preserves accepted history during outage and never applies a mismatched response', async () => {
    const user = userEvent.setup()
    api.getSupportPlanActionOccurrences.mockResolvedValue({
      ...windowFixture(),
      occurrences: [
        {
          ...emotionOccurrenceFixture(),
          state: 'COMPLETED',
          displayState: 'COMPLETED',
          version: 1,
          outcomeRecordedAt: '2026-10-13T13:01:00Z',
          completionEvidence: emotionCompletionFixture(),
        },
      ],
    })
    api.reconcileEmotionCheckInOccurrence
      .mockRejectedValueOnce(
        new ApiError({
          code: 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE',
          status: 503,
          message: 'private detail',
        }),
      )
      .mockResolvedValueOnce({
        ...result('RECORDED', true),
        actionId: '90000000-0000-4000-8000-000000000641',
      })
    mount()
    await user.click(
      await screen.findByRole('button', { name: 'Kiểm tra ghi nhận' }),
    )
    await screen.findByText(
      'Chưa thể hoàn tất thao tác. Thông tin đã ghi nhận và các chỉnh sửa của bạn vẫn được giữ. Hãy thử lại.',
    )
    expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await waitFor(() =>
      expect(api.reconcileEmotionCheckInOccurrence).toHaveBeenCalledTimes(2),
    )
    expect(
      screen.queryByText('Đã tìm thấy ghi nhận cảm xúc phù hợp.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
  })
  it('does not target a nearby activity when origin has changed', async () => {
    render(
      <NativeSupportPlanJourney
        initialCurrent={nativeSupportPlanFixture()}
        origin={{ ...origin, actionId: '90000000-0000-4000-8000-000000000641' }}
      />,
    )
    await screen.findByText(
      'Không tìm thấy hoạt động đã mở trong kế hoạch hiện tại. Các hoạt động khác chưa bị thay đổi.',
    )
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
  })
  it('shows optional purpose and cadence, then explicitly activates with the same retry key', async () => {
    const user = userEvent.setup()
    const draft = {
      ...nativeSupportPlanFixture(),
      status: 'DRAFT' as const,
      activatedAt: null,
    }
    api.activateNativeSupportPlan
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'CARE_UNAVAILABLE',
          message: 'Unavailable',
        }),
      )
      .mockResolvedValueOnce(nativeSupportPlanFixture())
    render(<NativeSupportPlanJourney initialDraft={draft} />)
    expect(screen.getByText(/Mỗi ngày · 19:00 · 5 phút/)).toBeVisible()
    expect(screen.getByText(/Ghi nhận điều bạn đang cảm nhận/)).toBeVisible()
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kế hoạch' }))
    await waitFor(() =>
      expect(api.activateNativeSupportPlan).toHaveBeenCalledTimes(2),
    )
    expect(api.activateNativeSupportPlan.mock.calls[1]?.[2]).toBe(
      api.activateNativeSupportPlan.mock.calls[0]?.[2],
    )
    expect(api.changeSupportPlanStatus).not.toHaveBeenCalled()
    await screen.findByRole('button', { name: 'Kiểm tra ghi nhận' })
  })
  it('blocks activation and tab loss for unsaved native schedules without remounting editor after save', async () => {
    const user = userEvent.setup()
    const draft = {
      ...nativeSupportPlanFixture(),
      status: 'DRAFT' as const,
      activatedAt: null,
    }
    api.replaceSupportPlanActionSchedule.mockResolvedValue({
      ...draft,
      version: 2,
    })
    render(<NativeSupportPlanJourney initialDraft={draft} />)
    await user.click(screen.getByRole('tab', { name: 'Điều chỉnh' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' }),
      'giữ bản nháp',
    )
    feedback.confirm.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('tab', { name: 'Kế hoạch' }))
    expect(
      screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' }),
    ).toHaveValue('giữ bản nháp')
    await user.click(
      screen.getByRole('button', { name: 'Lưu lịch của hoạt động' }),
    )
    await waitFor(() =>
      expect(api.replaceSupportPlanActionSchedule).toHaveBeenCalledWith(
        draft.supportPlanId,
        emotionActionId,
        1,
        { schedule: null },
        'schedule-command-0001',
      ),
    )
    expect(
      screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' }),
    ).toHaveValue('giữ bản nháp')
  })
  it('uses only saved preferences and the correct completed screening to propose a new plan', async () => {
    const user = userEvent.setup()
    const draft = {
      ...nativeSupportPlanFixture(),
      status: 'DRAFT' as const,
      activatedAt: null,
    }
    api.getNativeSupportPlanEvaluationSource.mockResolvedValue('evaluation-id')
    api.proposeNativeSupportPlanDraft.mockResolvedValue(draft)
    render(<NativeSupportPlanJourney />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    await user.click(
      screen.getByRole('button', { name: 'Sửa lựa chọn chưa lưu' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xem kế hoạch được đề xuất' }),
    )
    expect(api.proposeNativeSupportPlanDraft).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await user.click(
      screen.getByRole('button', { name: 'Xem kế hoạch được đề xuất' }),
    )
    await screen.findByRole('button', { name: 'Bắt đầu kế hoạch' })
    expect(api.getNativeSupportPlanEvaluationSource).toHaveBeenCalledWith(
      'INITIAL_CHECK',
    )
    expect(api.proposeNativeSupportPlanDraft).toHaveBeenCalledWith(
      'evaluation-id',
      expect.any(String),
    )
    expect(api.activateNativeSupportPlan).not.toHaveBeenCalled()
  })
  it('keeps factual Emotion progress separate from terminal plan history', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('tab', { name: 'Tiến triển' }))
    await screen.findByText('Factual Emotion progress')
    expect(
      screen.getByText(
        'Số ngày ghi nhận cảm xúc và hoạt động đã hoàn thành là hai thông tin riêng biệt.',
      ),
    ).toBeVisible()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
    expect(api.getSupportPlanActionHistory).toHaveBeenCalledTimes(1)
  })
  it('allows an owner-admitted replacement when the previous plan is no longer admissible, with explicit confirmation only', async () => {
    const user = userEvent.setup()
    const current = {
      ...nativeSupportPlanFixture(),
      representationMode: 'V2_RESOURCE_ADAPTER' as const,
    }
    const draft = {
      ...nativeSupportPlanFixture(),
      supportPlanId: '90000000-0000-4000-8000-000000000641',
      status: 'DRAFT' as const,
      activatedAt: null,
    }
    const summaryId = '80000000-0000-4000-8000-000000000641'
    api.getCurrentReassessmentSummary.mockResolvedValue({ summaryId })
    api.reviewNativeSupportPlanReplacement.mockResolvedValue({
      outcome: 'CURRENT_PLAN_NOT_ADMISSIBLE',
      currentPlan: current,
      proposedPlan: draft,
      reassessmentSummary: {
        summaryId,
        screening: { state: 'AVAILABLE' },
        journalContext: { state: 'UNAVAILABLE' },
        supportPlanEngagement: { state: 'INSUFFICIENT_DATA' },
        selfReportedExperience: { state: 'AVAILABLE' },
      },
    })
    api.replaceWithNativeSupportPlan.mockResolvedValue({
      ...draft,
      status: 'ACTIVE',
    })
    const back = vi.fn()
    render(
      <NativeSupportPlanJourney
        initialCurrent={current}
        initialDraft={draft}
        onBackToLegacy={back}
      />,
    )
    expect(api.replaceWithNativeSupportPlan).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Xem xét phương án thay thế' }),
    )
    const replace = await screen.findByRole('button', {
      name: 'Xác nhận thay thế kế hoạch',
    })
    expect(replace).toBeEnabled()
    expect(screen.getAllByRole('definition')).toHaveLength(4)
    expect(api.replaceWithNativeSupportPlan).not.toHaveBeenCalled()
    await user.click(replace)
    await waitFor(() =>
      expect(api.replaceWithNativeSupportPlan).toHaveBeenCalledWith(
        draft.supportPlanId,
        draft.version,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: summaryId,
        },
        expect.any(String),
      ),
    )
    expect(
      screen.queryByRole('button', { name: 'Quay lại kế hoạch hiện tại' }),
    ).not.toBeInTheDocument()
    expect(back).not.toHaveBeenCalled()
  })
  it('does not move keyboard focus or discard local edits when the tab confirmation is cancelled', async () => {
    const user = userEvent.setup()
    render(
      <NativeSupportPlanJourney
        initialDraft={{ ...nativeSupportPlanFixture(), status: 'DRAFT' }}
      />,
    )
    const adjust = screen.getByRole('tab', { name: 'Điều chỉnh' })
    await user.click(adjust)
    await user.type(
      screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' }),
      'giữ',
    )
    feedback.confirm.mockResolvedValueOnce(false)
    adjust.focus()
    fireEvent.keyDown(adjust, { key: 'ArrowLeft' })
    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(adjust).toHaveFocus()
    expect(
      screen.getByRole('textbox', { name: 'Ghi chú chỉnh sửa' }),
    ).toHaveValue('giữ')
  })
  it('ignores a superseded day read so old activities cannot overwrite the selected day', async () => {
    const old = windowFixture()
    let resolveOld:
      ((value: ReturnType<typeof windowFixture>) => void) | undefined
    api.getSupportPlanActionOccurrences
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce({
        ...old,
        from: '2026-10-14',
        through: '2026-10-14',
        occurrences: [],
      })
    mount()
    fireEvent.change(screen.getByLabelText('Chọn ngày'), {
      target: { value: '2026-10-14' },
    })
    await screen.findByText(
      'Chưa có hoạt động nào được xếp lịch ngày này. Bạn có thể xem hoặc điều chỉnh kế hoạch.',
    )
    if (!resolveOld) throw new Error('Expected older request')
    resolveOld(old)
    await waitFor(() =>
      expect(api.getSupportPlanActionOccurrences).toHaveBeenCalledTimes(2),
    )
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
  })
})
