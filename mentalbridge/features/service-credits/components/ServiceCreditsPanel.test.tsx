import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceCreditsPanel from './ServiceCreditsPanel'
import { browserServiceCredits } from '../api/browser-client'

vi.mock('../api/browser-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/browser-client')>()
  return { ...actual, browserServiceCredits: { get: vi.fn() } }
})

const get = vi.mocked(browserServiceCredits.get)
const demo = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  packageCode: 'PLUS' as const,
  source: 'DEMO' as const,
  sourceReference: 'controlled-demo-377',
  periodStart: '2026-09-20T00:00:00Z',
  periodEnd: '2026-10-20T00:00:00Z',
  policyVersion: 'consultation-credit-v1' as const,
  balance: {
    available: 1,
    held: 0,
    consumed: 0,
    forfeited: 0,
    total: 1,
    releasedTransitions: 0,
  },
  history: [
    {
      eventId: 'bb2a8b90-cbe9-4f1c-8a04-ef957fb9c673',
      creditId: '98435d70-438e-4fa5-b642-0456ea3f8747',
      eventType: 'PROVISIONED' as const,
      source: 'DEMO' as const,
      packageCode: 'PLUS' as const,
      appointmentId: null,
      occurredAt: '2026-09-20T01:00:00Z',
    },
  ],
  generatedAt: '2026-09-20T01:00:01Z',
}

describe('ServiceCreditsPanel', () => {
  beforeEach(() => get.mockReset())

  it('shows the provider balance and labels demo provenance truthfully', async () => {
    get.mockResolvedValue(demo)
    render(<ServiceCreditsPanel />)
    expect(
      await screen.findByRole('heading', { name: 'Plus' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Lượt tư vấn dùng thử/)).toBeInTheDocument()
    expect(screen.getByText('Còn lại').previousSibling).toHaveTextContent('1')
    expect(screen.getByText(/chỉ cấp thêm phần chênh lệch/)).toBeInTheDocument()
  })

  it('reloads the owner balance after a transient failure', async () => {
    get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(demo)
    const user = userEvent.setup()
    render(<ServiceCreditsPanel />)
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole('heading', { name: 'Plus' }),
    ).toBeInTheDocument()
  })
})
