import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanPayment } from '@/lib/consultation/billing-validation'
import { browserSubscription } from '../api/browser-client'
import PayosPaymentPanel from './PayosPaymentPanel'

// Reduced motion: state swaps are instant, so fake timers need no animation frames.
vi.mock('framer-motion', async (original) => ({
  ...(await original<typeof import('framer-motion')>()),
  useReducedMotion: () => true,
}))
vi.mock('../api/browser-client', () => ({
  browserSubscription: { payment: vi.fn() },
}))

const NOW = Date.parse('2026-10-30T10:00:00Z')

function payment(overrides: Partial<PlanPayment> = {}): PlanPayment {
  return {
    paymentId: 'aa100000-0000-4000-8000-000000000001',
    subscriptionId: 'aa100000-0000-4000-8000-000000000002',
    planVersionId: '62200000-0000-4000-8000-000000000002',
    planCode: 'PLUS',
    planVersion: 'sandbox-vnd-2026-10',
    pricingPolicyVersion: 'sandbox-full-price-v1',
    purpose: 'PURCHASE',
    provider: 'PAYOS',
    status: 'PENDING',
    terminalReason: null,
    amountVnd: 5000,
    currency: 'VND',
    qrCode:
      '00020101021238540010A00000072701240006970422011000000007860208QRIBFTTA5303704540450005802VN6304A1B2',
    bin: '970422',
    accountNumber: '0000000786',
    accountName: 'MENTALBRIDGE TEST',
    description: 'MB000786',
    amount: 5000,
    expiredAt: new Date(NOW + 15 * 60_000).toISOString(),
    expiresAt: new Date(NOW + 15 * 60_000).toISOString(),
    createdAt: new Date(NOW).toISOString(),
    paidAt: null,
    failedAt: null,
    ...overrides,
  }
}

