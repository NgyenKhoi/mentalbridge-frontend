import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import ResourcesList from '@/components/ResourcesList'
import { mockServer } from '@/tests/mocks/server'

const resource = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Bài viết đã kiểm duyệt',
  summary: 'Nội dung hỗ trợ đã được kiểm duyệt.',
  externalUrl: 'https://example.com/article',
  status: 'PUBLISHED',
  reviewedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
} as const

function respond(body: Record<string, unknown>, status = 200) {
  mockServer.use(
    http.get('/api/resources', () => HttpResponse.json(body, { status })),
  )
}

describe('ResourcesList', () => {
  beforeEach(() => {
    mockServer.resetHandlers()
  })

  it('announces the loading state and keeps future scope explicit', () => {
    mockServer.use(http.get('/api/resources', () => new Promise(() => {})))

    render(<ResourcesList category="ARTICLE" limit={6} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Đang tải...')).toBeInTheDocument()
    expect(screen.getByText('Chưa khả dụng')).toBeInTheDocument()
  })

  it('renders a reviewed resource and a safe external link', async () => {
    respond({ items: [resource], hasMore: false })

    render(<ResourcesList />)

    const link = await screen.findByRole('link', {
      name: /bài viết đã kiểm duyệt/i,
    })
    expect(link).toHaveAttribute('href', 'https://example.com/article')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(resource.summary)).toBeInTheDocument()
  })

  it('shows a distinct empty state', async () => {
    respond({ items: [], hasMore: false })

    render(<ResourcesList />)

    expect(
      await screen.findByText('Hiện chưa có tài liệu nào'),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the reviewed unavailable message returned by the BFF', async () => {
    respond({
      items: [],
      hasMore: false,
      unavailable: true,
      message:
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
    })

    render(<ResourcesList />)

    expect(
      await screen.findByText(
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
    ).toBeInTheDocument()
  })

  it('shows a distinct timeout state', async () => {
    respond({ code: 'CONTENT_TIMEOUT' }, 504)

    render(<ResourcesList />)

    expect(
      await screen.findByText('Dịch vụ đang bận, vui lòng thử lại sau'),
    ).toBeInTheDocument()
  })

  it('shows a generic error for a rejected request', async () => {
    respond({ code: 'CONTENT_REQUEST_FAILED' }, 401)

    render(<ResourcesList />)

    expect(
      await screen.findByText('Không thể tải tài liệu'),
    ).toBeInTheDocument()
  })

  it('shows dependency unavailable for a malformed upstream response', async () => {
    respond({ code: 'CONTENT_INVALID_RESPONSE' }, 502)

    render(<ResourcesList />)

    expect(
      await screen.findByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeInTheDocument()
  })

  it('shows a safe fallback when the browser request fails', async () => {
    mockServer.use(http.get('/api/resources', () => HttpResponse.error()))

    render(<ResourcesList />)

    expect(
      await screen.findByText('Không thể kết nối đến dịch vụ'),
    ).toBeInTheDocument()
  })

  it('renders a resource without an external URL as a non-interactive card', async () => {
    respond({
      items: [{ ...resource, externalUrl: null, title: 'Tài liệu tại chỗ' }],
      hasMore: false,
    })

    render(<ResourcesList />)

    await screen.findByText('Tài liệu tại chỗ')
    expect(
      screen.queryByRole('link', { name: /tài liệu tại chỗ/i }),
    ).not.toBeInTheDocument()
  })

  it('does not render an unsafe URL as a link even if the BFF regresses', async () => {
    respond({
      items: [
        {
          ...resource,
          title: 'Unsafe resource',
          externalUrl: 'javascript:alert(document.cookie)',
        },
      ],
      hasMore: false,
    })

    render(<ResourcesList />)

    await screen.findByText('Unsafe resource')
    expect(
      screen.queryByRole('link', { name: /unsafe resource/i }),
    ).not.toBeInTheDocument()
  })

  it('refetches when filters change and aborts the superseded request', async () => {
    let firstSignal: AbortSignal | undefined
    mockServer.use(
      http.get('/api/resources', ({ request }) => {
        if (new URL(request.url).searchParams.get('category') === 'ARTICLE') {
          firstSignal = request.signal
          return new Promise(() => {})
        }
        return HttpResponse.json({
          items: [{ ...resource, category: 'VIDEO', title: 'Video hỗ trợ' }],
          hasMore: false,
        })
      }),
    )

    const { rerender } = render(<ResourcesList category="ARTICLE" />)
    await waitFor(() => expect(firstSignal).toBeDefined())
    rerender(<ResourcesList category="VIDEO" />)

    expect(await screen.findByText('Video hỗ trợ')).toBeInTheDocument()
    await waitFor(() => expect(firstSignal?.aborted).toBe(true))
  })
})
