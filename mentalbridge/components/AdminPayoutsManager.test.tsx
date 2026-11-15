import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminPayoutsManager from './AdminPayoutsManager'
import { FeedbackProvider } from './ui/FeedbackProvider'
import { ApiError } from '../lib/api/api-error'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  detail: vi.fn(),
  retry: vi.fn(),
  closeFailed: vi.fn(),
  pendingDestinations: vi.fn(),
  destinationDetail: vi.fn(),
  confirmDestination: vi.fn(),
}))
vi.mock('@/features/specialist-earnings/api/browser-client', () => ({
  adminPayoutsBrowserClient: api,
}))

const at = '2026-11-04T03:00:00Z'
const destinationId = '78700000-0000-4000-8000-000000000001'
const specialistId = '78700000-0000-4000-8000-000000000002'
const payoutId = '78700000-0000-4000-8000-000000000003'
const attemptId = '78700000-0000-4000-8000-000000000004'
const destination = {
  id: destinationId,
  provider: 'PAYOS' as const,
  destinationType: 'BANK_ACCOUNT' as const,
  displayHint: '970436 ****7890',
  status: 'PENDING_CONFIRMATION' as const,
  verifiedAt: null,
  bankCode: '970436',
  bankName: 'Vietcombank',
  version: 0,
  updatedAt: at,
  usableForPayout: false,
}
const queue = (count = 1) => ({
  generatedAt: at,
  count,
  items: count ? [{ destination, specialistAccountId: specialistId }] : [],
})
const detail = {
  destination,
  specialistAccountId: specialistId,
  accountReference: '1234567890',
  accountHolderName: 'NGUYEN VAN A',
  confirmedBy: null,
}
const row = {
  payoutId,
  specialistAccountId: specialistId,
  destinationHint: '970436 ****7890',
  amountVnd: 210000,
  currency: 'VND' as const,
  provider: 'PAYOS' as const,
  status: 'FAILED' as const,
  earningCount: 1,
  providerReference: null,
  failureCode: 'PAYOUT_INSUFFICIENT_BALANCE' as string | null,
  requestedAt: at,
  completedAt: at,
  reconciliationStatus: 'COMPLETE' as const,
  nextReconciliationAt: null,
  reviewRequiredAt: null as string | null,
  closedAt: null as string | null,
}
const ledger = (items: unknown[]) => ({
  generatedAt: at,
  count: items.length,
  items,
})

const failedDetail = () => ({
  payout: row,
  attempts: [
    {
      attemptId,
      attemptNumber: 1,
      provider: 'PAYOS',
      status: 'FAILED',
      requestedAt: at,
    },
  ],
  earnings: [],
  events: [],
})

function renderManager() {
  return render(
    <FeedbackProvider>
      <AdminPayoutsManager />
    </FeedbackProvider>,
  )
}

