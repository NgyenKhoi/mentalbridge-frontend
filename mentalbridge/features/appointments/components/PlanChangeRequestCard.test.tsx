import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { PlanChangeRequestCard } from './PlanChangeRequestCard'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  decide: vi.fn(),
}))

vi.mock('@/features/support-plan/api/browser-plan-change-request', () => ({
  getPlanChangeRequest: api.get,
  createPlanChangeRequest: api.create,
  decidePlanChangeRequest: api.decide,
}))

const reviewed = {
  requestId: '10000000-0000-4000-8000-000000000010',
  version: 0,
  status: 'READY_FOR_REVIEW' as const,
  outcomeCode: 'PROPOSAL_ADMISSIBLE' as const,
  sourceProposalId: '10000000-0000-4000-8000-000000000005',
  sourceAppointmentId: '10000000-0000-4000-8000-000000000002',
  sourceSummaryId: '10000000-0000-4000-8000-000000000001',
  specialistId: '10000000-0000-4000-8000-000000000004',
  proposalReasonCode: 'TRY_ALTERNATIVE_RESOURCE' as const,
  proposalDetails: 'Thử nội dung khác sau buổi trao đổi.',
  targetSlotId: 'depression-maintenance',
  currentResource: {
    resourceId: '00000000-0000-4000-8000-000000000208',
    resourceVersion: '1',
    title: 'Bài tập hiện tại',
  },
  proposedResource: {
    resourceId: '00000000-0000-4000-8000-000000000205',
    resourceVersion: '2',
    title: 'Bài đọc được đề xuất',
  },
  currentSupportPlanId: '10000000-0000-4000-8000-000000000020',
  currentSupportPlanVersion: 1,
  replacementSupportPlanId: null,
  replacementSupportPlanVersion: null,
  reviewedAt: '2026-10-02T02:00:00Z',
  decidedAt: null,
  createdAt: '2026-10-02T02:00:00Z',
  updatedAt: '2026-10-02T02:00:00Z',
}

describe('PlanChangeRequestCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires the user to open and explicitly accept the reviewed proposal', async () => {
    api.get.mockRejectedValue(
      new ApiError({
        message: 'Not found',
        code: 'PLAN_CHANGE_REQUEST_NOT_FOUND',
        status: 404,
      }),
    )
    api.create.mockResolvedValue(reviewed)
    api.decide.mockResolvedValue({
      ...reviewed,
      version: 1,
      status: 'ACCEPTED',
      outcomeCode: 'PROPOSAL_APPLIED',
      replacementSupportPlanId: '10000000-0000-4000-8000-000000000021',
      replacementSupportPlanVersion: 1,
      decidedAt: '2026-10-02T02:01:00Z',
    })
    const user = userEvent.setup()
    render(
      <PlanChangeRequestCard
        proposalId={reviewed.sourceProposalId}
        viewer="USER"
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Xem đề xuất thay đổi' }),
    )
    expect(await screen.findByText('Bài tập hiện tại')).toBeInTheDocument()
    expect(screen.getByText('Bài đọc được đề xuất')).toBeInTheDocument()
    expect(api.decide).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Chấp nhận thay đổi' }))
    await waitFor(() =>
      expect(api.decide).toHaveBeenCalledWith(
        reviewed,
        'ACCEPT',
        expect.stringContaining('plan-change-accept:'),
      ),
    )
    expect(
      await screen.findByText('Đã chấp nhận và cập nhật kế hoạch'),
    ).toBeInTheDocument()
  })

  it('shows decision status to the specialist without any decision action', async () => {
    api.get.mockResolvedValue({ ...reviewed, status: 'REJECTED' })
    render(
      <PlanChangeRequestCard
        proposalId={reviewed.sourceProposalId}
        viewer="SPECIALIST"
      />,
    )
    expect(await screen.findByText('Đã từ chối')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
