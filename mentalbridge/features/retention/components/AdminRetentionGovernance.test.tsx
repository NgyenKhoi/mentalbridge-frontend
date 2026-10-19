import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminRetentionGovernance from './AdminRetentionGovernance'
import type {
  DeletionRequest,
  RetentionPolicy,
} from '@/features/auth/api/identity-contract'

const apiMock = vi.hoisted(() => ({
  getPolicies: vi.fn(),
  triggerSweep: vi.fn(),
  getDeletions: vi.fn(),
  retryDeletion: vi.fn(),
  applyHold: vi.fn(),
  releaseHold: vi.fn(),
}))

vi.mock('../api/browser-admin-retention', () => ({
  browserAdminRetention: apiMock,
}))

const mockPolicies: RetentionPolicy[] = [
  {
    policyId: 'IDENTITY_AUDIT_LOGS',
    name: 'Chính sách bảo lưu nhật ký kiểm toán Identity',
    ownerService: 'IDENTITY',
    version: '1.0.0',
    status: 'APPROVED',
    retentionDays: 365,
    automatedExecutionSupported: true,
    manualHoldSupported: false,
    requiresManualReview: false,
    jobStatus: 'ACTIVE',
    jobName: 'identityAuditLogRetentionJob',
    description:
      'Bảo lưu sự kiện kiểm toán tối thiểu hóa danh tính trong 365 ngày.',
    lastExecution: {
      executionId: 'rec-1',
      policyId: 'IDENTITY_AUDIT_LOGS',
      ownerService: 'IDENTITY',
      jobName: 'identityAuditLogRetentionJob',
      jobStatus: 'COMPLETED',
      startedAt: '2026-10-19T02:00:00Z',
      completedAt: '2026-10-19T02:05:00Z',
      itemsEvaluated: 120,
      recordsPurged: 15,
      tombstonesCreated: 0,
      holdsHonored: 0,
    },
  },
  {
    policyId: 'CONTENT_INBOX_PURGE',
    name: 'Chính sách bảo lưu thông báo quản trị Content',
    ownerService: 'CONTENT',
    version: '1.0.0',
    status: 'APPROVED',
    retentionDays: 90,
    automatedExecutionSupported: false,
    manualHoldSupported: false,
    requiresManualReview: false,
    jobStatus: 'UNAVAILABLE',
    jobName: 'contentNotificationSweepJob',
    description:
      'Chỉ lưu trữ tạm thời tin thông báo nội dung không quan trọng.',
    unsupportedCapabilityNotice:
      'Chức năng dọn dẹp tự động của Content Service hiện chưa cung cấp endpoint kích hoạt từ Identity Service (Explicitly Unavailable).',
  },
]

const mockDeletions: DeletionRequest[] = [
  {
    requestId: 'req-001',
    subjectReference:
      'tombstone:948f9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890',
    status: 'IN_PROGRESS',
    holdType: 'NONE',
    retryCount: 1,
    maxRetries: 3,
    escalationState: 'NONE',
    accountStatus: 'DELETION_PENDING',
    requestedAt: '2026-10-18T10:00:00Z',
    scheduledExecutionAt: '2026-10-18T10:00:00Z',
    ownerFacts: [
      {
        ownerService: 'IDENTITY',
        status: 'COMPLETED',
        completedAt: '2026-10-18T10:01:00Z',
        evidenceReference: 'audit:del:identity:001',
      },
      {
        ownerService: 'CARE',
        status: 'PENDING',
      },
    ],
  },
  {
    requestId: 'req-002',
    subjectReference:
      'tombstone:bbbb9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890',
    status: 'HELD',
    holdType: 'LEGAL_HOLD',
    holdReason: 'STATUTORY_INQUIRY',
    retryCount: 0,
    maxRetries: 3,
    escalationState: 'NONE',
    accountStatus: 'DISABLED',
    requestedAt: '2026-10-18T10:30:00Z',
    scheduledExecutionAt: '2026-10-18T10:30:00Z',
    ownerFacts: [
      {
        ownerService: 'IDENTITY',
        status: 'HELD',
        failureReason: 'Active legal hold blocks deletion execution',
      },
    ],
  },
  {
    requestId: 'req-003',
    subjectReference:
      'tombstone:cccc9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890',
    status: 'FAILED',
    holdType: 'NONE',
    retryCount: 3,
    maxRetries: 3,
    escalationState: 'RETRY_EXHAUSTED',
    accountStatus: 'DELETION_PENDING',
    requestedAt: '2026-10-17T08:00:00Z',
    scheduledExecutionAt: '2026-10-17T08:00:00Z',
    ownerFacts: [
      {
        ownerService: 'IDENTITY',
        status: 'COMPLETED',
        evidenceReference: 'audit:del:identity:003',
      },
      {
        ownerService: 'COMMUNITY',
        status: 'FAILED',
        failureReason: 'Downstream timeout during community post anonymization',
      },
    ],
  },
]

