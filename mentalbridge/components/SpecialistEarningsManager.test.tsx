import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistEarningsManager from './SpecialistEarningsManager'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  saveDestination: vi.fn(),
  createPayout: vi.fn(),
}))
vi.mock('@/features/specialist-earnings/api/browser-client', () => ({
  specialistEarningsBrowserClient: api,
}))

const response = {
  currency: 'VND' as const,
  earningPolicyVersion: 'specialist-earning-v1' as const,
  settlementHoldDays: 7 as const,
  minimumWithdrawalVnd: 100000 as const,
  generatedAt: '2026-10-06T10:00:00Z',
  balance: {
    pendingSettlementVnd: 210000,
    availableVnd: 210000,
    processingVnd: 0,
    paidVnd: 0,
  },
  destination: {
    id: '1e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
    provider: 'FAKE' as const,
    destinationType: 'MOMO_WALLET' as const,
    displayHint: '•••• 6789',
    status: 'VERIFIED' as const,
    verifiedAt: '2026-10-06T09:00:00Z',
  },
  earnings: [
    {
      id: '2e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      appointmentId: '3e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      consumedCreditId: '4e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      planVersion: 'sandbox-catalog-v1',
      creditAllocationVnd: 300000 as const,
      sharePercent: 70 as const,
      earningAmountVnd: 210000 as const,
      status: 'AVAILABLE' as const,
      earnedAt: '2026-10-05T10:00:00Z',
      settlementAvailableAt: '2026-10-06T10:00:00Z',
    },
  ],
  payouts: [],
}

describe('SpecialistEarningsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(response)
  })

  it('renders only API-backed amounts and does not offer an arbitrary payout amount', async () => {
    render(<SpecialistEarningsManager />)
    expect(await screen.findAllByText(/210\.000/)).not.toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Rút toàn bộ số dư' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Rút toàn bộ số dư khả dụng',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText(/hệ thống tự tính số tiền/i)).toBeInTheDocument()
  })

  it('shows a recoverable error state when the API is unavailable', async () => {
    api.get.mockRejectedValue(new Error('offline'))
    render(<SpecialistEarningsManager />)
    expect(
      await screen.findByRole('heading', { name: 'Chưa thể tải thu nhập' }),
    ).toBeInTheDocument()
    api.get.mockResolvedValue(response)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Thu nhập & thanh toán' }),
      ).toBeInTheDocument(),
    )
  })
})
