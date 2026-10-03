import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionSummaryPanel } from './SessionSummaryPanel'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  publish: vi.fn(),
  updateConsent: vi.fn(),
  updateStep: vi.fn(),
}))
const resources = vi.hoisted(() => ({
  catalogue: vi.fn(),
  detail: vi.fn(),
}))

vi.mock('../api/session-summary-browser-client', () => ({
  sessionSummaryBrowserClient: api,
}))
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: resources.catalogue,
  getResourceDetail: resources.detail,
}))

const appointmentId = '10000000-0000-4000-8000-000000000002'
const summary = {
  id: '10000000-0000-4000-8000-000000000001',
  appointmentId,
  userAccountId: '10000000-0000-4000-8000-000000000003',
  specialistAccountId: '10000000-0000-4000-8000-000000000004',
  version: 1,
  schemaVersion: 'session-summary-v1' as const,
  topicsDiscussed: ['Giấc ngủ'],
  progressSummary: 'Đã cùng nhìn lại thói quen gần đây.',
  specialistNoteForUser: null,
  followUpSuggested: false,
  amendsSummaryId: null,
  publishedAt: '2026-10-02T02:00:00Z',
  reuseConsent: {
    approved: false,
    version: 0,
    updatedAt: '2026-10-02T02:00:00Z',
  },
  agreedNextSteps: [
    {
      id: '10000000-0000-4000-8000-000000000005',
      type: 'JOURNAL' as const,
      title: 'Viết nhật ký 3 ngày',
      details: 'Ghi lại giờ ngủ.',
      resourceId: null,
      resourceVersion: null,
      resourceProposalReasonCode: null,
      state: 'PENDING' as const,
      hidden: false,
      stateVersion: 0,
      stateUpdatedAt: '2026-10-02T02:00:00Z',
    },
  ],
}

describe('SessionSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resources.catalogue.mockResolvedValue({ items: [], hasMore: false })
  })

  it('lets the assigned specialist publish a bounded first summary', async () => {
    api.list.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-10-02T02:00:00Z',
    })
    api.publish.mockResolvedValue(summary)
    const user = userEvent.setup()
    render(
      <SessionSummaryPanel appointmentId={appointmentId} viewer="SPECIALIST" />,
    )

    await user.click(screen.getByText('Tóm tắt sau phiên'))
    await user.click(
      await screen.findByRole('button', { name: 'Tạo bản tóm tắt' }),
    )
    await user.type(screen.getByLabelText(/Nội dung đã trao đổi/), 'Giấc ngủ')
    await user.click(
      screen.getByRole('button', { name: 'Xuất bản cho người dùng' }),
    )

    await waitFor(() => expect(api.publish).toHaveBeenCalled())
    expect(api.publish.mock.calls[0][0]).toBe(appointmentId)
    expect(api.publish.mock.calls[0][1]).toMatchObject({
      topicsDiscussed: ['Giấc ngủ'],
      agreedNextSteps: [],
    })
    expect(await screen.findByText('Phiên bản 1')).toBeInTheDocument()
  })

  it('keeps next-step state and future reuse under user control', async () => {
    api.list.mockResolvedValue({
      items: [summary],
      count: 1,
      generatedAt: '2026-10-02T02:00:00Z',
    })
    api.updateConsent.mockResolvedValue({
      ...summary,
      reuseConsent: { ...summary.reuseConsent, approved: true, version: 1 },
    })
    api.updateStep.mockResolvedValue({
      ...summary,
      agreedNextSteps: [
        { ...summary.agreedNextSteps[0], state: 'COMPLETED', stateVersion: 1 },
      ],
    })
    const user = userEvent.setup()
    render(<SessionSummaryPanel appointmentId={appointmentId} viewer="USER" />)

    await user.click(screen.getByText('Tóm tắt sau phiên'))
    const state = await screen.findByLabelText('Trạng thái Viết nhật ký 3 ngày')
    await user.selectOptions(state, 'COMPLETED')
    await waitFor(() =>
      expect(api.updateStep).toHaveBeenCalledWith(
        summary.agreedNextSteps[0].id,
        { state: 'COMPLETED', hidden: false },
        0,
      ),
    )
    await user.click(screen.getByRole('checkbox'))
    await waitFor(() =>
      expect(api.updateConsent).toHaveBeenCalledWith(summary.id, true, 0),
    )
    expect(
      screen.getByText(/Chuyên gia chỉ xem được khi bạn phê duyệt hồ sơ đó/),
    ).toBeInTheDocument()
  })

  it('prefills an amendment with the current agreed next steps', async () => {
    api.list.mockResolvedValue({
      items: [summary],
      count: 1,
      generatedAt: '2026-10-02T02:00:00Z',
    })
    api.publish.mockResolvedValue({ ...summary, version: 2 })
    const user = userEvent.setup()
    render(
      <SessionSummaryPanel appointmentId={appointmentId} viewer="SPECIALIST" />,
    )

    await user.click(screen.getByText('Tóm tắt sau phiên'))
    await user.click(
      await screen.findByRole('button', { name: 'Đính chính bản tóm tắt' }),
    )
    expect(screen.getByLabelText('Tên bước 1')).toHaveValue(
      'Viết nhật ký 3 ngày',
    )
    expect(screen.getByLabelText('Chi tiết bước 1')).toHaveValue(
      'Ghi lại giờ ngủ.',
    )

    await user.click(
      screen.getByRole('button', { name: 'Xuất bản bản đính chính' }),
    )
    await waitFor(() => expect(api.publish).toHaveBeenCalled())
    expect(api.publish.mock.calls[0][1].agreedNextSteps).toEqual([
      {
        type: 'JOURNAL',
        title: 'Viết nhật ký 3 ngày',
        details: 'Ghi lại giờ ngủ.',
        resourceId: null,
        resourceVersion: null,
        resourceProposalReasonCode: null,
      },
    ])
  })

  it('lets the user revoke reuse for an older immutable version', async () => {
    const latest = {
      ...summary,
      id: '10000000-0000-4000-8000-000000000006',
      version: 2,
      amendsSummaryId: summary.id,
      agreedNextSteps: [],
    }
    const previous = {
      ...summary,
      reuseConsent: { ...summary.reuseConsent, approved: true, version: 1 },
    }
    api.list.mockResolvedValue({
      items: [latest, previous],
      count: 2,
      generatedAt: '2026-10-02T02:00:00Z',
    })
    api.updateConsent.mockResolvedValue({
      ...previous,
      reuseConsent: { ...previous.reuseConsent, approved: false, version: 2 },
    })
    const user = userEvent.setup()
    render(<SessionSummaryPanel appointmentId={appointmentId} viewer="USER" />)

    await user.click(screen.getByText('Tóm tắt sau phiên'))
    await user.click(await screen.findByText('Xem 1 phiên bản trước'))
    const approvals = screen.getAllByRole('checkbox')
    const previousApproval = approvals.find(
      (input) => (input as HTMLInputElement).checked,
    )
    expect(previousApproval).toBeDefined()
    await user.click(previousApproval as HTMLInputElement)

    await waitFor(() =>
      expect(api.updateConsent).toHaveBeenCalledWith(previous.id, false, 1),
    )
  })
})
