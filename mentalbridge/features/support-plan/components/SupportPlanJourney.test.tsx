import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanJourney from './SupportPlanJourney'

const api = vi.hoisted(() => ({
  activateSupportPlan: vi.fn(),
  changeSupportPlanOccurrenceState: vi.fn(),
  changeSupportPlanStatus: vi.fn(),
  getCurrentSupportPlan: vi.fn(),
  getCurrentSupportPlanDraft: vi.fn(),
  getSupportPlan: vi.fn(),
  getSupportPlanHistory: vi.fn(),
  getSupportPlanOccurrences: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
  replaceSupportPlan: vi.fn(),
  replaceSupportPlanChoices: vi.fn(),
  reviewSupportPlanReplacement: vi.fn(),
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

  it('falls back to the persisted draft without proposing again', async () => {
    api.getCurrentSupportPlanDraft.mockResolvedValue(supportPlanFixture())

    render(<SupportPlanJourney />)

    expect(await screen.findByText('Reviewed primary resource')).toBeVisible()
    expect(api.getCurrentSupportPlanDraft).toHaveBeenCalledTimes(1)
    expect(api.proposeSupportPlanDraft).not.toHaveBeenCalled()
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
    )
  })

  it('explains that ordinary screening history does not replace the guided pair', async () => {
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
      await screen.findByText(/Lịch sử sàng lọc của bạn vẫn được giữ nguyên/),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Làm lại kiểm tra ban đầu' }),
    ).toHaveAttribute('href', '/initial-check')
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
    fireEvent.change(screen.getByLabelText('Lý do (không bắt buộc)'), {
      target: { value: 'PLAN_NO_LONGER_FITS' },
    })
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
    expect(screen.getByText(/Kế hoạch đã thay đổi ở nơi khác/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Kết thúc kế hoạch' }),
    ).not.toBeInTheDocument()
    expect(api.getSupportPlanHistory).toHaveBeenCalledTimes(2)
  })
})
