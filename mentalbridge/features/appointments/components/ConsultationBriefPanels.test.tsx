import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationBriefEditor } from './ConsultationBriefEditor'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'

const api = vi.hoisted(() => ({
  screeningContexts: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  action: vi.fn(),
  specialist: vi.fn(),
}))

vi.mock('../api/consultation-brief-browser-client', () => ({
  consultationBriefBrowserClient: api,
}))

const appointmentId = '10000000-0000-4000-8000-000000000001'
const evaluationId = '10000000-0000-4000-8000-000000000002'
const brief = {
  id: '10000000-0000-4000-8000-000000000003',
  appointmentId,
  status: 'DRAFT' as const,
  currentSituation: 'Áp lực công việc gần đây',
  supportEvaluationId: evaluationId,
  screeningContext: [
    {
      instrument: 'PHQ9' as const,
      domain: 'DEPRESSIVE_SYMPTOMS' as const,
      screeningLevel: 'MILD' as const,
      questionnaireVersion: 'phq9-v2',
      scoringVersion: 'phq9-score-v1',
      evaluatedAt: '2026-09-28T10:00:00Z',
      policyVersion: 'routing-v2',
    },
    {
      instrument: 'GAD7' as const,
      domain: 'ANXIETY_SYMPTOMS' as const,
      screeningLevel: 'MODERATE' as const,
      questionnaireVersion: 'gad7-v1',
      scoringVersion: 'gad7-score-v1',
      evaluatedAt: '2026-09-28T10:00:00Z',
      policyVersion: 'routing-v2',
    },
  ],
  userGoals: ['Tìm bước tiếp theo phù hợp'],
  approvedSnapshotId: null,
  sharingStatus: 'NONE' as const,
  accessStartAt: null,
  accessEndAt: null,
  version: 0,
  updatedAt: '2026-09-28T10:00:00Z',
}

describe('ConsultationBrief panels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.screeningContexts.mockResolvedValue({
      items: [
        {
          supportEvaluationId: evaluationId,
          evaluatedAt: '2026-09-28T10:00:00Z',
          screeningContext: brief.screeningContext,
        },
      ],
      count: 1,
    })
    api.get.mockResolvedValue(brief)
  })

  it('requires explicit confirmation before approving the exact draft', async () => {
    api.action.mockResolvedValue({
      ...brief,
      status: 'APPROVED',
      sharingStatus: 'ACTIVE',
      approvedSnapshotId: '10000000-0000-4000-8000-000000000004',
      version: 1,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Phê duyệt chia sẻ' }),
    )
    expect(api.action).not.toHaveBeenCalled()
    const confirmationButtons = screen.getAllByRole('button', {
      name: 'Phê duyệt chia sẻ',
    })
    await user.click(confirmationButtons[confirmationButtons.length - 1])

    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(appointmentId, 'approve', 0),
    )
    expect(await screen.findByText('Đang chia sẻ')).toBeInTheDocument()
  })

  it('cannot approve form edits until that exact draft is saved', async () => {
    api.save.mockResolvedValue({
      ...brief,
      currentSituation: 'Áp lực đã thay đổi',
      version: 1,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    const situation = await screen.findByLabelText('Tình hình hiện tại')
    await user.clear(situation)
    await user.type(situation, 'Áp lực đã thay đổi')
    expect(
      screen.getByRole('button', { name: 'Phê duyệt chia sẻ' }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Hãy lưu thay đổi để phê duyệt đúng nội dung đang hiển thị.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))

    await waitFor(() => expect(api.save).toHaveBeenCalled())
    expect(
      screen.getByRole('button', { name: 'Phê duyệt chia sẻ' }),
    ).toBeEnabled()
  })

  it('shows a truthful revoked-access state to the assigned specialist', async () => {
    api.specialist.mockRejectedValue(
      new ApiError({
        message: 'denied',
        code: 'CONSULTATION_BRIEF_ACCESS_DENIED',
        status: 403,
      }),
    )
    const user = userEvent.setup()
    render(<SpecialistConsultationBrief appointmentId={appointmentId} />)

    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))

    expect(
      await screen.findByText(
        'Người dùng chưa phê duyệt hoặc đã thu hồi quyền truy cập.',
      ),
    ).toBeInTheDocument()
  })

  it('clears a previously loaded snapshot when reload is denied', async () => {
    api.specialist
      .mockResolvedValueOnce({
        snapshotId: '10000000-0000-4000-8000-000000000004',
        appointmentId,
        currentSituation: 'Nội dung chỉ được xem khi grant còn hiệu lực',
        supportEvaluationId: evaluationId,
        screeningContext: brief.screeningContext,
        userGoals: brief.userGoals,
        snapshotVersion: 1,
        approvedAt: '2026-09-28T10:00:00Z',
      })
      .mockRejectedValueOnce(
        new ApiError({
          message: 'revoked',
          code: 'CONSULTATION_BRIEF_ACCESS_DENIED',
          status: 403,
        }),
      )
    const user = userEvent.setup()
    render(<SpecialistConsultationBrief appointmentId={appointmentId} />)

    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))
    expect(
      await screen.findByText('Nội dung chỉ được xem khi grant còn hiệu lực'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))

    expect(
      await screen.findByText(
        'Người dùng chưa phê duyệt hoặc đã thu hồi quyền truy cập.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Nội dung chỉ được xem khi grant còn hiệu lực'),
    ).not.toBeInTheDocument()
  })

  it('requires a new approval after the appointment changes', async () => {
    api.specialist.mockRejectedValue(
      new ApiError({
        message: 'changed',
        code: 'CONSULTATION_BRIEF_APPOINTMENT_CHANGED',
        status: 403,
      }),
    )
    const user = userEvent.setup()
    render(<SpecialistConsultationBrief appointmentId={appointmentId} />)

    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))

    expect(
      await screen.findByText(
        'Lịch hẹn đã thay đổi. Người dùng cần xem lại và phê duyệt một bản tóm tắt mới.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps revoke available when the screening source list is empty', async () => {
    api.screeningContexts.mockResolvedValue({ items: [], count: 0 })
    api.get.mockResolvedValue({
      ...brief,
      status: 'APPROVED',
      approvedSnapshotId: '10000000-0000-4000-8000-000000000004',
      sharingStatus: 'ACTIVE',
      accessStartAt: '2026-09-28T09:00:00Z',
      accessEndAt: '2026-09-30T09:00:00Z',
      version: 1,
    })
    api.action.mockResolvedValue({
      ...brief,
      status: 'APPROVED',
      approvedSnapshotId: '10000000-0000-4000-8000-000000000004',
      sharingStatus: 'REVOKED',
      accessStartAt: '2026-09-28T09:00:00Z',
      accessEndAt: '2026-09-30T09:00:00Z',
      version: 2,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Thu hồi quyền truy cập' }),
    )

    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(appointmentId, 'revoke', 1),
    )
  })

  it.each([
    [
      'CONSULTATION_BRIEF_ACCESS_EXPIRED',
      'Khung thời gian đọc tóm tắt đã kết thúc.',
    ],
    ['CONSULTATION_BRIEF_UNAVAILABLE', 'Bản tóm tắt hoặc nguồn đã bị xóa.'],
  ])('shows truthful specialist state for %s', async (code, copy) => {
    api.specialist.mockRejectedValue(
      new ApiError({ message: 'denied', code, status: 403 }),
    )
    const user = userEvent.setup()
    render(<SpecialistConsultationBrief appointmentId={appointmentId} />)

    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))

    expect(await screen.findByText(copy)).toBeInTheDocument()
  })
})
