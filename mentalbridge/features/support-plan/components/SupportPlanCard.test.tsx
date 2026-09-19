import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanCard from './SupportPlanCard'

describe('SupportPlanCard', () => {
  it('shows safety first, exact persisted proposal, provenance, and confirmation boundary', () => {
    const { container } = render(
      <SupportPlanCard plan={supportPlanFixture()} />,
    )

    expect(
      screen.getByText('Safety guidance remains available now.'),
    ).toBeVisible()
    expect(screen.getByText('Reviewed primary resource')).toBeVisible()
    expect(screen.getByText('Chưa kích hoạt')).toBeVisible()
    expect(screen.getByText('Bạn vẫn là người xác nhận')).toBeVisible()
    expect(screen.getByText(/mb-support-plan-selection-v1/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/totalScore|raw answer|journal/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
