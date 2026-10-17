import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCommunityModerationAction,
  getCommunityModerationCases,
} from '@/features/community/api/browser-community'
import AdminCommunityModerationSection from './AdminCommunityModerationSection'

vi.mock('@/features/community/api/browser-community', () => ({
  createCommunityModerationAction: vi.fn(),
  getCommunityModerationCases: vi.fn(),
}))

const moderationCase = {
  caseId: '10000000-0000-4000-8000-000000000001',
  targetType: 'POST' as const,
  targetId: '20000000-0000-4000-8000-000000000001',
  state: 'OPEN' as const,
  priority: 'HIGH' as const,
  reportReasons: ['SELF_HARM_OR_CRISIS_CONCERN' as const],
  reportContexts: ['Người báo cáo đề nghị đội ngũ xem xét sớm.'],
  evidence: { content: 'Nội dung bằng chứng.', state: 'ACTIVE', version: 2 },
  actions: [],
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  version: 0,
}

describe('AdminCommunityModerationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCommunityModerationCases).mockResolvedValue([moderationCase])
    vi.mocked(createCommunityModerationAction).mockResolvedValue({
      ...moderationCase,
      state: 'RESOLVED',
      version: 1,
    })
  })

  it('filters minimized evidence and records an idempotent moderation decision', async () => {
    render(<AdminCommunityModerationSection />)

    expect(await screen.findByText('Nội dung bằng chứng.')).toBeInTheDocument()
    expect(
      screen.getByText('Người báo cáo đề nghị đội ngũ xem xét sớm.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Loại nội dung'), {
      target: { value: 'POST' },
    })
    await waitFor(() =>
      expect(getCommunityModerationCases).toHaveBeenLastCalledWith({
        state: 'OPEN',
        targetType: 'POST',
        priority: undefined,
      }),
    )

    fireEvent.change(screen.getByLabelText('Quyết định'), {
      target: { value: 'HIDE' },
    })
    fireEvent.change(screen.getByLabelText('Mã lý do'), {
      target: { value: 'confirmed_risk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi quyết định' }))

    await waitFor(() =>
      expect(createCommunityModerationAction).toHaveBeenCalledOnce(),
    )
    expect(createCommunityModerationAction).toHaveBeenCalledWith(
      moderationCase.caseId,
      { action: 'HIDE', reasonCode: 'CONFIRMED_RISK' },
      expect.any(String),
    )
    expect(
      await screen.findByText('Quyết định đã được ghi vào nhật ký kiểm duyệt.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Nội dung bằng chứng.')).not.toBeInTheDocument()
  })

  it('offers audited warning actions only for post cases', async () => {
    const { unmount } = render(<AdminCommunityModerationSection />)

    expect(
      await screen.findByRole('option', { name: 'Thêm cảnh báo nhạy cảm' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Gỡ cảnh báo nhạy cảm' }),
    ).toBeInTheDocument()

    unmount()
    vi.mocked(getCommunityModerationCases).mockResolvedValueOnce([
      { ...moderationCase, targetType: 'COMMENT' },
    ])
    render(<AdminCommunityModerationSection />)

    await screen.findByText('Nội dung bằng chứng.')
    expect(
      screen.queryByRole('option', { name: 'Thêm cảnh báo nhạy cảm' }),
    ).not.toBeInTheDocument()
  })
})