describe('AdminPayoutsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.pendingDestinations.mockResolvedValue(queue())
    api.get.mockResolvedValue(ledger([row]))
    api.destinationDetail.mockResolvedValue(detail)
    api.confirmDestination.mockResolvedValue({
      ...destination,
      status: 'VERIFIED',
    })
  })

  it('opens on the confirmation queue when it has accounts and supports arrow-key tabs', async () => {
    const user = userEvent.setup()
    renderManager()
    const queueTab = await screen.findByRole('tab', {
      name: /Tài khoản chờ xác nhận/,
    })
    await waitFor(() =>
      expect(queueTab).toHaveAttribute('aria-selected', 'true'),
    )
    expect(within(queueTab).getByLabelText('1 tài khoản')).toBeInTheDocument()
    expect(await screen.findByText('Vietcombank')).toBeInTheDocument()
    // Full account details never appear in the list.
    expect(screen.queryByText(/1234/)).not.toBeInTheDocument()
    queueTab.focus()
    await user.keyboard('{ArrowRight}')
    const ledgerTab = screen.getByRole('tab', { name: 'Yêu cầu chi trả' })
    expect(ledgerTab).toHaveAttribute('aria-selected', 'true')
    expect(ledgerTab).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(queueTab).toHaveFocus()
  })

  it('falls back to the ledger when the queue is empty and says so honestly', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockResolvedValue(queue(0))
    renderManager()
    expect(await screen.findByText('Sổ đối soát')).toBeInTheDocument()
    expect(
      screen.queryByText(/Việc chi tiền thật vẫn bị tắt/),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('tab', { name: /Tài khoản chờ xác nhận/ }),
    )
    expect(
      await screen.findByText('Không có tài khoản nào chờ xác nhận.'),
    ).toBeInTheDocument()
  })

  it('recovers from a queue load failure without touching the ledger', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockRejectedValueOnce(new Error('offline'))
    renderManager()
    await user.click(
      await screen.findByRole('tab', { name: /Tài khoản chờ xác nhận/ }),
    )
    expect(
      await screen.findByText('Chưa thể tải hàng chờ xác nhận'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Vietcombank')).toBeInTheDocument()
  })

  it('gates confirmation on the checkbox, sends the exact version and removes the row', async () => {
    const user = userEvent.setup()
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('1234 5678 90')).toBeInTheDocument()
    expect(within(dialog).getByText('NGUYEN VAN A')).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', {
      name: 'Xác nhận tài khoản',
    })
    expect(confirm).toBeDisabled()
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'Tôi đã kiểm tra tên chủ tài khoản khớp với số tài khoản.',
      }),
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await waitFor(() =>
      expect(api.confirmDestination).toHaveBeenCalledWith(
        destinationId,
        0,
        expect.any(String),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByText('Vietcombank')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Đã xác nhận tài khoản')).toBeInTheDocument()
  })

  it('reuses one key when the same dialog re-submits after a lost response', async () => {
    const user = userEvent.setup()
    api.confirmDestination
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({ ...destination, status: 'VERIFIED' })
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('1234 5678 90')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận tài khoản' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Chưa thể xác nhận tài khoản',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận tài khoản' }),
    )
    await waitFor(() => expect(api.confirmDestination).toHaveBeenCalledTimes(2))
    expect(api.confirmDestination.mock.calls[1]).toEqual(
      api.confirmDestination.mock.calls[0],
    )
  })

  it('shows a version conflict inline, drops the replaced revision and confirms the new one from the refreshed queue', async () => {
    const user = userEvent.setup()
    api.confirmDestination.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'PAYOUT_DESTINATION_VERSION_CONFLICT',
        message: 'x',
      }),
    )
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('1234 5678 90')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận tài khoản' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Chuyên gia vừa đổi tài khoản. Tải lại để kiểm tra thông tin mới.',
    )
    // A real edit disables the old revision and creates a new one with a new id.
    const newId = '78700000-0000-4000-8000-000000000099'
    const replacement = { ...destination, id: newId, bankName: 'DongA Bank' }
    api.pendingDestinations.mockResolvedValue({
      ...queue(),
      items: [{ destination: replacement, specialistAccountId: specialistId }],
    })
    api.destinationDetail.mockClear()
    api.destinationDetail.mockResolvedValue({
      ...detail,
      destination: replacement,
      accountHolderName: 'TRAN THI B',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Tải lại danh sách' }),
    )
    expect(await screen.findByText('DongA Bank')).toBeInTheDocument()
    expect(api.destinationDetail).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.queryByText('Vietcombank')).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    const next = await screen.findByRole('dialog')
    expect(await within(next).findByText('TRAN THI B')).toBeInTheDocument()
    expect(within(next).getByRole('checkbox')).not.toBeChecked()
    await user.click(within(next).getByRole('checkbox'))
    await user.click(
      within(next).getByRole('button', { name: 'Xác nhận tài khoản' }),
    )
    await waitFor(() => expect(api.confirmDestination).toHaveBeenCalledTimes(2))
    expect(api.confirmDestination.mock.calls[1][0]).toBe(newId)
    expect(api.confirmDestination.mock.calls[1][2]).not.toBe(
      api.confirmDestination.mock.calls[0][2],
    )
  })

  it('offers a detail retry inside the dialog when the account cannot be loaded', async () => {
    const user = userEvent.setup()
    api.destinationDetail.mockRejectedValueOnce(new Error('offline'))
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Chưa tải được thông tin tài khoản.',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Xác nhận tài khoản' }),
    ).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Thử lại' }))
    expect(await within(dialog).findByText('1234 5678 90')).toBeInTheDocument()
  })

  it('shows provider, review state and a reason line, and retry only for definite failure', async () => {
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.get.mockResolvedValue(
      ledger([
        row,
        {
          ...row,
          payoutId: '78700000-0000-4000-8000-000000000010',
          status: 'UNKNOWN',
          failureCode: 'PAYOUT_RECONCILIATION_OVERDUE',
          reconciliationStatus: 'NEEDS_REVIEW',
          reviewRequiredAt: at,
        },
        {
          ...row,
          payoutId: '78700000-0000-4000-8000-000000000011',
          status: 'PROCESSING',
          failureCode: null,
          reconciliationStatus: 'POLLING',
        },
      ]),
    )
    renderManager()
    expect(
      await screen.findByText('Cần kiểm tra', { selector: '.apo-status span' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('PayOS').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Số dư chi hộ PayOS không đủ. Nạp thêm rồi chuyển lại.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Quá 24 giờ chưa có kết quả. Kiểm tra trên PayOS trước khi xử lý.',
      ),
    ).toBeInTheDocument()
    // FAILED+COMPLETE only: the review row and the processing row have no retry.
    expect(screen.getAllByRole('button', { name: 'Chuyển lại' })).toHaveLength(
      1,
    )
    expect(
      screen.getAllByRole('button', { name: 'Đóng yêu cầu' }),
    ).toHaveLength(1)
  })

  it('shows a closed row as closed with no actions and no stale failure line', async () => {
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.get.mockResolvedValue(ledger([{ ...row, closedAt: at }]))
    renderManager()
    expect(
      await screen.findByText('Đã đóng', { selector: '.apo-status span' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Đóng lúc/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Chuyển lại' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Đóng yêu cầu' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Nạp thêm/)).not.toBeInTheDocument()
  })

  it('retries the latest failed attempt after a confirmation and updates the row', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.detail.mockResolvedValue({
      payout: row,
      attempts: [
        {
          attemptId: 'old',
          attemptNumber: 1,
          provider: 'PAYOS',
          status: 'FAILED',
          requestedAt: at,
        },
        {
          attemptId,
          attemptNumber: 2,
          provider: 'PAYOS',
          status: 'FAILED',
          requestedAt: at,
        },
      ],
      earnings: [],
      events: [],
    })
    api.retry.mockResolvedValue({
      payout: {
        ...row,
        status: 'PROCESSING',
        failureCode: null,
        reconciliationStatus: 'POLLING',
      },
      attempts: [],
      earnings: [],
      events: [],
    })
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Chuyển lại' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Chuyển lại')
    expect(dialog).toHaveTextContent('Số dư chi hộ PayOS không đủ')
    await user.click(within(dialog).getByRole('button', { name: 'Chuyển lại' }))
    await waitFor(() =>
      expect(api.retry).toHaveBeenCalledWith(
        payoutId,
        attemptId,
        expect.any(String),
      ),
    )
    expect(
      await screen.findByText('Đang xử lý', { selector: '.apo-status span' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Chuyển lại' }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.querySelector('.apo-table article'),
      ),
    )
  })

  it('maps a retry conflict to a calm toast and reloads the ledger', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.detail.mockResolvedValue({
      payout: row,
      attempts: [
        {
          attemptId,
          attemptNumber: 1,
          provider: 'PAYOS',
          status: 'FAILED',
          requestedAt: at,
        },
      ],
      earnings: [],
      events: [],
    })
    api.retry.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'PAYOUT_RETRY_NOT_AVAILABLE',
        message: 'x',
      }),
    )
    renderManager()
    await user.click(await screen.findByRole('button', { name: 'Chuyển lại' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Chuyển lại' }))
    expect(
      await screen.findByText('Không thể chuyển lại yêu cầu này'),
    ).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })

  it('closes the latest failed attempt after a confirmation and marks the row closed', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.detail.mockResolvedValue(failedDetail())
    api.closeFailed.mockResolvedValue({
      payout: { ...row, closedAt: at },
      attempts: [],
      earnings: [],
      events: [],
    })
    renderManager()
    await user.click(
      await screen.findByRole('button', { name: 'Đóng yêu cầu' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Đóng yêu cầu')
    expect(dialog).toHaveTextContent('••••7890')
    expect(dialog).toHaveTextContent('Hệ thống không chuyển tiền')
    expect(api.closeFailed).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', { name: 'Đóng yêu cầu' }),
    )
    await waitFor(() =>
      expect(api.closeFailed).toHaveBeenCalledWith(
        payoutId,
        attemptId,
        expect.any(String),
      ),
    )
    expect(
      await screen.findByText('Đã đóng', { selector: '.apo-status span' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Số tiền đã trở lại số dư của chuyên gia.'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Chuyển lại' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Đóng yêu cầu' }),
      ).not.toBeInTheDocument()
    })
    // Focus lands on the row, not on body, once the buttons leave.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.querySelector('.apo-table article'),
      ),
    )
  })

  it('maps a close conflict to a calm toast and reloads the ledger', async () => {
    const user = userEvent.setup()
    api.pendingDestinations.mockResolvedValue(queue(0))
    api.detail.mockResolvedValue(failedDetail())
    api.closeFailed.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'PAYOUT_CLOSE_NOT_AVAILABLE',
        message: 'x',
      }),
    )
    renderManager()
    await user.click(
      await screen.findByRole('button', { name: 'Đóng yêu cầu' }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Đóng yêu cầu' }),
    )
    expect(
      await screen.findByText('Không thể đóng yêu cầu này'),
    ).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })
})
