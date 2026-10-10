import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { consultationBriefBrowserClient } from '@/features/appointments/api/consultation-brief-browser-client'
import SpecialistClientsManager from './SpecialistClientsManager'

vi.mock(
  '@/features/appointments/components/SpecialistConsultationBrief',
  () => ({
    SpecialistConsultationBrief: ({
      appointmentId,
    }: {
      appointmentId: string
    }) => <div>Tóm tắt {appointmentId}</div>,
  }),
)
vi.mock('@/features/appointments/components/SessionSummaryPanel', () => ({
  SessionSummaryPanel: ({ appointmentId }: { appointmentId: string }) => (
    <div>Tổng kết {appointmentId}</div>
  ),
}))
vi.mock(
  '@/features/appointments/api/consultation-brief-browser-client',
  () => ({
    consultationBriefBrowserClient: {
      specialistContinuity: vi.fn(),
    },
  }),
)

const appointmentId = '10000000-0000-4000-8000-000000000001'

describe('SpecialistClientsManager', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders only appointment-authorized continuity rows from the API', async () => {
    vi.mocked(
      consultationBriefBrowserClient.specialistContinuity,
    ).mockResolvedValue({
      items: [
        {
          appointmentId,
          userAccountId: '10000000-0000-4000-8000-000000000002',
          userDisplayName: 'Nguyễn Minh Anh',
          status: 'CONFIRMED',
          modality: 'IN_APP_CHAT',
          scheduledStartAt: '2026-10-04T10:00:00Z',
          scheduledEndAt: '2026-10-04T11:00:00Z',
          appointmentVersion: 1,
          briefAccessState: 'AVAILABLE',
          briefSnapshotVersion: 2,
          briefAccessStartAt: '2026-10-03T10:00:00Z',
          briefAccessEndAt: '2026-10-05T10:00:00Z',
        },
      ],
      count: 1,
      generatedAt: '2026-10-04T09:00:00Z',
      recentSince: '2026-07-06T09:00:00Z',
      policyVersion: 'specialist-client-continuity-v1',
    })

    render(<SpecialistClientsManager />)

    await waitFor(() =>
      expect(screen.getAllByText('Nguyễn Minh Anh').length).toBeGreaterThan(0),
    )
    expect(screen.getByText('Có thể xem lúc này')).toBeInTheDocument()
    expect(screen.queryByText(/ConsultationBrief/)).not.toBeInTheDocument()
    expect(screen.getByText(`Tóm tắt ${appointmentId}`)).toBeInTheDocument()
    expect(screen.queryByText('Trần Gia Hân')).not.toBeInTheDocument()
  })

  it('does not request brief content when the authority projection says access is revoked', async () => {
    vi.mocked(
      consultationBriefBrowserClient.specialistContinuity,
    ).mockResolvedValue({
      items: [
        {
          appointmentId,
          userAccountId: '10000000-0000-4000-8000-000000000002',
          userDisplayName: 'Nguyễn Minh Anh',
          status: 'CONFIRMED',
          modality: 'IN_APP_CHAT',
          scheduledStartAt: '2026-10-04T10:00:00Z',
          scheduledEndAt: '2026-10-04T11:00:00Z',
          appointmentVersion: 1,
          briefAccessState: 'REVOKED',
          briefSnapshotVersion: 2,
          briefAccessStartAt: '2026-10-03T10:00:00Z',
          briefAccessEndAt: '2026-10-05T10:00:00Z',
        },
      ],
      count: 1,
      generatedAt: '2026-10-04T09:00:00Z',
      recentSince: '2026-07-06T09:00:00Z',
      policyVersion: 'specialist-client-continuity-v1',
    })

    render(<SpecialistClientsManager />)

    expect(
      (await screen.findAllByText('Quyền đã được thu hồi')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/Người dùng đã thu hồi quyền chia sẻ/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Tóm tắt ${appointmentId}`),
    ).not.toBeInTheDocument()
  })

  it('supports empty search recovery, keyboard tabs and safe display of access scope', async () => {
    const item = {
      appointmentId,
      userAccountId: '10000000-0000-4000-8000-000000000002',
      userDisplayName: 'Nguyễn Minh Anh',
      status: 'CONFIRMED' as const,
      modality: 'IN_APP_CHAT' as const,
      scheduledStartAt: '2026-10-04T10:00:00Z',
      scheduledEndAt: '2026-10-04T11:00:00Z',
      appointmentVersion: 1,
      briefAccessState: 'AVAILABLE' as const,
      briefSnapshotVersion: 2,
      briefAccessStartAt: '2026-10-03T10:00:00Z',
      briefAccessEndAt: '2026-10-05T10:00:00Z',
    }
    vi.mocked(
      consultationBriefBrowserClient.specialistContinuity,
    ).mockResolvedValue({
      items: [item],
      count: 1,
      generatedAt: '2026-10-04T09:00:00Z',
      recentSince: '2026-07-06T09:00:00Z',
      policyVersion: 'specialist-client-continuity-v1',
    })
    const user = userEvent.setup()
    render(<SpecialistClientsManager />)
    const search = await screen.findByRole('textbox', {
      name: 'Tìm khách hàng',
    })
    await user.type(search, 'không tìm thấy')
    expect(
      screen.getByText('Không tìm thấy khách hàng phù hợp.'),
    ).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Xóa tìm kiếm' })[0])
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    screen.getByRole('tab', { name: 'Chuẩn bị phiên' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Phạm vi truy cập' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Thời gian được xem:',
    )
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(appointmentId)
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(
      'ConsultationBrief',
    )
  })
})
