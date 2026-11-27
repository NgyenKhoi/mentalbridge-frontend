import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { PriorSessionSummaries } from './PriorSessionSummaries'

const api = vi.hoisted(() => ({ reusable: vi.fn() }))
vi.mock('../api/session-summary-browser-client', () => ({
  sessionSummaryBrowserClient: api,
}))

const appointmentId = '89100000-0000-4000-8000-000000000001'
const summary = (id: string, topic: string) => ({
  id,
  appointmentId: '89100000-0000-4000-8000-000000000009',
  userAccountId: '89100000-0000-4000-8000-000000000003',
  specialistAccountId: '89100000-0000-4000-8000-000000000004',
  version: 1,
  schemaVersion: 'session-summary-v1' as const,
  topicsDiscussed: [topic],
  progressSummary: 'Đã cùng nhìn lại nhịp ngủ gần đây.',
  specialistNoteForUser: null,
  followUpSuggested: true,
  amendsSummaryId: null,
  publishedAt: '2026-11-05T14:00:00Z',
  reuseConsent: null,
  agreedNextSteps: [
    {
      id: `${id.slice(0, -1)}9`,
      type: 'JOURNAL' as const,
      title: 'Viết nhật ký 3 ngày',
      details: null,
      resourceId: null,
      resourceVersion: null,
      resourceProposalReasonCode: null,
      state: null,
      hidden: false,
      stateVersion: null,
      stateUpdatedAt: null,
    },
  ],
})

beforeEach(() => vi.resetAllMocks())

it('lists approved earlier summaries newest first with who wrote them', async () => {
  api.reusable.mockResolvedValue({
    items: [
      {
        summary: summary('89100000-0000-4000-8000-000000000011', 'Giấc ngủ'),
        sessionStartedAt: '2026-11-05T12:00:00Z',
        specialistDisplayName: 'ThS. Minh An',
        sameSpecialist: false,
      },
      {
        summary: summary('89100000-0000-4000-8000-000000000021', 'Áp lực'),
        sessionStartedAt: '2026-10-20T12:00:00Z',
        specialistDisplayName: 'Bạn',
        sameSpecialist: true,
      },
    ],
    count: 2,
    generatedAt: '2026-11-18T13:00:00Z',
  })
  render(<PriorSessionSummaries appointmentId={appointmentId} />)

  expect(
    await screen.findByRole('heading', { name: 'Tổng kết từ các phiên trước' }),
  ).toBeInTheDocument()
  expect(await screen.findByText('Ghi bởi ThS. Minh An')).toBeInTheDocument()
  expect(screen.getByText('Bạn đã ghi')).toBeInTheDocument()
  expect(api.reusable).toHaveBeenCalledWith(appointmentId)
  const entries = screen.getAllByRole('group')
  expect(entries[0]).toHaveAttribute('open')
  expect(entries[1]).not.toHaveAttribute('open')
  expect(screen.getAllByText('Viết nhật ký 3 ngày')[0]).toBeVisible()
  for (const meta of screen.queryAllByText(/Phiên bản/))
    expect(meta).not.toBeVisible()
})

it('explains an empty list and a closed access window without blame', async () => {
  api.reusable.mockResolvedValueOnce({
    items: [],
    count: 0,
    generatedAt: '2026-11-18T13:00:00Z',
  })
  const { unmount } = render(
    <PriorSessionSummaries appointmentId={appointmentId} />,
  )
  expect(
    await screen.findByText(
      'Người dùng chưa chia sẻ bản tổng kết nào từ các phiên trước.',
    ),
  ).toBeInTheDocument()
  unmount()

  api.reusable.mockRejectedValueOnce(
    new ApiError({
      status: 403,
      code: 'SESSION_SUMMARY_REUSE_NOT_ELIGIBLE',
      message: 'No.',
    }),
  )
  render(<PriorSessionSummaries appointmentId={appointmentId} />)
  expect(
    await screen.findByText(/mở khi lịch hẹn đã được xác nhận/),
  ).toBeInTheDocument()
})

it('offers a retry after a failed load', async () => {
  api.reusable
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      items: [],
      count: 0,
      generatedAt: '2026-11-18T13:00:00Z',
    })
  render(<PriorSessionSummaries appointmentId={appointmentId} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chưa tải được các bản tổng kết trước.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(
    await screen.findByText(
      'Người dùng chưa chia sẻ bản tổng kết nào từ các phiên trước.',
    ),
  ).toBeInTheDocument()
  expect(api.reusable).toHaveBeenCalledTimes(2)
})
