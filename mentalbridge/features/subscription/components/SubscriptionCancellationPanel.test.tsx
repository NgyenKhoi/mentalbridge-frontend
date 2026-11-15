import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserSubscription } from '../api/browser-client'
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

describe('SubscriptionCancellationPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires confirmation and shows the authoritative cancelled state', async () => {
    vi.mocked(browserSubscription.current)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({
        ...active,
        status: 'CANCELLED',
        cancellationRequestedAt: '2026-11-14T00:01:00Z',
        paidAccessEndedAt: '2026-11-14T00:01:00Z',
      })
    vi.mocked(browserSubscription.cancel).mockResolvedValue({
      ...active,
      status: 'CANCELLED',
      cancellationRequestedAt: '2026-11-14T00:01:00Z',
      paidAccessEndedAt: '2026-11-14T00:01:00Z',
      cancelledAppointments: 0,
      revokedCredits: 4,
    })

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
    vi.mocked(browserSubscription.current).mockResolvedValue(active)
    vi.mocked(browserSubscription.cancel).mockRejectedValue(
      new Error('network'),
    )
    const user = userEvent.setup()
    render(<SubscriptionCancellationPanel />)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.click(
        await screen.findByRole('button', { name: 'Hủy gói hiện tại' }),
      )
      await user.click(screen.getByRole('button', { name: 'Xác nhận hủy gói' }))
      await screen.findByRole('alert')
    }

    await waitFor(() =>
      expect(browserSubscription.cancel).toHaveBeenCalledTimes(2),
    )
    const firstKey = vi.mocked(browserSubscription.cancel).mock.calls[0]?.[1]
    const secondKey = vi.mocked(browserSubscription.cancel).mock.calls[1]?.[1]
    expect(firstKey).toBe(secondKey)
  })
})
