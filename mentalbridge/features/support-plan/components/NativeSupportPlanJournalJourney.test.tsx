import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type {
  JournalOccurrenceReconciliation,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  journalActionId,
  journalCompletionFixture,
  journalDay,
  journalEntryId,
  journalOccurrenceFixture,
  journalOccurrenceId,
  journalSupportPlanFixture,
} from '../testing/journal-support-plan-fixture'
import type { JournalPlanOrigin } from '../journal-plan-origin'

const api = vi.hoisted(() => ({
  getSupportPlanActionOccurrences: vi.fn(),
  getSupportPlanActionHistory: vi.fn(),
  getCurrentSupportPlanActions: vi.fn(),
  getCurrentNativeSupportPlanDraft: vi.fn(),
  reconcileJournalOccurrence: vi.fn(),
  reconcileEmotionCheckInOccurrence: vi.fn(),
  changeNativeActionOccurrenceState: vi.fn(),
}))
vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ confirm: vi.fn() }),
}))
vi.mock('@/features/emotion-check-in/EmotionProgress', () => ({
  EmotionProgress: () => null,
}))
vi.mock('./ProfessionalSupportPath', () => ({ default: () => null }))
import NativeSupportPlanJourney from './NativeSupportPlanJourney'
const origin: JournalPlanOrigin = {
  source: 'journal',
  occurrenceId: journalOccurrenceId,
  actionId: journalActionId,
  localDate: journalDay,
}
const returned = { ...origin, journalId: journalEntryId }
function result(
  sourceState: 'RECORDED' | 'MISSING' | 'DELETED',
  completed = false,
): JournalOccurrenceReconciliation {
  return {
    schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
    ...returned,
    sourceState,
    occurrenceState: completed ? 'COMPLETED' : 'SCHEDULED',
    version: completed ? 1 : 0,
    completedAt: completed ? '2026-10-14T12:07:00Z' : null,
    completionEvidence: completed ? journalCompletionFixture() : null,
  }
}
function windowFor(occurrences = [journalOccurrenceFixture()]) {
  return {
    supportPlanId: journalSupportPlanFixture().supportPlanId,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    from: journalDay,
    through: journalDay,
    occurrences,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}
function mount(
  plan = journalSupportPlanFixture(),
  journalOrigin: JournalPlanOrigin = origin,
) {
  return render(
    <NativeSupportPlanJourney
      initialCurrent={plan}
      journalOrigin={journalOrigin}
    />,
  )
}
async function row() {
  const heading = await screen.findByRole('heading', {
    name: 'Viết một suy nghĩ ngắn',
  })
  const article = heading.closest('article')
  if (!article) throw new Error('Missing Journal activity row')
  return within(article)
}
describe('Native SupportPlan Journal writing journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T12:10:00Z'))
    api.getSupportPlanActionOccurrences.mockResolvedValue(windowFor())
    api.getCurrentSupportPlanActions.mockResolvedValue(
      journalSupportPlanFixture(),
    )
    api.getCurrentNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
        message: 'Missing',
      }),
    )
  })
  afterEach(() => vi.useRealTimers())
  it('opens only the canonical Journal editor with typed context and no hidden completion', async () => {
    mount()
    const activity = await row()
    await waitFor(() => expect(activity.getByRole('heading')).toHaveFocus())
    expect(
      activity.getByRole('link', { name: 'Viết nhật ký' }),
    ).toHaveAttribute(
      'href',
      `/journal?source=journal&occurrenceId=${journalOccurrenceId}&actionId=${journalActionId}&localDate=${journalDay}`,
    )
    expect(
      activity.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(api.reconcileJournalOccurrence).not.toHaveBeenCalled()
    expect(api.reconcileEmotionCheckInOccurrence).not.toHaveBeenCalled()
    expect(api.changeNativeActionOccurrenceState).not.toHaveBeenCalled()
  })
  it('checks exactly the returned candidate only after click and prevents concurrent commands', async () => {
    let resolve: ((value: JournalOccurrenceReconciliation) => void) | undefined
    api.reconcileJournalOccurrence.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    mount(undefined, returned)
    const activity = await row()
    expect(activity.getByText(/Hoạt động chưa được xác nhận/)).toBeVisible()
    expect(api.reconcileJournalOccurrence).not.toHaveBeenCalled()
    const check = activity.getByRole('button', { name: 'Kiểm tra ghi nhận' })
    fireEvent.click(check)
    expect(
      activity.getByRole('button', { name: 'Đang kiểm tra…' }),
    ).toBeDisabled()
    expect(
      activity.getByRole('button', { name: 'Bỏ qua hôm nay' }),
    ).toBeDisabled()
    fireEvent.click(check)
    expect(api.reconcileJournalOccurrence).toHaveBeenCalledTimes(1)
    expect(api.reconcileJournalOccurrence).toHaveBeenCalledWith(
      journalOccurrenceId,
      journalEntryId,
    )
    if (!resolve) throw new Error('Expected pending request')
    resolve(result('RECORDED', true))
    await activity.findByText('Đã ghi nhận hoàn thành')
    expect(api.changeNativeActionOccurrenceState).not.toHaveBeenCalled()
  })
  it.each(['MISSING', 'DELETED'] as const)(
    'keeps %s separate from completion and permits an explicit new writing attempt',
    async (state) => {
      api.reconcileJournalOccurrence.mockResolvedValue(result(state))
      mount(undefined, returned)
      const activity = await row()
      fireEvent.click(
        activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }),
      )
      await activity.findByRole('link', { name: 'Viết bài mới' })
      expect(activity.getByText('Chưa ghi nhận hoàn thành')).toBeVisible()
      expect(
        activity
          .getByRole('link', { name: 'Viết bài mới' })
          .getAttribute('href'),
      ).not.toContain('journalId=')
      expect(api.reconcileJournalOccurrence).toHaveBeenCalledTimes(1)
    },
  )
  it('preserves the exact candidate after provider failure and retries explicitly', async () => {
    api.reconcileJournalOccurrence
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'JOURNAL_ENTRY_EVIDENCE_UNAVAILABLE',
          message: 'Unavailable',
        }),
      )
      .mockResolvedValueOnce(result('RECORDED', true))
    mount(undefined, returned)
    const activity = await row()
    fireEvent.click(activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await activity.findByText(/Bài đã lưu và trạng thái hoạt động vẫn được giữ/)
    expect(activity.getByText('Chưa ghi nhận hoàn thành')).toBeVisible()
    fireEvent.click(activity.getByRole('button', { name: 'Thử kiểm tra lại' }))
    await activity.findByText('Đã ghi nhận hoàn thành')
    expect(api.reconcileJournalOccurrence.mock.calls).toEqual([
      [journalOccurrenceId, journalEntryId],
      [journalOccurrenceId, journalEntryId],
    ])
  })
  it.each(['occurrenceId', 'actionId', 'localDate', 'journalId'] as const)(
    'does not apply a response with a different %s',
    async (key) => {
      api.reconcileJournalOccurrence.mockResolvedValue({
        ...result('RECORDED', true),
        [key]:
          key === 'localDate'
            ? '2026-10-15'
            : '80000000-0000-4000-8000-000000000642',
      })
      mount(undefined, returned)
      const activity = await row()
      fireEvent.click(
        activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }),
      )
      await activity.findByRole('alert')
      expect(activity.getByText('Chưa ghi nhận hoàn thành')).toBeVisible()
    },
  )
  it('reads accepted history with its stored entry even when a new candidate is present and plan is paused', async () => {
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      windowFor([
        {
          ...journalOccurrenceFixture(),
          state: 'COMPLETED',
          displayState: 'COMPLETED',
          completionEvidence: journalCompletionFixture(),
          outcomeRecordedAt: '2026-10-14T12:07:00Z',
        },
      ]),
    )
    api.reconcileJournalOccurrence.mockResolvedValue(result('DELETED', true))
    mount(
      { ...journalSupportPlanFixture(), status: 'PAUSED' },
      { ...returned, journalId: '80000000-0000-4000-8000-000000000642' },
    )
    const activity = await row()
    fireEvent.click(activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await activity.findByText(/Bài nhật ký gốc đã được xóa/)
    expect(api.reconcileJournalOccurrence).toHaveBeenCalledWith(
      journalOccurrenceId,
      journalEntryId,
    )
    expect(activity.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
    expect(
      activity.queryByRole('link', { name: 'Viết nhật ký' }),
    ).not.toBeInTheDocument()
  })
  it('offers a safe authoritative reload after a stale command without applying completion', async () => {
    api.reconcileJournalOccurrence.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'JOURNAL_WRITING_DATE_MISMATCH',
        message: 'Changed',
      }),
    )
    mount(undefined, returned)
    const activity = await row()
    fireEvent.click(activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    fireEvent.click(
      await activity.findByRole('button', { name: 'Tải lại hoạt động' }),
    )
    await waitFor(() =>
      expect(api.getCurrentSupportPlanActions).toHaveBeenCalledTimes(1),
    )
    expect(activity.getByText('Chưa ghi nhận hoàn thành')).toBeVisible()
  })
  it('keeps accepted Journal history accessible after its action ends and advances version', async () => {
    const plan = journalSupportPlanFixture()
    plan.focuses[0].actions[1] = {
      ...plan.focuses[0].actions[1],
      status: 'ENDED',
      actionVersion: 2,
      endedAt: '2026-10-14T12:08:00Z',
    }
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      windowFor([
        {
          ...journalOccurrenceFixture(),
          state: 'COMPLETED',
          displayState: 'COMPLETED',
          completionEvidence: journalCompletionFixture(),
          outcomeRecordedAt: '2026-10-14T12:07:00Z',
        },
      ]),
    )
    api.reconcileJournalOccurrence.mockResolvedValue(result('DELETED', true))
    mount(plan, {
      ...returned,
      journalId: '80000000-0000-4000-8000-000000000642',
    })
    const activity = await row()
    expect(activity.getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute(
      'href',
      expect.stringContaining(`journalId=${journalEntryId}`),
    )
    expect(
      activity.queryByRole('link', { name: 'Viết nhật ký' }),
    ).not.toBeInTheDocument()
    fireEvent.click(activity.getByRole('button', { name: 'Kiểm tra ghi nhận' }))
    await activity.findByText(/Bài nhật ký gốc đã được xóa/)
    expect(api.reconcileJournalOccurrence).toHaveBeenCalledWith(
      journalOccurrenceId,
      journalEntryId,
    )
    expect(activity.getByText('Đã ghi nhận hoàn thành')).toBeVisible()
  })
  it.each(['SKIPPED', 'CANCELLED'] as const)(
    'does not write or reconcile a %s activity',
    async (state) => {
      api.getSupportPlanActionOccurrences.mockResolvedValue(
        windowFor([
          { ...journalOccurrenceFixture(), state, displayState: state },
        ]),
      )
      mount(undefined, returned)
      const activity = await row()
      expect(
        activity.queryByRole('link', { name: 'Viết nhật ký' }),
      ).not.toBeInTheDocument()
      expect(
        activity.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
      ).not.toBeInTheDocument()
    },
  )
  it.each(['2026-10-13', '2026-10-15'])(
    'does not pretend a new writing today completes %s',
    async (localDate) => {
      api.getSupportPlanActionOccurrences.mockResolvedValue(
        windowFor([{ ...journalOccurrenceFixture(), localDate }]),
      )
      mount(undefined, { ...origin, localDate })
      const activity = await row()
      expect(
        activity.queryByRole('link', { name: 'Viết nhật ký' }),
      ).not.toBeInTheDocument()
      expect(
        activity.getByText(/đổi ngày trong nhật ký không ghi nhận/),
      ).toBeVisible()
    },
  )
  it('does not offer a candidate check for a future activity', async () => {
    const localDate = '2026-10-15'
    api.getSupportPlanActionOccurrences.mockResolvedValue(
      windowFor([{ ...journalOccurrenceFixture(), localDate }]),
    )
    mount(undefined, { ...returned, localDate })
    expect(
      (await row()).queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
  })
  it('rejects an unsupported source and gives invalid-origin recovery without hidden writes', async () => {
    const plan: SupportPlanV3 = journalSupportPlanFixture()
    plan.focuses[0].actions[1].source = null
    mount(plan, returned)
    const activity = await row()
    expect(
      await screen.findByRole('link', { name: 'Về nhật ký' }),
    ).toBeVisible()
    expect(
      activity.queryByRole('link', { name: 'Viết nhật ký' }),
    ).not.toBeInTheDocument()
    expect(
      activity.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
    expect(api.reconcileJournalOccurrence).not.toHaveBeenCalled()
  })
  it('does not open writing when owner activation is missing', async () => {
    const plan = journalSupportPlanFixture()
    plan.focuses[0].actions[1].activatedAt = null
    mount(plan, returned)
    const activity = await row()
    expect(
      activity.queryByRole('link', { name: 'Viết nhật ký' }),
    ).not.toBeInTheDocument()
    expect(
      activity.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
  })
  it('does not turn an unrelated returned action into a Journal completion', async () => {
    mount(undefined, {
      ...returned,
      actionId: '90000000-0000-4000-8000-000000000642',
    })
    const activity = await row()
    expect(
      await screen.findByRole('link', { name: 'Về nhật ký' }),
    ).toBeVisible()
    expect(
      activity.queryByRole('button', { name: 'Kiểm tra ghi nhận' }),
    ).not.toBeInTheDocument()
  })
})
