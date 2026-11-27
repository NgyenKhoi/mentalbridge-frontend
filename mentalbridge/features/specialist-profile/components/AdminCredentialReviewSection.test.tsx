import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminCredentialReviewSection from './AdminCredentialReviewSection'

const api = vi.hoisted(() => ({
  pendingCredentialDocuments: vi.fn(),
  adminCredentialFile: vi.fn(),
  reviewCredential: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({ browserConsultation: api }))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ confirm: async () => true, showActionToast: vi.fn() }),
}))

const document = {
  id: '10000000-0000-4000-8000-000000000001',
  specialistAccountId: '20000000-0000-4000-8000-000000000001',
  title: 'Bằng chuyên môn A',
  issuer: 'Đơn vị cấp',
  issueYear: 2020,
  credentialType: 'DEGREE',
  fileName: 'degree.pdf',
  mediaType: 'application/pdf',
  fileBytes: 100,
  verificationStatus: 'PENDING',
  badgeVisible: false,
  reviewedAt: null,
  createdAt: '2026-10-17T00:00:00Z',
  version: 2,
}

describe('AdminCredentialReviewSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.pendingCredentialDocuments.mockResolvedValue({
      data: [
        document,
        {
          ...document,
          id: '10000000-0000-4000-8000-000000000002',
          title: 'Bằng chuyên môn B',
        },
      ],
    })
    api.reviewCredential.mockResolvedValue({
      data: { ...document, verificationStatus: 'VERIFIED' },
    })
  })

  it('does not enable verification of B using a delayed original from A', async () => {
    const user = userEvent.setup()
    let resolveA!: (value: { data: { url: string } }) => void
    let resolveB!: (value: { data: { url: string } }) => void
    api.adminCredentialFile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          }),
      )
    render(<AdminCredentialReviewSection />)
    await screen.findByText(document.title)
    await user.click(screen.getAllByRole('button', { name: 'Xem tệp' })[0])
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }),
    )
    await user.click(screen.getAllByRole('button', { name: 'Xem tệp' })[1])
    await act(async () => {
      resolveA({ data: { url: 'https://files.example.test/a.pdf' } })
    })
    expect(
      screen.queryByTitle('Tệp gốc Bằng chuyên môn B'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác minh' })).toBeDisabled()
    await act(async () => {
      resolveB({ data: { url: 'https://files.example.test/b.pdf' } })
    })
    expect(screen.getByTitle('Tệp gốc Bằng chuyên môn B')).toHaveAttribute(
      'src',
      'https://files.example.test/b.pdf',
    )
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))
    await waitFor(() =>
      expect(api.reviewCredential).toHaveBeenCalledWith(
        '10000000-0000-4000-8000-000000000002',
        'verify',
        2,
      ),
    )
  })
})
