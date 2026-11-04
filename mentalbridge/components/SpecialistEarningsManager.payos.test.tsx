import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistEarningsManager from './SpecialistEarningsManager'
import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  saveDestination: vi.fn(),
  createPayout: vi.fn(),
  banks: vi.fn(),
}))
vi.mock('@/features/specialist-earnings/api/browser-client', () => ({
  specialistEarningsBrowserClient: api,
}))

const at = '2026-11-04T03:00:00Z'
const banks = [
  {
    bin: '970436',
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    shortName: 'Vietcombank',
  },
  { bin: '970406', name: 'Ngân hàng TMCP Đông Á', shortName: 'DongA Bank' },
]
const pendingDestination = {
  id: '1e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  provider: 'PAYOS' as const,
  destinationType: 'BANK_ACCOUNT' as const,
  displayHint: '970436 ****7890',
  status: 'PENDING_CONFIRMATION' as const,
  verifiedAt: null,
  bankCode: '970436',
  bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam',
  version: 0,
  updatedAt: at,
  usableForPayout: false,
}
const confirmed = {
  ...pendingDestination,
  status: 'VERIFIED' as const,
  verifiedAt: '2026-11-04T04:00:00Z',
  version: 1,
  usableForPayout: true,
}
const base = {
  currency: 'VND' as const,
  earningPolicyVersion: 'specialist-earning-v1' as const,
  payoutProvider: 'PAYOS' as const,
  payoutAvailability: { mode: 'PAYOS' as const, ready: true, reasonCode: null },
  settlementHoldDays: 7 as const,
  minimumWithdrawalVnd: 100000 as const,
  generatedAt: at,
  balance: {
    pendingSettlementVnd: 0,
    availableVnd: 210000,
    retryPendingVnd: 0,
    processingVnd: 0,
    paidVnd: 0,
  },
  destination: pendingDestination as typeof pendingDestination | null,
  earnings: [],
  payouts: [] as unknown[],
}
const payout = {
  id: '5e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  destinationId: pendingDestination.id,
  provider: 'PAYOS' as const,
  amountVnd: 210000,
  status: 'PROCESSING' as const,
  providerReference: 'ref',
  failureCode: null as string | null,
  requestedAt: at,
  completedAt: null as string | null,
  reconciliationStatus: 'POLLING' as const,
  nextReconciliationAt: null,
  reviewRequiredAt: null as string | null,
}

