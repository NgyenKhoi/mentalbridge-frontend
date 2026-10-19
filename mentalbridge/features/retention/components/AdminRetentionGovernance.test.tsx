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
    policyId: 'MB-IDENTITY-REPORTING-001',
    name: 'Chính sách bảo lưu báo cáo phân tích tổng hợp',
    ownerService: 'IDENTITY',
    version: '1.0',
    status: 'APPROVED',
    retentionDays: 90,
    automatedExecutionSupported: true,
    manualHoldSupported: false,
    requiresManualReview: false,
    jobStatus: 'ACTIVE',
    jobName: 'IDENTITY_REPORTING_SWEEP',
    description:
      'Bảo lưu các tệp trích xuất báo cáo phân tích trong 90 ngày.',
    lastExecution: {
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'IDENTITY_REPORTING_SWEEP',
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
    policyId: 'MB-CONTENT-NOTIFICATION-RETENTION-001',
    name: 'Chính sách bảo lưu hộp thư thông báo',
    ownerService: 'CONTENT',
    version: '1.0',
    status: 'APPROVED',
    retentionDays: 90,
    automatedExecutionSupported: false,
    manualHoldSupported: false,
    requiresManualReview: false,
    jobStatus: 'UNAVAILABLE',
    jobName: 'NOTIFICATION_INBOX_RETENTION',
    description:
      'Hộp thư thông báo lưu trữ 90 ngày',
    unsupportedCapabilityNotice:
      'Chức năng dọn dẹp tự động của Content Service hiện chưa cung cấp endpoint kích hoạt từ Identity Service (Explicitly Unavailable).',
  },
]

const mockDeletions: DeletionRequest[] = [
  {
    requestId: '948f9e80-d3bc-45aa-91f6-044dd5afbf71',
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
    requestId: '948f9e80-d3bc-45aa-91f6-044dd5afbf72',
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
    requestId: '948f9e80-d3bc-45aa-91f6-044dd5afbf73',
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
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'IDENTITY_REPORTING_SWEEP',
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
      await screen.findByText('Chính sách bảo lưu báo cáo phân tích tổng hợp'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Phiên bản: 1.0 · Chủ sở hữu: IDENTITY/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('90 ngày')).toHaveLength(2)
    expect(
      screen.getByText('COMPLETED (15 bản ghi dọn dẹp)'),
    ).toBeInTheDocument()
  })

  it('explicitly renders unsupported capabilities as unavailable rather than simulated', async () => {
    render(<AdminRetentionGovernance />)

    expect(
      await screen.findByText('Chính sách bảo lưu hộp thư thông báo'),
    ).toBeInTheDocument()

    const notice = screen.getByTestId('unavailable-notice-MB-CONTENT-NOTIFICATION-RETENTION-001')
    expect(notice).toHaveTextContent(
      /Chức năng dọn dẹp tự động của Content Service hiện chưa cung cấp endpoint/i,
    )

    const disabledBtn = screen.getByTestId('sweep-disabled-MB-CONTENT-NOTIFICATION-RETENTION-001')
    expect(disabledBtn).toBeDisabled()
    expect(disabledBtn).toHaveTextContent('Thực thi không khả dụng')
  })

  it('allows triggering sweep for supported policy and shows safe aggregate feedback', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    const sweepBtn = await screen.findByTestId('sweep-btn-MB-IDENTITY-REPORTING-001')
    expect(sweepBtn).toBeEnabled()

    await user.click(sweepBtn)

    expect(apiMock.triggerSweep).toHaveBeenCalledWith('MB-IDENTITY-REPORTING-001')
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

    expect(await screen.findByTestId('hold-badge-948f9e80-d3bc-45aa-91f6-044dd5afbf72')).toHaveTextContent(
      'LEGAL_HOLD: STATUTORY_INQUIRY',
    )

    // Retry button for 948f9e80-d3bc-45aa-91f6-044dd5afbf72 (under hold) must be disabled
    const retryBtnReq2 = screen.getByTestId('btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf72')
    expect(retryBtnReq2).toBeDisabled()
  })

  it('disables retry button when bounded retry threshold is exhausted', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    // 948f9e80-d3bc-45aa-91f6-044dd5afbf73 has retryCount = 3, maxRetries = 3, RETRY_EXHAUSTED
    expect(
      await screen.findByTestId('escalation-badge-948f9e80-d3bc-45aa-91f6-044dd5afbf73'),
    ).toHaveTextContent('RETRY_EXHAUSTED')
    const retryBtnReq3 = screen.getByTestId('btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf73')
    expect(retryBtnReq3).toBeDisabled()
  })

  it('expands owner facts to show cross-service audit evidence', async () => {
    const user = userEvent.setup()
    render(<AdminRetentionGovernance />)

    await user.click(screen.getByTestId('tab-deletions'))

    const expandBtn = await screen.findByTestId('btn-expand-948f9e80-d3bc-45aa-91f6-044dd5afbf71')
    await user.click(expandBtn)

    const factsPanel = screen.getByTestId('facts-panel-948f9e80-d3bc-45aa-91f6-044dd5afbf71')
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

    const applyHoldBtn = await screen.findByTestId('btn-apply-hold-948f9e80-d3bc-45aa-91f6-044dd5afbf71')
    await user.click(applyHoldBtn)

    expect(screen.getByTestId('hold-modal')).toBeInTheDocument()
    expect(screen.getByText('Áp dụng lệnh Hold bảo lưu')).toBeInTheDocument()

    const confirmBtn = screen.getByTestId('btn-confirm-apply-hold')
    await user.click(confirmBtn)

    expect(apiMock.applyHold).toHaveBeenCalledWith('948f9e80-d3bc-45aa-91f6-044dd5afbf71', {
      holdType: 'LEGAL_HOLD',
      holdReason: 'STATUTORY_INQUIRY',
    })
  })
})