function renderPanel(
  initial = payment(),
  props: Partial<React.ComponentProps<typeof PayosPaymentPanel>> = {},
) {
  const handlers = {
    onPayment: vi.fn(),
    onBack: vi.fn(),
    onRenew: vi.fn(),
    onActivated: vi.fn(),
  }
  render(
    <PayosPaymentPanel
      payment={initial}
      planName="Plus"
      busy={false}
      focusOnOpen={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('PayosPaymentPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.mocked(browserSubscription.payment).mockReset()
    vi.mocked(browserSubscription.payment).mockResolvedValue(payment())
  })
  afterEach(() => vi.useRealTimers())

  it('renders the QR from the payload with transfer details, steps and countdown, without naming MoMo', () => {
    renderPanel()
    const qr = screen.getByRole('img', { name: /Mã QR chuyển khoản 5\.000đ/ })
    expect(qr.querySelector('svg path')).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: /Đăng ký Gói Plus · 5\.000đ/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('MB Bank')).toBeInTheDocument()
    expect(screen.getByText('0000000786')).toBeInTheDocument()
    expect(screen.getByText('MENTALBRIDGE TEST')).toBeInTheDocument()
    expect(screen.getByText('MB000786')).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent('Đã tạo mã thanh toán (đã xong)')
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).not.toHaveTextContent('(đã xong)')
    expect(screen.getByRole('timer')).toHaveAccessibleName(/15:00/)
    expect(screen.getByText('Đang chờ ngân hàng xác nhận…')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/MoMo/)
    expect(document.body).not.toHaveTextContent(/Thanh toán thử/)
  })

  it('notes simulated payments in FAKE mode', () => {
    renderPanel(payment({ provider: 'FAKE' }))
    expect(
      screen.getByText('Thanh toán thử (không trừ tiền thật)'),
    ).toBeInTheDocument()
  })

  it('counts down and swaps the QR for the expired state at zero', async () => {
    renderPanel(
      payment({
        expiredAt: new Date(NOW + 3_000).toISOString(),
        expiresAt: new Date(NOW + 3_000).toISOString(),
      }),
    )
    expect(screen.getByRole('timer')).toHaveAccessibleName(/00:03/)
    await tick(3_000)
    expect(
      screen.getByRole('heading', { name: 'Mã thanh toán đã hết hạn' }),
    ).toHaveFocus()
    expect(screen.getByText('Chưa có khoản nào được ghi nhận.')).toBeVisible()
    expect(screen.queryByRole('img', { name: /Mã QR/ })).toBeNull()
  })

  it('offers a fresh code from the expired state', async () => {
    const handlers = renderPanel(
      payment({
        expiredAt: new Date(NOW + 1_000).toISOString(),
        expiresAt: new Date(NOW + 1_000).toISOString(),
      }),
    )
    await tick(1_000)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã mới' }))
    expect(handlers.onRenew).toHaveBeenCalledTimes(1)
  })

  it('does not take focus when it opens on a payment that is already expired', () => {
    renderPanel(
      payment({
        expiredAt: new Date(NOW - 1_000).toISOString(),
        expiresAt: new Date(NOW - 1_000).toISOString(),
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Mã thanh toán đã hết hạn' }),
    ).not.toHaveFocus()
  })

  it('polls every 3 seconds and shows success only from the authoritative status', async () => {
    const handlers = renderPanel()
    await tick(3_000)
    expect(browserSubscription.payment).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Đã nhận thanh toán')).toBeNull()
    vi.mocked(browserSubscription.payment).mockResolvedValue(
      payment({ status: 'SUCCEEDED', paidAt: new Date(NOW).toISOString() }),
    )
    await tick(3_000)
    expect(
      screen.getByRole('heading', { name: 'Đã nhận thanh toán' }),
    ).toHaveFocus()
    expect(handlers.onPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUCCEEDED' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem quyền lợi gói Plus' }),
    )
    expect(handlers.onActivated).toHaveBeenCalledTimes(1)
    const calls = vi.mocked(browserSubscription.payment).mock.calls.length
    await tick(9_000)
    expect(browserSubscription.payment).toHaveBeenCalledTimes(calls)
  })

  it('adopts a refreshed SUCCEEDED prop for the same payment and never reports the stale pending copy', async () => {
    const onPayment = vi.fn()
    const props = {
      planName: 'Plus',
      busy: false,
      focusOnOpen: false,
      onPayment,
      onBack: vi.fn(),
      onRenew: vi.fn(),
      onActivated: vi.fn(),
    }
    const { rerender } = render(
      <PayosPaymentPanel payment={payment()} {...props} />,
    )
    rerender(
      <PayosPaymentPanel
        payment={payment({
          status: 'SUCCEEDED',
          paidAt: new Date(NOW).toISOString(),
        })}
        {...props}
      />,
    )
    await tick(0)
    expect(
      screen.getByRole('heading', { name: 'Đã nhận thanh toán' }),
    ).toBeInTheDocument()
    expect(onPayment).not.toHaveBeenCalled()
  })

  it('shows a plain reason for each terminal reason and polling stops', async () => {
    for (const [terminalReason, heading] of [
      ['CANCELLED', 'Giao dịch đã được hủy'],
      ['PROVIDER_FAILED', 'Thanh toán chưa thành công'],
      ['EXPIRED', 'Mã thanh toán đã hết hạn'],
    ] as const) {
      vi.mocked(browserSubscription.payment).mockReset()
      vi.mocked(browserSubscription.payment).mockResolvedValue(
        payment({
          status: 'FAILED',
          terminalReason,
          failedAt: new Date(NOW).toISOString(),
        }),
      )
      const { unmount } = render(
        <PayosPaymentPanel
          payment={payment()}
          planName="Plus"
          busy={false}
          focusOnOpen={false}
          onPayment={vi.fn()}
          onBack={vi.fn()}
          onRenew={vi.fn()}
          onActivated={vi.fn()}
        />,
      )
      await tick(3_000)
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /Mã QR/ })).toBeNull()
      expect(browserSubscription.payment).toHaveBeenCalledTimes(1)
      unmount()
    }
  })

  it('announces lost connection only after two failed polls, and clears it on the next success', async () => {
    renderPanel()
    vi.mocked(browserSubscription.payment).mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    await tick(3_000)
    expect(screen.queryByText('Mất kết nối, đang thử lại…')).toBeNull()
    await tick(3_000)
    expect(screen.getByText('Mất kết nối, đang thử lại…')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Mã QR/ })).toBeInTheDocument()
    vi.mocked(browserSubscription.payment).mockResolvedValue(payment())
    await tick(3_000)
    expect(screen.getByText('Đang chờ ngân hàng xác nhận…')).toBeInTheDocument()
    expect(browserSubscription.payment).toHaveBeenCalledTimes(3)
    // A lone failure after a success is again not announced.
    vi.mocked(browserSubscription.payment).mockRejectedValue(new Error('x'))
    await tick(3_000)
    expect(screen.queryByText('Mất kết nối, đang thử lại…')).toBeNull()
  })

  it('refreshes immediately when the tab regains focus', async () => {
    renderPanel()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(browserSubscription.payment).toHaveBeenCalledTimes(1)
  })

  it('backs off while the tab is hidden', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    renderPanel()
    await tick(3_000)
    expect(browserSubscription.payment).not.toHaveBeenCalled()
    await tick(12_000)
    expect(browserSubscription.payment).toHaveBeenCalledTimes(1)
    visibility.mockRestore()
  })

  it('copies a transfer value and acknowledges it, or says it could not', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderPanel()
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Sao chép số tài khoản' }),
      )
    })
    expect(writeText).toHaveBeenCalledWith('0000000786')
    expect(screen.getByText('Đã sao chép số tài khoản')).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('alert')).toBeNull()

    writeText.mockRejectedValue(new Error('denied'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép số tiền' }))
    })
    expect(writeText).toHaveBeenLastCalledWith('5000')
    expect(screen.getByRole('alert')).toHaveTextContent(/Không sao chép được/)
  })

  it('names copy buttons from their visible text plus a hidden field suffix', () => {
    renderPanel()
    const button = screen.getByRole('button', { name: 'Sao chép số tài khoản' })
    expect(button).not.toHaveAttribute('aria-label')
    expect(button).toHaveTextContent('Sao chép số tài khoản')
  })

  it('offers choosing another plan, not a retry, after a failed payment', async () => {
    vi.mocked(browserSubscription.payment).mockResolvedValue(
      payment({ status: 'FAILED', terminalReason: 'PROVIDER_FAILED' }),
    )
    const handlers = renderPanel()
    await tick(3_000)
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại gói' }))
    expect(handlers.onBack).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  })

  it('returns to the plans without cancelling the payment', () => {
    const handlers = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Quay lại các gói/ }))
    expect(handlers.onBack).toHaveBeenCalledTimes(1)
    expect(handlers.onPayment).not.toHaveBeenCalled()
  })
})
