import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationBriefEditor } from './ConsultationBriefEditor'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'

const api = vi.hoisted(() => ({
  screeningContexts: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  action: vi.fn(),
  requestAiDraft: vi.fn(),
  aiDraftJob: vi.fn(),
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

const aiJob = {
  jobId: '10000000-0000-4000-8000-000000000005',
  appointmentId,
  consultationBriefId: brief.id,
  consultationBriefVersion: 0,
  supportEvaluationId: evaluationId,
  sourceSetVersion: 'consultation-brief-ai-source-v1' as const,
  status: 'SUCCEEDED' as const,
  attemptCount: 1,
  terminalReason: null,
  currentSituation: 'Gợi ý tình hình hiện tại từ AI',
  userGoals: ['Trao đổi một bước tiếp theo phù hợp'],
  consentPolicyVersion: 'ai-processing-capstone-v2',
  servicePlan: 'PLUS',
  entitlementSource: 'DEMO',
  entitlementPolicyVersion: 'service-entitlement-v1',
  entitlementVersion: 1,
  routingPolicyVersion: 'exact-revision-routing-v1',
  providerApprovalVersion: 'benchmark-approval-v1',
  provider: 'GEMINI',
  model: 'gemini-approved',
  promptVersion: 'consultation-brief-draft-v1',
  schemaVersion: 1,
  createdAt: '2026-09-28T10:00:00Z',
  updatedAt: '2026-09-28T10:00:01Z',
  completedAt: '2026-09-28T10:00:01Z',
}

const disclosure = {
  consentType: 'AI_PROCESSING',
  version: 'ai-processing-capstone-v2',
  locale: 'vi-VN',
  title: 'Đồng ý xử lý dữ liệu bằng AI',
  content: 'AI chỉ tạo gợi ý từ bản tóm tắt đã lưu.',
  capstoneOnly: true,
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = String(input)
        if (url === '/api/care/consents')
          return Promise.resolve(
            json({
              decisions: [
                {
                  decisionId: '30000000-0000-4000-8000-000000000001',
                  consentType: 'AI_PROCESSING',
                  policyVersion: 'ai-processing-capstone-v2',
                  granted: true,
                  decidedAt: '2026-09-28T10:00:00Z',
                },
              ],
            }),
          )
        if (url === '/api/care/ai-processing-disclosure')
          return Promise.resolve(json(disclosure))
        return Promise.resolve(json({ code: 'RESOURCE_NOT_FOUND' }, 404))
      }),
    )
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('applies an exact AI suggestion as editable unsaved fields', async () => {
    api.requestAiDraft.mockResolvedValue(aiJob)
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Gợi ý bản nháp với AI' }),
    )

    expect(screen.getByLabelText('Tình hình hiện tại')).toHaveValue(
      'Gợi ý tình hình hiện tại từ AI',
    )
    expect(
      screen.getByText(
        'Gợi ý của AI — hãy xem lại và chỉnh sửa trước khi lưu.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Phê duyệt chia sẻ' }),
    ).toBeDisabled()
    expect(api.save).not.toHaveBeenCalled()
    expect(api.action).not.toHaveBeenCalled()
  })

  it('preserves edits made while the AI suggestion is running', async () => {
    let resolveJob!: (value: typeof aiJob) => void
    api.requestAiDraft.mockImplementation(
      () =>
        new Promise<typeof aiJob>((resolve) => {
          resolveJob = resolve
        }),
    )
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Gợi ý bản nháp với AI' }),
    )
    const situation = screen.getByLabelText('Tình hình hiện tại')
    await user.clear(situation)
    await user.type(situation, 'Nội dung người dùng vừa chỉnh sửa')
    await act(async () => resolveJob(aiJob))

    expect(situation).toHaveValue('Nội dung người dùng vừa chỉnh sửa')
    expect(
      await screen.findByText(
        'Nguồn của gợi ý không còn khớp với bản nháp hiện tại.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps the manual draft usable when AI generation fails', async () => {
    api.requestAiDraft.mockResolvedValue({
      ...aiJob,
      status: 'FAILED',
      terminalReason: 'PROVIDER_UNAVAILABLE',
      currentSituation: null,
      userGoals: null,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ConsultationBriefEditor appointmentId={appointmentId} />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Gợi ý bản nháp với AI' }),
    )

    expect(
      await screen.findByText(
        'AI chưa thể tạo gợi ý. Bạn vẫn có thể tiếp tục chỉnh sửa thủ công.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Tình hình hiện tại')).toHaveValue(
      brief.currentSituation,
    )
    expect(screen.getByRole('button', { name: 'Lưu bản nháp' })).toBeEnabled()
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
