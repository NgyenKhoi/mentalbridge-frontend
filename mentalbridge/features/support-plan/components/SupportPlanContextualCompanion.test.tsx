import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SupportPlanContextualCompanion from './SupportPlanContextualCompanion'

const planId = '10000000-0000-4000-8000-000000000650'
const actionId = '20000000-0000-4000-8000-000000000650'

describe('SupportPlanContextualCompanion', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('does not request on focus and sends only bounded action identity after an explicit click', () => {
    const onRequest = vi.fn()
    render(
      <SupportPlanContextualCompanion
        supportPlanId={planId}
        actionId={actionId}
        actionTitle="Bài thở 4–6"
        surface="PLAN"
        onRequest={onRequest}
        onDismiss={vi.fn()}
      />,
    )
    const trigger = screen.getByRole('button', {
      name: 'Nhờ bạn đồng hành giải thích: Bài thở 4–6',
    })
    fireEvent.focus(trigger)
    expect(onRequest).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    expect(onRequest).toHaveBeenCalledWith({
      targetId: trigger.id,
      supportPlanId: planId,
      actionId,
      actionTitle: 'Bài thở 4–6',
      surface: 'PLAN',
    })
  })

  it('shows nonblocking loading, announces a requested response, and restores focus on dismiss', () => {
    const onDismiss = vi.fn()
    const common = {
      supportPlanId: planId,
      actionId,
      actionTitle: 'Bài thở 4–6',
      surface: 'TODAY' as const,
      onRequest: vi.fn(),
      onDismiss,
    }
    const { rerender } = render(<SupportPlanContextualCompanion {...common} />)
    const trigger = screen.getByRole('button', { name: /Bài thở 4–6/ })
    rerender(
      <SupportPlanContextualCompanion
        {...common}
        snapshot={{
          ...common,
          targetId: trigger.id,
          requestId: 1,
          status: 'loading',
        }}
      />,
    )
    expect(screen.getByText('Đang chuẩn bị lời giải thích…')).toBeVisible()
    expect(trigger).toHaveAttribute('aria-busy', 'true')

    rerender(
      <SupportPlanContextualCompanion
        {...common}
        snapshot={{
          ...common,
          targetId: trigger.id,
          requestId: 1,
          status: 'ready',
          message: 'Lời giải thích đã được kiểm duyệt.',
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lời giải thích đã được kiểm duyệt.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đóng lời giải thích' }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
  })

  it('keeps requested text visible but suppresses live announcements while muted', () => {
    window.sessionStorage.setItem(
      'mentalbridge_support_plan_companion_session_muted',
      'true',
    )
    const common = {
      supportPlanId: planId,
      actionId,
      actionTitle: 'Bài thở 4–6',
      surface: 'PLAN' as const,
      onRequest: vi.fn(),
      onDismiss: vi.fn(),
    }
    const { container, rerender } = render(
      <SupportPlanContextualCompanion {...common} />,
    )
    const trigger = screen.getByRole('button', { name: /Bài thở 4–6/ })
    rerender(
      <SupportPlanContextualCompanion
        {...common}
        snapshot={{
          targetId: trigger.id,
          requestId: 1,
          supportPlanId: planId,
          actionId,
          actionTitle: 'Bài thở 4–6',
          surface: 'PLAN',
          status: 'ready',
          message: 'Nội dung vẫn đọc được.',
        }}
      />,
    )
    expect(screen.getByText('Nội dung vẫn đọc được.')).toBeVisible()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('disables every contextual trigger while the journey has an admitted request', () => {
    const onRequest = vi.fn()
    render(
      <SupportPlanContextualCompanion
        supportPlanId={planId}
        actionId={actionId}
        actionTitle="Bài thở 4–6"
        surface="PLAN"
        requestPending
        onRequest={onRequest}
        onDismiss={vi.fn()}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Bài thở 4–6/ })
    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    expect(onRequest).not.toHaveBeenCalled()
  })
})
