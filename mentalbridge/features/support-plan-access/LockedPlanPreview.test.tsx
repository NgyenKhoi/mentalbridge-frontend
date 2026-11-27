import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'
import LockedPlanPreview from './LockedPlanPreview'
import PlanUpgradeContinue from './PlanUpgradeContinue'
import { hasUpgradeIntent, rememberUpgradeIntent } from './plan-access'

afterEach(() => sessionStorage.clear())

describe('LockedPlanPreview', () => {
  it('labels the example and keeps the try-out local', async () => {
    render(
      <LockedPlanPreview
        next={{ label: 'Xem lại gợi ý hỗ trợ', href: '/g' }}
      />,
    )
    const sample = screen.getByRole('figure', {
      name: 'Ví dụ minh hoạ, không phải kế hoạch của bạn',
    })
    expect(sample).toHaveTextContent('Ngày 3 trên 14 · 4 việc đã làm')
    const task = screen.getByRole('button', {
      name: /Đọc một bài ngắn về giấc ngủ/,
    })
    expect(task).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(task)
    expect(task).toHaveAttribute('aria-pressed', 'true')
    expect(sample).toHaveTextContent('5 việc đã làm')
    expect(
      screen.getByRole('link', { name: 'Xem lại gợi ý hỗ trợ' }),
    ).toHaveAttribute('href', '/g')
  })

  it('remembers the upgrade intent when the user leaves to upgrade', async () => {
    render(<LockedPlanPreview />)
    await userEvent.click(screen.getByRole('link', { name: 'Nâng cấp Plus' }))
    expect(hasUpgradeIntent()).toBe(true)
  })
})

const account = (
  facts: Pick<
    ServiceCreditAccount,
    'source' | 'packageCode' | 'entitlementState' | 'supportPlanEnabled'
  >,
) => facts as ServiceCreditAccount

describe('PlanUpgradeContinue', () => {
  const paid = account({
    source: 'PAID',
    packageCode: 'PLUS',
    entitlementState: 'ACTIVE',
    supportPlanEnabled: true,
  })

  it('offers the way back only with confirmed access and an intent', () => {
    const { rerender } = render(<PlanUpgradeContinue account={paid} />)
    expect(screen.queryByRole('link')).toBeNull()

    rememberUpgradeIntent()
    rerender(
      <PlanUpgradeContinue
        account={account({
          source: 'DEFAULT_FREE',
          packageCode: 'FREE',
          entitlementState: 'DEFAULT_FREE',
          supportPlanEnabled: false,
        })}
      />,
    )
    expect(screen.queryByRole('link')).toBeNull()

    rerender(<PlanUpgradeContinue account={{ ...paid }} />)
    expect(
      screen.getByRole('link', { name: /Tiếp tục tới kế hoạch/ }),
    ).toHaveAttribute('href', '/support-plan')
  })
})
