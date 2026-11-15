import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  browserSubscription,
  SubscriptionBrowserError,
} from '../api/browser-client'
import SubscriptionCancellationPanel from './SubscriptionCancellationPanel'

vi.mock('../api/browser-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/browser-client')>()
  return {
    ...actual,
    browserSubscription: { current: vi.fn(), cancel: vi.fn() },
  }
})

const active = {
  subscriptionId: '62200000-0000-4000-8000-000000000005',
  planCode: 'PLUS' as const,
  status: 'ACTIVE' as const,
  currentPeriodStart: '2026-11-01T00:00:00Z',
  currentPeriodEnd: '2026-12-01T00:00:00Z',
  cancellationRequestedAt: null,
  paidAccessEndedAt: null,
  liveAppointmentId: null,
  liveSessionEndsAt: null,
  generatedAt: '2026-11-14T00:00:00Z',
}

const cancelled = {
  ...active,
  status: 'CANCELLED' as const,
  cancellationRequestedAt: '2026-11-14T00:01:00Z',
  paidAccessEndedAt: '2026-11-14T00:01:00Z',
}

const receipt = {
  ...cancelled,
  cancelledAppointments: 0,
  revokedCredits: 4,
}

async function confirmCancellation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Hủy gói hiện tại' }),
  )
  await user.click(screen.getByRole('button', { name: 'Xác nhận hủy gói' }))
}

describe('SubscriptionCancellationPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires confirmation and shows the authoritative cancelled state', async () => {
    vi.mocked(browserSubscription.current)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(cancelled)
    vi.mocked(browserSubscription.cancel).mockResolvedValue(receipt)

    const user = userEvent.setup()
    render(<SubscriptionCancellationPanel />)
    await user.click(
      await screen.findByRole('button', { name: 'Hủy gói hiện tại' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Hủy gói hiện tại?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy gói' }))

    expect(await screen.findByText(/Gói đã được hủy từ/)).toBeInTheDocument()
    expect(browserSubscription.cancel).toHaveBeenCalledTimes(1)
  })

  it('keeps the same command key when a lost response is retried', async () => {
    vi.mocked(browserSubscription.current)
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(new Error('reconciliation unavailable'))
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(new Error('reconciliation unavailable'))
    vi.mocked(browserSubscription.cancel).mockRejectedValue(
      new Error('network'),
    )
    const user = userEvent.setup()
    render(<SubscriptionCancellationPanel />)

    await confirmCancellation(user)
    await screen.findByText(/Kết quả yêu cầu chưa xác định/)
    await user.click(
      screen.getByRole('button', { name: 'Kiểm tra trạng thái' }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Hủy gói hiện tại' }),
      ).toBeEnabled(),
    )
    await confirmCancellation(user)

    await waitFor(() =>
      expect(browserSubscription.cancel).toHaveBeenCalledTimes(2),
    )
    const firstKey = vi.mocked(browserSubscription.cancel).mock.calls[0]?.[1]
    const secondKey = vi.mocked(browserSubscription.cancel).mock.calls[1]?.[1]
    expect(firstKey).toBe(secondKey)
  })

  it('keeps the authoritative receipt when the follow-up GET fails', async () => {
    vi.mocked(browserSubscription.current)
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(
        new SubscriptionBrowserError(503, 'CONSULTATION_UNAVAILABLE', 'down'),
      )
    vi.mocked(browserSubscription.cancel).mockResolvedValue(receipt)
    const onConfirmedCancellation = vi.fn()
    const user = userEvent.setup()
    render(
      <SubscriptionCancellationPanel
        onConfirmedCancellation={onConfirmedCancellation}
      />,
    )

    await confirmCancellation(user)
    expect(await screen.findByText(/Gói đã được hủy từ/)).toBeInTheDocument()
    expect(screen.getByText(/đã được máy chủ xác nhận hủy/)).toBeInTheDocument()
    expect(onConfirmedCancellation).toHaveBeenCalledTimes(1)
  })

  it('reconciles a timeout-after-commit without issuing a second command', async () => {
    vi.mocked(browserSubscription.current)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(cancelled)
    vi.mocked(browserSubscription.cancel).mockRejectedValue(
      new Error('connection dropped after commit'),
    )
    const user = userEvent.setup()
    render(<SubscriptionCancellationPanel />)

    await confirmCancellation(user)
    expect(await screen.findByText(/Gói đã được hủy từ/)).toBeInTheDocument()
    expect(browserSubscription.cancel).toHaveBeenCalledTimes(1)
  })

  it.each([
    { subscriptionId: '72200000-0000-4000-8000-000000000005' },
    { status: 'ACTIVE' },
  ])(
    'fails closed for a mismatched cancellation receipt: %o',
    async (drift) => {
      vi.mocked(browserSubscription.current).mockResolvedValue(active)
      vi.mocked(browserSubscription.cancel).mockResolvedValue({
        ...receipt,
        ...drift,
      } as typeof receipt)
      const user = userEvent.setup()
      render(<SubscriptionCancellationPanel />)

      await confirmCancellation(user)
      expect(
        await screen.findByText(/biên nhận không khớp/),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Hủy gói hiện tại' }),
      ).toBeDisabled()
    },
  )
})
