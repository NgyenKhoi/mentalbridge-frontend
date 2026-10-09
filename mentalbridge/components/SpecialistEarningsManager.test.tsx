import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistEarningsManager from './SpecialistEarningsManager'
import { ApiError } from '@/lib/api/api-error'

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
    api.saveDestination.mockResolvedValue(response.destination)
    api.createPayout.mockResolvedValue(response)
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

  it('cancels and resets the destination form without sending sensitive values', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
    )
    await user.type(
      screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví'),
      'Nguyễn Thị An',
    )
    await user.click(screen.getByRole('radio', { name: 'Tài khoản ngân hàng' }))
    await user.type(screen.getByLabelText('Mã ngân hàng'), 'vcb')
    await user.type(screen.getByLabelText('Số tài khoản'), '123456')
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    await user.click(
      screen.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
    )
    expect(screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví')).toHaveValue(
      '',
    )
    expect(screen.getByLabelText('Số điện thoại MoMo')).toHaveValue('')
    expect(screen.queryByLabelText('Mã ngân hàng')).not.toBeInTheDocument()
    expect(api.saveDestination).not.toHaveBeenCalled()
  })

  it('validates and focuses the invalid input; keeps Vietnamese holder names', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    expect(screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví')).toHaveFocus()
    await user.type(
      screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví'),
      'Nguyễn Thị An',
    )
    await user.type(screen.getByLabelText('Số điện thoại MoMo'), '12345')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    expect(screen.getByLabelText('Số điện thoại MoMo')).toHaveFocus()
    expect(api.saveDestination).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Số điện thoại MoMo'), '6')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    await waitFor(() =>
      expect(api.saveDestination).toHaveBeenCalledWith({
        destinationType: 'MOMO_WALLET',
        accountReference: '123456',
        accountHolderName: 'Nguyễn Thị An',
      }),
    )
  })

  it('locks the entire form and cancel while a save is pending', async () => {
    const user = userEvent.setup()
    let finish!: (value: typeof response.destination) => void
    api.saveDestination.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
    )
    await user.type(
      screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví'),
      'Nguyễn An',
    )
    await user.type(screen.getByLabelText('Số điện thoại MoMo'), '123456')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    expect(
      screen.getByLabelText('Tên chủ tài khoản hoặc chủ ví'),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(api.saveDestination).toHaveBeenCalledTimes(1)
    finish(response.destination)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
      ).toBeEnabled(),
    )
  })

  it('retries an ambiguous payout with the same key and does not claim rollback', async () => {
    const user = userEvent.setup()
    api.createPayout
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(response)
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút toàn bộ số dư' }),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận rút tiền' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa nhận được kết quả',
    )
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
    )
    await waitFor(() => expect(api.createPayout).toHaveBeenCalledTimes(2))
    expect(api.createPayout.mock.calls[1]).toEqual(
      api.createPayout.mock.calls[0],
    )
    expect(api.createPayout.mock.calls[0][0]).toBe(response.destination.id)
  })

  it('never renders an unknown payout as a successful or failed payment', async () => {
    api.get.mockResolvedValue({
      ...response,
      balance: { ...response.balance, processingVnd: 210000 },
      payouts: [
        {
          id: 'payout-1',
          destinationId: response.destination.id,
          provider: 'FAKE',
          amountVnd: 210000,
          status: 'UNKNOWN',
          requestedAt: response.generatedAt,
          completedAt: null,
        },
      ],
    })
    render(<SpecialistEarningsManager />)
    await screen.findByText('Chưa rõ kết quả')
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Chưa thể xác nhận thanh toán thành công/),
    ).toBeInTheDocument()
  })

  it('disables withdrawals for a disabled destination, even with enough balance', async () => {
    api.get.mockResolvedValue({
      ...response,
      destination: { ...response.destination, status: 'DISABLED' },
    })
    render(<SpecialistEarningsManager />)
    expect(
      await screen.findByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
    expect(screen.getByText('Đã vô hiệu hóa')).toBeInTheDocument()
    expect(screen.queryByText('Đã xác minh')).not.toBeInTheDocument()
  })

  it('retains displayed balances on refresh failure and blocks stale mutations', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    await screen.findByRole('button', { name: 'Rút toàn bộ số dư' })
    api.get.mockRejectedValueOnce(new Error('offline'))
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'lần tải thành công gần nhất',
    )
    expect(screen.getAllByText(/210\.000/).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
  })

  it('clears protected earnings and destination after access revocation', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    await screen.findByRole('button', { name: 'Rút toàn bộ số dư' })
    api.get.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'denied' }),
    )
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    await screen.findByText(
      'Tài khoản hiện tại chưa có quyền quản lý thu nhập.',
    )
    expect(screen.queryByText('•••• 6789')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).not.toBeInTheDocument()
  })
})
