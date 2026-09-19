import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanJourney from './SupportPlanJourney'

const api = vi.hoisted(() => ({
  getCurrentSupportPlanDraft: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => api)

function problem(code: string, status: number) {
  return new ApiError({ message: code, code, status })
}

describe('SupportPlanJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reloads and renders the existing persisted draft without proposing again', async () => {
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

  it('routes stale evidence back to the initial check', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_EVALUATION_STALE', 409),
    )

    render(<SupportPlanJourney />)

    const link = await screen.findByRole('link', {
      name: 'Làm lại Kiểm tra ban đầu',
    })
    expect(link).toHaveAttribute('href', '/initial-check')
  })

  it('creates a bounded draft from the empty state and retains one retry key', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('SUPPORT_PLAN_NOT_FOUND', 404),
    )
    api.proposeSupportPlanDraft.mockResolvedValue(supportPlanFixture())

    render(<SupportPlanJourney />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tạo bản nháp SupportPlan',
      }),
    )

    expect(await screen.findByText('Reviewed primary resource')).toBeVisible()
    expect(api.proposeSupportPlanDraft).toHaveBeenCalledTimes(1)
    expect(api.proposeSupportPlanDraft).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Tạo bản nháp SupportPlan' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('explains dependency failure without presenting a partial plan', async () => {
    api.getCurrentSupportPlanDraft.mockRejectedValue(
      problem('RESOURCE_ELIGIBILITY_UNAVAILABLE', 503),
    )

    render(<SupportPlanJourney />)

    expect(
      await screen.findByText(/Không có bản nháp chưa hoàn chỉnh nào được tạo/),
    ).toBeVisible()
    expect(
      screen.queryByText('Reviewed primary resource'),
    ).not.toBeInTheDocument()
  })
})