describe('AdminRetentionGovernance Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getPolicies.mockResolvedValue(mockPolicies)
    apiMock.getDeletions.mockResolvedValue({
      items: mockDeletions,
      total: mockDeletions.length,
      page: 0,
      size: 20,
    })
    apiMock.triggerSweep.mockResolvedValue({
      executionId: 'rec-new',
      policyId: 'IDENTITY_AUDIT_LOGS',
      ownerService: 'IDENTITY',
      jobName: 'identityAuditLogRetentionJob',
      jobStatus: 'COMPLETED',
      startedAt: '2026-10-19T22:00:00Z',
      completedAt: '2026-10-19T22:01:00Z',
      itemsEvaluated: 50,
      recordsPurged: 10,
      tombstonesCreated: 0,
      holdsHonored: 0,
    })
    apiMock.retryDeletion.mockResolvedValue(mockDeletions[0])
    apiMock.applyHold.mockResolvedValue(mockDeletions[1])
    apiMock.releaseHold.mockResolvedValue(mockDeletions[0])
  })

  it('renders audit-safe guarantee banner and policy information', async () => {
    render(<AdminRetentionGovernance />)

    expect(
      screen.getByTestId('audit-safe-guarantee-notice'),
    ).toBeInTheDocument()
    expect(screen.getByText(/BẢO ĐẢM AUDIT-SAFE/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /Không hiển thị nội dung thô Nhật ký, câu trả lời đánh giá tâm lý/i,
      ),
    ).toBeInTheDocument()

    // Verify policies loaded
    expect(
      await screen.findByText('Chính sách bảo lưu nhật ký kiểm toán Identity'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Phiên bản: 1.0.0 · Chủ sở hữu: IDENTITY/),
    ).toBeInTheDocument()
    expect(screen.getByText('365 ngày')).toBeInTheDocument()
    expect(
      screen.getByText('COMPLETED (15 bản ghi dọn dẹp)'),
    ).toBeInTheDocument()
  })

  it('explicitly renders unsupported capabilities as unavailable rather than simulated', async () => {
    render(<AdminRetentionGovernance />)

    expect(
      await screen.findByText('Chính sách bảo lưu thông báo quản trị Content'),
    ).toBeInTheDocument()

    const notice = screen.getByTestId('unavailable-notice-CONTENT_INBOX_PURGE')
    expect(notice).toHaveTextContent(
      /Chức năng dọn dẹp tự động của Content Service hiện chưa cung cấp endpoint/i,
    )

    const disabledBtn = screen.getByTestId('sweep-disabled-CONTENT_INBOX_PURGE')
    expect(disabledBtn).toBeDisabled()
    expect(disabledBtn).toHaveTextContent('Thực thi không khả dụng')
  })

  it('allows triggering sweep for supported policy and shows safe aggregate feedback', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    const sweepBtn = await screen.findByTestId('sweep-btn-IDENTITY_AUDIT_LOGS')
    expect(sweepBtn).toBeEnabled()

    await user.click(sweepBtn)

    expect(apiMock.triggerSweep).toHaveBeenCalledWith('IDENTITY_AUDIT_LOGS')
    expect(
      await screen.findByText(/Đã dọn dẹp 10 bản ghi hết hạn/i),
    ).toBeInTheDocument()
  })

  it('switches to deletions tab and renders minimized identifiers without raw secrets or text', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    const deletionsTab = screen.getByTestId('tab-deletions')
    await user.click(deletionsTab)

    expect(apiMock.getDeletions).toHaveBeenCalled()
    expect(
      await screen.findByText(
        /tombstone:948f9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890/,
      ),
    ).toBeInTheDocument()

    // Strict privacy verification: Ensure no emails, passwords, raw journals, or chat transcripts exist
    const container = screen.getByTestId('retention-governance-workspace')
    expect(container).not.toHaveTextContent('@example.com')
    expect(container).not.toHaveTextContent('password')
    expect(container).not.toHaveTextContent('journalBody')
    expect(container).not.toHaveTextContent('assessmentAnswers')
  })

  it('renders hold badges and blocks retry when hold is active', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    expect(await screen.findByTestId('hold-badge-req-002')).toHaveTextContent(
      'LEGAL_HOLD: STATUTORY_INQUIRY',
    )

    // Retry button for req-002 (under hold) must be disabled
    const retryBtnReq2 = screen.getByTestId('btn-retry-req-002')
    expect(retryBtnReq2).toBeDisabled()
  })

  it('disables retry button when bounded retry threshold is exhausted', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    // req-003 has retryCount = 3, maxRetries = 3, RETRY_EXHAUSTED
    expect(
      await screen.findByTestId('escalation-badge-req-003'),
    ).toHaveTextContent('RETRY_EXHAUSTED')
    const retryBtnReq3 = screen.getByTestId('btn-retry-req-003')
    expect(retryBtnReq3).toBeDisabled()
  })

  it('expands owner facts to show cross-service audit evidence', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    const expandBtn = await screen.findByTestId('btn-expand-req-001')
    await user.click(expandBtn)

    const factsPanel = screen.getByTestId('facts-panel-req-001')
    expect(factsPanel).toBeInTheDocument()
    expect(factsPanel).toHaveTextContent('IDENTITY')
    expect(factsPanel).toHaveTextContent('Bằng chứng: audit:del:identity:001')
    expect(factsPanel).toHaveTextContent('CARE')
    expect(factsPanel).toHaveTextContent('PENDING')
  })

  it('opens hold modal and submits applyHold', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    const applyHoldBtn = await screen.findByTestId('btn-apply-hold-req-001')
    await user.click(applyHoldBtn)

    expect(screen.getByTestId('hold-modal')).toBeInTheDocument()
    expect(screen.getByText('Áp dụng lệnh Hold bảo lưu')).toBeInTheDocument()

    const confirmBtn = screen.getByTestId('btn-confirm-apply-hold')
    await user.click(confirmBtn)

    expect(apiMock.applyHold).toHaveBeenCalledWith('req-001', {
      holdType: 'LEGAL_HOLD',
      holdReason: 'STATUTORY_INQUIRY',
    })
  })
})
