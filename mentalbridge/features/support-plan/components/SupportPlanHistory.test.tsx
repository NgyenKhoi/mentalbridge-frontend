import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { supportPlanFixture } from '../testing/support-plan-fixture'
import SupportPlanHistory from './SupportPlanHistory'

const api = vi.hoisted(() => ({ getSupportPlan: vi.fn() }))

vi.mock('../api/browser-support-plan', () => api)

const completed = {
  ...supportPlanFixture(),
  status: 'COMPLETED' as const,
  version: 4,
  activatedAt: '2026-09-20T05:00:00Z',
  updatedAt: '2026-09-21T05:00:00Z',
  completedAt: '2026-09-21T05:00:00Z',
  completionReason: 'USER_DECISION' as const,
}

describe('SupportPlanHistory', () => {
  it('loads immutable owner detail instead of reconstructing it locally', async () => {
    api.getSupportPlan.mockResolvedValue(completed)

    render(
      <SupportPlanHistory
        items={[completed]}
        loading={false}
        loadingMore={false}
        hasMore={false}
        message=""
        onRetry={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }))

    expect(
      await screen.findByText('Người dùng chủ động kết thúc'),
    ).toBeVisible()
    expect(api.getSupportPlan).toHaveBeenCalledWith(completed.supportPlanId)
    expect(screen.getByText('Reviewed primary resource')).toBeVisible()
    expect(screen.getByText(/không có nghĩa là bạn đã hồi phục/)).toBeVisible()
  })

  it('offers retry and bounded pagination only in the matching states', () => {
    const retry = vi.fn()
    const loadMore = vi.fn()
    const { rerender } = render(
      <SupportPlanHistory
        items={[]}
        loading={false}
        loadingMore={false}
        hasMore={false}
        message="Không tải được"
        onRetry={retry}
        onLoadMore={loadMore}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }))
    expect(retry).toHaveBeenCalledOnce()

    rerender(
      <SupportPlanHistory
        items={[completed]}
        loading={false}
        loadingMore={false}
        hasMore
        message=""
        onRetry={retry}
        onLoadMore={loadMore}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm lịch sử' }))
    expect(loadMore).toHaveBeenCalledOnce()
  })
})
