import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanCard from './SupportPlanCard'

vi.mock('./SupportPlanSchedule', () => ({
  default: () => <div data-testid="support-plan-schedule" />,
}))

function renderCard(
  plan = supportPlanFixture(),
  onSaveChoices = vi.fn(async () => undefined),
  onActivate = vi.fn(async () => undefined),
  onStatusChange = vi.fn(async () => undefined),
) {
  const view = render(
    <SupportPlanCard
      plan={plan}
      busy={null}
      message=""
      onSaveChoices={onSaveChoices}
      onActivate={onActivate}
      onStatusChange={onStatusChange}
    />,
  )
  return { ...view, onSaveChoices, onActivate, onStatusChange }
}

describe('SupportPlanCard', () => {
  it('puts governed safety before the editable admitted choices', () => {
    const { container } = renderCard()

    expect(
      screen.getByText('Safety guidance remains available now.'),
    ).toBeVisible()
    expect(screen.getByText('Chưa kích hoạt')).toBeVisible()
    expect(screen.getByText('Bạn là người quyết định')).toBeVisible()
    expect(screen.getByText(/mb-support-plan-selection-v1/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/totalScore|raw answer|journal/i)
    const safety = container.querySelector('.support-plan-safety')
    const choices = container.querySelector('.support-plan-slots')
    expect(
      safety && choices
        ? Boolean(
            safety.compareDocumentPosition(choices) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : false,
    ).toBe(true)
  })

  it('saves only the exact admitted alternative and blocks activation while dirty', () => {
    const { onSaveChoices, onActivate } = renderCard()

    fireEvent.click(screen.getByRole('radio', { name: /Reviewed alternative/ }))
    expect(
      screen.getByRole('button', { name: 'Kích hoạt SupportPlan' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    expect(onSaveChoices).toHaveBeenCalledWith({
      slotSelections: [
        {
          slotId: 'depressive-psychoeducation',
          resourceId: '50000000-0000-4000-8000-000000000372',
          contentVersion: '2',
        },
      ],
    })
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('allows an optional slot to be removed while retaining the core choice', () => {
    const fixture = supportPlanFixture()
    const optionalResource = {
      ...fixture.slots[0].selectedResource!,
      resourceId: '70000000-0000-4000-8000-000000000373',
      publicationId: '80000000-0000-4000-8000-000000000373',
      title: 'Optional reviewed resource',
    }
    const optionalPlan = {
      ...fixture,
      slots: [
        ...fixture.slots,
        {
          ...fixture.slots[0],
          slotId: 'optional-wellbeing-practice',
          kind: 'OPTIONAL' as const,
          selectedResource: optionalResource,
          allowedAlternatives: [],
        },
      ],
      selectedResourceCount: 2,
    }
    const { onSaveChoices } = renderCard(optionalPlan)

    fireEvent.click(
      screen.getByRole('radio', { name: /Bỏ nội dung bổ trợ này/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    expect(onSaveChoices).toHaveBeenCalledWith({
      slotSelections: [
        {
          slotId: 'depressive-psychoeducation',
          resourceId: '30000000-0000-4000-8000-000000000372',
          contentVersion: '4',
        },
      ],
    })
  })

  it('renders an authoritative active plan without draft controls', () => {
    const fixture = supportPlanFixture()
    renderCard({
      ...fixture,
      status: 'ACTIVE',
      version: 1,
      activatedAt: '2026-09-20T05:00:00Z',
    })

    expect(screen.getByText('Đang hoạt động')).toBeVisible()
    expect(screen.getByText('SupportPlan đang hoạt động')).toBeVisible()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Kích hoạt SupportPlan' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('support-plan-schedule')).toBeVisible()
  })

  it('keeps lifecycle decisions explicit and user-controlled', () => {
    const fixture = supportPlanFixture()
    const { onStatusChange, rerender } = renderCard(fixture)

    fireEvent.click(screen.getByRole('button', { name: 'Hủy bản nháp' }))
    expect(onStatusChange).toHaveBeenCalledWith('DISCARDED')

    rerender(
      <SupportPlanCard
        plan={{
          ...fixture,
          status: 'ACTIVE',
          version: 1,
          activatedAt: '2026-09-20T05:00:00Z',
        }}
        busy={null}
        message=""
        onSaveChoices={vi.fn()}
        onActivate={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng kế hoạch' }))
    expect(onStatusChange).toHaveBeenCalledWith('PAUSED')

    rerender(
      <SupportPlanCard
        plan={{ ...fixture, status: 'DISCARDED', version: 1 }}
        busy={null}
        message=""
        onSaveChoices={vi.fn()}
        onActivate={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )
    expect(screen.getByText('Bản nháp SupportPlan đã hủy')).toBeVisible()
    expect(screen.queryByTestId('support-plan-schedule')).toBeNull()
  })
})