describe('SpecialistEarningsManager under PayOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ ...base, destination: null })
    api.banks.mockResolvedValue({ generatedAt: at, items: banks })
    api.saveDestination.mockResolvedValue(pendingDestination)
    api.createPayout.mockResolvedValue(base)
  })

  async function openBankDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole('button', { name: 'Thiết lập nơi nhận' }),
    )
    const bank = await screen.findByRole('combobox', { name: 'Ngân hàng' })
    await waitFor(() =>
      expect(bank).not.toHaveAttribute('aria-disabled', 'true'),
    )
    return bank
  }

  it('offers a bank-only form with a searchable bank list and sends the BIN', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    const bank = await openBankDialog(user)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await user.type(bank, 'dong a')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('DongA Bank')
    expect(bank).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Enter}')
    expect(bank).toHaveValue('DongA Bank')
    await user.type(screen.getByLabelText('Tên chủ tài khoản'), 'nguyen van a')
    expect(screen.getByLabelText('Tên chủ tài khoản')).toHaveValue(
      'NGUYEN VAN A',
    )
    await user.type(screen.getByLabelText('Số tài khoản'), '1234 5678 90')
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('1234567890')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    await waitFor(() =>
      expect(api.saveDestination).toHaveBeenCalledWith({
        destinationType: 'BANK_ACCOUNT',
        bankCode: '970406',
        accountReference: '1234567890',
        accountHolderName: 'NGUYEN VAN A',
      }),
    )
    expect(await screen.findByText('Chờ xác nhận')).toBeInTheDocument()
    expect(
      screen.getByText(/Chúng tôi kiểm tra tên chủ tài khoản một lần/),
    ).toBeInTheDocument()
  })

  it('does not accept free text as a bank', async () => {
    const user = userEvent.setup()
    render(<SpecialistEarningsManager />)
    const bank = await openBankDialog(user)
    await user.type(bank, 'VCB')
    await user.type(screen.getByLabelText('Tên chủ tài khoản'), 'An')
    await user.type(screen.getByLabelText('Số tài khoản'), '123456')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chọn ngân hàng từ danh sách.',
    )
    expect(bank).toHaveFocus()
    expect(api.saveDestination).not.toHaveBeenCalled()
  })

  it('shows the bank list failure inline and recovers with Thử lại', async () => {
    const user = userEvent.setup()
    api.banks.mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'PAYOUT_BANK_LIST_UNAVAILABLE',
        message: 'x',
      }),
    )
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Thiết lập nơi nhận' }),
    )
    expect(
      await screen.findByText(/Chưa tải được danh sách ngân hàng/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(api.banks).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(
        screen.queryByText(/Chưa tải được danh sách ngân hàng/),
      ).not.toBeInTheDocument(),
    )
  })

  it('treats a pending account as waiting, not as verified', async () => {
    api.get.mockResolvedValue(base)
    render(<SpecialistEarningsManager />)
    expect(
      await screen.findByText('Tài khoản đang chờ xác nhận'),
    ).toBeInTheDocument()
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument()
    expect(
      screen.getByText('Bạn có thể rút ngay khi tài khoản được xác nhận.'),
    ).toBeInTheDocument()
    expect(screen.getByText('••••7890')).toBeInTheDocument()
    expect(screen.queryByText(/970436/)).not.toBeInTheDocument()
    expect(screen.queryByText('Đã xác minh')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
  })

  it('enables withdrawal once the exact account is confirmed', async () => {
    api.get.mockResolvedValue({ ...base, destination: confirmed })
    render(<SpecialistEarningsManager />)
    expect(await screen.findByText('Đã xác nhận')).toBeInTheDocument()
    expect(screen.getByText(/Xác nhận lúc/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeEnabled()
  })

  it('keeps legacy MoMo history readable and asks for a bank account', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({
      ...base,
      destination: {
        ...pendingDestination,
        provider: 'MOMO',
        destinationType: 'MOMO_WALLET',
        status: 'DISABLED',
        verifiedAt: '2026-10-01T00:00:00Z',
        bankCode: null,
        bankName: null,
        usableForPayout: false,
      },
    })
    render(<SpecialistEarningsManager />)
    expect(await screen.findByText('Không dùng để rút')).toBeInTheDocument()
    expect(screen.getByText('Cần thêm tài khoản ngân hàng')).toBeInTheDocument()
    expect(
      screen.getByText(/Ví MoMo không còn nhận tiền rút/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Thêm tài khoản ngân hàng' }),
    )
    expect(
      await screen.findByRole('combobox', { name: 'Ngân hàng' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('blocks withdrawal with a neutral reason when the provider is not ready', async () => {
    api.get.mockResolvedValue({
      ...base,
      destination: confirmed,
      payoutAvailability: {
        mode: 'PAYOS',
        ready: false,
        reasonCode: 'PAYOUT_CONFIGURATION_UNAVAILABLE',
      },
    })
    render(<SpecialistEarningsManager />)
    expect(
      await screen.findByText(
        'Rút tiền tạm thời chưa mở. Vui lòng quay lại sau.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/PAYOUT_CONFIGURATION/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rút toàn bộ số dư' }),
    ).toBeDisabled()
  })

  it('shows the simulated notice only for the configured FAKE mode', async () => {
    api.get.mockResolvedValue({
      ...base,
      destination: confirmed,
      payouts: [
        {
          ...payout,
          provider: 'FAKE',
          status: 'SUCCEEDED',
          completedAt: at,
        },
      ],
    })
    const { unmount } = render(<SpecialistEarningsManager />)
    expect(await screen.findByText('Mô phỏng')).toBeInTheDocument()
    expect(screen.queryByText('Chế độ thử nghiệm')).not.toBeInTheDocument()
    unmount()
    api.get.mockResolvedValue({
      ...base,
      payoutProvider: 'FAKE',
      payoutAvailability: { mode: 'FAKE', ready: true, reasonCode: null },
    })
    render(<SpecialistEarningsManager />)
    expect(await screen.findByText('Chế độ thử nghiệm')).toBeInTheDocument()
  })

  it('explains waiting for the operator without asking the specialist to act', async () => {
    api.get.mockResolvedValue({
      ...base,
      destination: confirmed,
      balance: { ...base.balance, availableVnd: 0, retryPendingVnd: 210000 },
      payouts: [
        {
          ...payout,
          status: 'FAILED',
          failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
          reconciliationStatus: 'COMPLETE',
        },
      ],
    })
    render(<SpecialistEarningsManager />)
    expect(await screen.findByText(/bạn không cần làm gì/)).toBeInTheDocument()
    // One balance row and one history pill.
    expect(screen.getAllByText('Chờ chuyển lại')).toHaveLength(2)
    expect(screen.queryByText(/thử lại/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/PAYOUT_/)).not.toBeInTheDocument()
  })

  it('shows a closed failed payout as closed with the release copy, not as an error', async () => {
    api.get.mockResolvedValue({
      ...base,
      destination: confirmed,
      payouts: [
        {
          ...payout,
          status: 'FAILED',
          failureCode: 'PAYOUT_PROVIDER_REJECTED',
          reconciliationStatus: 'COMPLETE',
          closedAt: at,
        },
      ],
    })
    render(<SpecialistEarningsManager />)
    expect(
      (await screen.findByText('Đã đóng')).closest('[data-state]'),
    ).toHaveAttribute('data-state', 'CLOSED')
    expect(
      screen.getByText(
        'Số tiền đã trở lại số dư. Bạn có thể rút về tài khoản mới khi tài khoản được xác nhận.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Chưa thành công')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ngân hàng chưa nhận/)).not.toBeInTheDocument()
  })

  it('uses safe copy for rejection and review states and names the provider', async () => {
    api.get.mockResolvedValue({
      ...base,
      destination: confirmed,
      payouts: [
        {
          ...payout,
          id: 'a',
          status: 'FAILED',
          failureCode: 'PAYOUT_PROVIDER_REJECTED',
          reconciliationStatus: 'COMPLETE',
        },
        {
          ...payout,
          id: 'b',
          status: 'UNKNOWN',
          failureCode: 'PAYOUT_RECONCILIATION_OVERDUE',
          reconciliationStatus: 'NEEDS_REVIEW',
          reviewRequiredAt: at,
        },
      ],
    })
    render(<SpecialistEarningsManager />)
    expect(await screen.findByText('Chưa thành công')).toBeInTheDocument()
    expect(
      screen.getByText(/Ngân hàng chưa nhận giao dịch/),
    ).toBeInTheDocument()
    expect(screen.getByText('Đang kiểm tra')).toBeInTheDocument()
    expect(screen.getAllByText('Qua PayOS')).toHaveLength(2)
    expect(screen.queryByText(/PAYOUT_/)).not.toBeInTheDocument()
  })

  it('walks an active payout through steps and collapses them after success', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce({
      ...base,
      destination: confirmed,
      balance: { ...base.balance, processingVnd: 210000 },
      payouts: [payout],
    })
    render(<SpecialistEarningsManager />)
    const steps = await screen.findByRole('list', {
      name: 'Tiến trình chuyển tiền',
    })
    expect(
      within(steps).getByText('Ngân hàng đang xác nhận').closest('li'),
    ).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Đang chuyển')).toBeInTheDocument()
    api.get.mockResolvedValueOnce({
      ...base,
      destination: confirmed,
      payouts: [
        {
          ...payout,
          status: 'SUCCEEDED',
          completedAt: at,
          reconciliationStatus: 'COMPLETE',
        },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(
      () =>
        expect(
          screen.queryByRole('list', { name: 'Tiến trình chuyển tiền' }),
        ).not.toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.getAllByText('Đã thanh toán').length).toBeGreaterThan(0)
  })

  it('treats a 503 not-open answer as a definite refusal, not an unknown result', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({ ...base, destination: confirmed })
    api.createPayout.mockRejectedValueOnce(
      new ApiError({ status: 503, code: 'REAL_PAYOUT_DISABLED', message: 'x' }),
    )
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút toàn bộ số dư' }),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận rút tiền' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Rút tiền tạm thời chưa mở',
    )
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
    ).not.toBeInTheDocument()
  })

  it('does not let a refresh started before a destination save overwrite the saved revision', async () => {
    const user = userEvent.setup()
    // Unanimated text shown only while the revision awaits confirmation.
    const pendingNote = /Chúng tôi kiểm tra tên chủ tài khoản một lần/
    const active = {
      ...base,
      destination: confirmed,
      balance: { ...base.balance, processingVnd: 210000 },
      payouts: [payout],
    }
    let resolveStale: (value: unknown) => void = () => {}
    api.get.mockResolvedValueOnce(active).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStale = resolve
      }),
    )
    api.saveDestination.mockResolvedValue(pendingDestination)
    // Only the 30 s poll is faked; animation and typing timers stay real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      render(<SpecialistEarningsManager />)
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
      await screen.findByText('Đã xác nhận')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      expect(api.get).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
    await user.click(
      screen.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
    )
    const bank = await screen.findByRole('combobox', { name: 'Ngân hàng' })
    await user.type(bank, 'dong a')
    await user.keyboard('{Enter}')
    await user.type(screen.getByLabelText('Tên chủ tài khoản'), 'nguyen van a')
    await user.type(screen.getByLabelText('Số tài khoản'), '1234567890')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin nhận' }))
    expect(await screen.findByText(pendingNote)).toBeInTheDocument()
    await act(async () => {
      resolveStale(active)
      // Let the stale response settle before asserting the state did not change.
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(screen.getByText(pendingNote)).toBeInTheDocument()
  })

  it('refreshes silently every 30 s while a payout is in flight and stops once it is paid', async () => {
    vi.useFakeTimers()
    try {
      const active = {
        ...base,
        destination: confirmed,
        balance: { ...base.balance, processingVnd: 420000 },
        payouts: [payout],
      }
      const paid = {
        ...base,
        destination: confirmed,
        payouts: [
          {
            ...payout,
            status: 'SUCCEEDED',
            completedAt: at,
            reconciliationStatus: 'COMPLETE',
          },
        ],
      }
      api.get
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce(paid)
        .mockResolvedValue(paid)
      render(<SpecialistEarningsManager />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.get).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_000)
      })
      expect(api.get).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(api.get).toHaveBeenCalledTimes(2)
      // Silent: the refresh button never shows its busy label.
      expect(screen.getByRole('button', { name: 'Làm mới' })).toBeEnabled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000)
      })
      expect(api.get).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts a new create intent after a definitive FAILED payout instead of replaying the old key', async () => {
    const user = userEvent.setup()
    const failed = {
      ...payout,
      status: 'FAILED' as const,
      failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
      completedAt: at,
      reconciliationStatus: 'COMPLETE' as const,
    }
    const second = { ...payout, id: '6e3a8903-3d31-48d0-bf1a-4d81bbcef4b8' }
    api.get
      .mockResolvedValueOnce({ ...base, destination: confirmed })
      .mockResolvedValue({
        ...base,
        destination: confirmed,
        balance: { ...base.balance, availableVnd: 150000 },
        payouts: [failed],
      })
    api.createPayout
      .mockResolvedValueOnce({
        ...base,
        destination: confirmed,
        balance: { ...base.balance, availableVnd: 0 },
        payouts: [failed],
      })
      .mockResolvedValueOnce({
        ...base,
        destination: confirmed,
        payouts: [failed, second],
      })
    render(<SpecialistEarningsManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút toàn bộ số dư' }),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận rút tiền' }))
    await waitFor(() => expect(api.createPayout).toHaveBeenCalledTimes(1))
    // New funds become withdrawable on the mounted screen.
    await user.click(await screen.findByRole('button', { name: 'Làm mới' }))
    await user.click(
      await screen.findByRole('button', { name: 'Rút toàn bộ số dư' }),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận rút tiền' }))
    await waitFor(() => expect(api.createPayout).toHaveBeenCalledTimes(2))
    expect(api.createPayout.mock.calls[1][1]).not.toBe(
      api.createPayout.mock.calls[0][1],
    )
  })
})
