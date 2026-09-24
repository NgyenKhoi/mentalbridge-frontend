import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceBrowserError } from '../api/browser-resources'
import ResourceDetail from './ResourceDetail'

const api = vi.hoisted(() => ({ getResourceDetail: vi.fn() }))

vi.mock('../api/browser-resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/browser-resources')>()),
  getResourceDetail: api.getResourceDetail,
}))

const resource = {
  id: '00000000-0000-4000-8000-000000000213',
  category: 'VIDEO' as const,
  locale: 'vi-VN',
  title: 'Video: Thở chánh niệm ngắn',
  summary: 'Video hướng dẫn ngắn đã được rà soát.',
  contentBody: 'Thực hành ở mức bạn thấy dễ chịu.',
  externalUrl: 'https://www.youtube.com/watch?v=wfDTp2GogaQ',
  sourceOrganization: 'NHS Every Mind Matters',
  sourceTitle: 'Mindful Breathing Exercise',
  sourceUrl:
    'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/top-tips-to-improve-your-mental-wellbeing/',
  sourceReviewNote: 'Đã xác minh video và tác giả.',
  contentVersion: '4',
  status: 'PUBLISHED' as const,
  reviewedAt: '2026-09-23T00:00:00Z',
  effectiveAt: '2026-09-23T00:00:00Z',
  expiresAt: null,
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
}

describe('ResourceDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders full content, provenance, video action, and catalogue return', async () => {
    api.getResourceDetail.mockResolvedValue(resource)

    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)

    expect(
      await screen.findByRole('heading', { name: resource.title }),
    ).toBeVisible()
    expect(screen.getByText(resource.contentBody)).toBeVisible()
    expect(screen.getByText(resource.sourceTitle)).toBeVisible()
    expect(screen.queryByText(resource.sourceReviewNote)).toBeNull()
    expect(
      screen.getByRole('link', { name: /xem video tại nguồn/i }),
    ).toHaveAttribute('href', resource.externalUrl)
    expect(
      screen.getByRole('link', { name: /quay lại thư viện/i }),
    ).toHaveAttribute('href', '/resources')
  })

  it('returns to Support Plan when opened from an occurrence', async () => {
    api.getResourceDetail.mockResolvedValue(resource)
    render(
      <ResourceDetail
        resourceId={resource.id}
        fromSupportPlan
        contentVersion="4"
      />,
    )

    expect(
      await screen.findByRole('link', { name: /quay lại kế hoạch hỗ trợ/i }),
    ).toHaveAttribute('href', '/support-plan')
    expect(api.getResourceDetail).toHaveBeenCalledWith(
      resource.id,
      '4',
      expect.anything(),
    )
  })

  it('shows a bounded not-found state', async () => {
    api.getResourceDetail.mockRejectedValue(new ResourceBrowserError(404))
    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy tài nguyên',
    )
  })

  it('uses resource-focused loading and unavailable copy', async () => {
    api.getResourceDetail.mockReturnValueOnce(new Promise(() => undefined))
    const { unmount } = render(
      <ResourceDetail resourceId={resource.id} fromSupportPlan={false} />,
    )
    expect(screen.getByText('Đang tải nội dung…')).toBeVisible()
    expect(screen.queryByText(/Content service/i)).toBeNull()
    unmount()

    api.getResourceDetail.mockRejectedValueOnce(new ResourceBrowserError(503))
    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)
    expect(
      await screen.findByText('Tài nguyên này tạm thời chưa tải được'),
    ).toBeVisible()
    expect(screen.queryByText(/Content service/i)).toBeNull()
  })
})
