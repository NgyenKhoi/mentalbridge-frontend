import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SupportPlanCompanionPanel, {
  type SupportPlanGuidedContext,
} from './SupportPlanCompanionPanel'
import { nativeSupportPlanReviewFixture } from '../testing/native-support-plan-review-fixture'

const context: SupportPlanGuidedContext = {
  supportPlanId: '10000000-0000-4000-8000-000000000651',
  action: {
    actionId: '20000000-0000-4000-8000-000000000651',
    title: 'Đi bộ 10 phút',
    requestSurface: 'TODAY',
  },
}

const baseProps = {
  surface: 'today' as const,
  context,
  muted: false,
  modal: false,
  onRequest: vi.fn(),
  onNavigate: vi.fn(),
  onClose: vi.fn(),
}

describe('SupportPlanCompanionPanel', () => {
  it('waits for an approved starter and sends only the bounded action identity', () => {
    const onRequest = vi.fn()
    render(<SupportPlanCompanionPanel {...baseProps} onRequest={onRequest} />)

    expect(onRequest).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Vì sao hoạt động này có trong kế hoạch?',
      }),
    )

    expect(onRequest).toHaveBeenCalledOnce()
    expect(onRequest).toHaveBeenCalledWith({
      targetId: expect.stringMatching(/^companion-panel-explain-/),
      supportPlanId: context.supportPlanId,
      actionId: context.action?.actionId,
      actionTitle: 'Đi bộ 10 phút',
      surface: 'TODAY',
    })
  })

  it('labels an explicitly requested AI response and suppresses its announcement when muted', () => {
    const onRequest = vi.fn()
    const view = render(
      <SupportPlanCompanionPanel {...baseProps} onRequest={onRequest} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Vì sao/ }))
    const targetId = onRequest.mock.calls[0][0].targetId as string

    view.rerender(
      <SupportPlanCompanionPanel
        {...baseProps}
        onRequest={onRequest}
        snapshot={{
          requestId: 1,
          targetId,
          supportPlanId: context.supportPlanId,
          actionId: context.action!.actionId,
          actionTitle: context.action!.title,
          surface: 'TODAY',
          status: 'ready',
          message: 'Lời giải thích đã được Care kiểm soát.',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Lời giải thích đã được Care kiểm soát.',
    )
    expect(
      screen.getByText('AI diễn đạt từ dữ liệu kế hoạch đã duyệt'),
    ).toBeVisible()

    view.rerender(
      <SupportPlanCompanionPanel
        {...baseProps}
        muted
        onRequest={onRequest}
        snapshot={{
          requestId: 1,
          targetId,
          supportPlanId: context.supportPlanId,
          actionId: context.action!.actionId,
          actionTitle: context.action!.title,
          surface: 'TODAY',
          status: 'ready',
          message: 'Lời giải thích đã được Care kiểm soát.',
        }}
      />,
    )
    expect(
      screen.getByText('Lời giải thích đã được Care kiểm soát.'),
    ).toBeVisible()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('labels a consent or provider fallback without presenting it as generated guidance', () => {
    const onRequest = vi.fn()
    const view = render(
      <SupportPlanCompanionPanel {...baseProps} onRequest={onRequest} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Vì sao/ }))
    const targetId = onRequest.mock.calls[0][0].targetId as string

    view.rerender(
      <SupportPlanCompanionPanel
        {...baseProps}
        onRequest={onRequest}
        snapshot={{
          requestId: 2,
          targetId,
          supportPlanId: context.supportPlanId,
          actionId: context.action!.actionId,
          actionTitle: context.action!.title,
          surface: 'TODAY',
          status: 'fallback',
          message: 'Chưa thể dùng hướng dẫn AI. Hoạt động gốc vẫn có thể xem.',
        }}
      />,
    )

    expect(
      screen.getByText('Phản hồi dự phòng, không thay đổi kế hoạch'),
    ).toBeVisible()
    expect(
      screen.queryByText('AI diễn đạt từ dữ liệu kế hoạch đã duyệt'),
    ).toBeNull()
  })

  it('uses plan facts for the next step and navigation without invoking a mutation', () => {
    const onNavigate = vi.fn()
    const planMutation = vi.fn()
    render(
      <>
        <SupportPlanCompanionPanel {...baseProps} onNavigate={onNavigate} />
        <button type="button" onClick={planMutation}>
          Lưu thay đổi kế hoạch
        </button>
      </>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Tôi nên bắt đầu từ đâu?' }),
    )
    expect(
      screen.getByText(/thứ tự hiển thị không phải là đánh giá lâm sàng/i),
    ).toBeVisible()
    expect(screen.getByText('Thông tin từ kế hoạch hiện tại')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Mở hoạt động này' }))
    expect(onNavigate).toHaveBeenCalledWith({
      surface: 'today',
      actionId: context.action?.actionId,
    })
    expect(planMutation).not.toHaveBeenCalled()
  })

  it('offers review explanation only for an authoritative available review', () => {
    const onRequest = vi.fn()
    const view = render(
      <SupportPlanCompanionPanel {...baseProps} onRequest={onRequest} />,
    )
    expect(screen.queryByRole('button', { name: /lần xem lại này/ })).toBeNull()

    view.rerender(
      <SupportPlanCompanionPanel
        {...baseProps}
        surface="adjust"
        context={{ ...context, review: nativeSupportPlanReviewFixture() }}
        onRequest={onRequest}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /lần xem lại này/ }))
    expect(
      screen.getByRole('heading', { name: 'Điều MentalBridge đã ghi nhận' }),
    ).toBeVisible()
    expect(screen.getByText('PHQ-9: thấp hơn giai đoạn trước.')).toBeVisible()
    expect(screen.getByText('GAD-7: cao hơn giai đoạn trước.')).toBeVisible()
    expect(
      screen.getByText(
        'Hoạt động “Check-in cảm xúc” được trình bày trong phương án mới là “Check-in cảm xúc vào buổi sáng”.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText(/Các tín hiệu chưa hoàn toàn cùng chiều/),
    ).toBeVisible()
    expect(onRequest).not.toHaveBeenCalled()
  })

  it('navigates to the authoritative review UI without issuing a plan mutation', () => {
    const onNavigate = vi.fn()
    const planMutation = vi.fn()
    render(
      <>
        <SupportPlanCompanionPanel
          {...baseProps}
          surface="adjust"
          context={{ ...context, review: nativeSupportPlanReviewFixture() }}
          onNavigate={onNavigate}
        />
        <button type="button" onClick={planMutation}>
          Chuyển kế hoạch
        </button>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: /lần xem lại này/ }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Xem chi tiết tại mục Điều chỉnh',
      }),
    )

    expect(onNavigate).toHaveBeenCalledWith({ surface: 'adjust' })
    expect(planMutation).not.toHaveBeenCalled()
  })

  it('clears the temporary guided turn after an independent remount', () => {
    const first = render(<SupportPlanCompanionPanel {...baseProps} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Tôi nên bắt đầu từ đâu?' }),
    )
    expect(screen.getByText('Thông tin từ kế hoạch hiện tại')).toBeVisible()
    first.unmount()

    render(<SupportPlanCompanionPanel {...baseProps} />)
    expect(screen.queryByText('Thông tin từ kế hoạch hiện tại')).toBeNull()
    expect(
      screen.getByText(/được xóa khi bạn tải lại hoặc rời Kế hoạch Hỗ trợ/),
    ).toBeVisible()
  })
})
