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
  getSupportPlanOccurrences: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
  replaceSupportPlanChoices: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => api)

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
  })

  it('renders the authoritative current active plan before looking for a draft', async () => {
    api.getCurrentSupportPlan.mockResolvedValue(activePlan())

    render(<SupportPlanJourney />)

    expect(await screen.findByText('SupportPlan đang hoạt động')).toBeVisible()
    expect(api.getCurrentSupportPlan).toHaveBeenCalledTimes(1)
    expect(api.getCurrentSupportPlanDraft).not.toHaveBeenCalled()
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
      name: 'Mở Hướng dẫn hỗ trợ',
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
        name: 'Tạo bản nháp SupportPlan',
      }),
    )

    expect(await screen.findByText('Reviewed primary resource')).toBeVisible()
    expect(api.proposeSupportPlanDraft).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
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
    expect(
      await screen.findByText('Đã lưu lựa chọn đã được Care kiểm tra.'),
    ).toBeVisible()
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
      await screen.findByRole('button', { name: 'Kích hoạt SupportPlan' }),
    )

    expect(await screen.findByText('SupportPlan đang hoạt động')).toBeVisible()
    expect(api.activateSupportPlan).toHaveBeenCalledWith(
      draft.supportPlanId,
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(api.getCurrentSupportPlan).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByRole('button', { name: 'Kích hoạt SupportPlan' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the complete draft and explains a stale activation failure', async () => {
    api.getCurrentSupportPlanDraft.mockResolvedValue(supportPlanFixture())
    api.activateSupportPlan.mockRejectedValue(
      problem('RESOURCE_VERSION_STALE', 409),
    )

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kích hoạt SupportPlan' }),
    )

    expect(
      await screen.findByText(/phiên bản nội dung đã thay đổi/),
    ).toBeVisible()
    expect(screen.getByText('Reviewed primary resource')).toBeVisible()
  })
})
