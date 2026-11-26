import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionPageContent from './SubscriptionPageContent'

const mounts = vi.hoisted(() => ({ credits: 0, checkout: 0 }))

vi.mock(
  '@/features/service-credits/components/ServiceCreditsPanel',
  async () => {
    const React = await import('react')
    return {
      default: function Credits() {
        const [mount] = React.useState(() => ++mounts.credits)
        return <div>credits-mount-{mount}</div>
      },
    }
  },
)

vi.mock('@/features/subscription/components/PlanCheckoutPanel', async () => {
  const React = await import('react')
  return {
    default: function Checkout() {
      const [mount] = React.useState(() => ++mounts.checkout)
      return <div>checkout-mount-{mount}</div>
    },
  }
})

vi.mock(
  '@/features/subscription/components/SubscriptionCancellationPanel',
  () => ({
    default: ({
      onConfirmedCancellation,
    }: {
      onConfirmedCancellation?: () => void
    }) => (
      <button type="button" onClick={onConfirmedCancellation}>
        confirmed cancellation
      </button>
    ),
  }),
)

describe('SubscriptionPageContent', () => {
  beforeEach(() => {
    mounts.credits = 0
    mounts.checkout = 0
  })

  it('reloads credit and checkout owner state after confirmed cancellation', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPageContent />)
    expect(screen.getByText('credits-mount-1')).toBeInTheDocument()
    expect(screen.getByText('checkout-mount-1')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'confirmed cancellation' }),
    )

    expect(await screen.findByText('credits-mount-2')).toBeInTheDocument()
    expect(screen.getByText('checkout-mount-2')).toBeInTheDocument()
  })
})
