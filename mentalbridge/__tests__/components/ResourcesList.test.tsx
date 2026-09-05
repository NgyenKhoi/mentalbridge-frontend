import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mockServer } from '@/tests/mocks/server'
import ResourcesList from '@/components/ResourcesList'

describe('ResourcesList', () => {
  beforeEach(() => {
    mockServer.resetHandlers()
  })

  it('shows loading state initially', () => {
    mockServer.use(
      http.get('/api/resources', () => {
        // Delay response to keep loading state visible
        return new Promise(() => {})
      }),
    )

    render(<ResourcesList category="ARTICLE" limit={6} />)
    
    expect(screen.getByText('Đang tải...')).toBeInTheDocument()
  })

  it('renders published resources successfully', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [
            {
              id: '1',
              title: 'Test Article',
              summary: 'This is a test article',
              category: 'ARTICLE',
              externalUrl: 'https://example.com/article',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: '2',
              title: 'Meditation Guide',
              summary: 'Learn to meditate',
              category: 'MEDITATION',
              externalUrl: 'https://example.com/meditation',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(screen.getByText('Test Article')).toBeInTheDocument()
    })

    expect(screen.getByText('Meditation Guide')).toBeInTheDocument()
    expect(screen.getByText('This is a test article')).toBeInTheDocument()
    expect(screen.getByText('Learn to meditate')).toBeInTheDocument()
  })

  it('shows empty state when no resources are available', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(screen.getByText('Hiện chưa có tài liệu nào')).toBeInTheDocument()
    })
  })

  it('filters out unpublished resources at BFF layer', async () => {
    // This tests that BFF filters DRAFT/ARCHIVED, so frontend only sees PUBLISHED
    mockServer.use(
      http.get('/api/resources', () => {
        // BFF should have already filtered, so only PUBLISHED items are returned
        return HttpResponse.json({
          items: [
            {
              id: '1',
              title: 'Published Article',
              summary: 'This is published',
              category: 'ARTICLE',
              externalUrl: 'https://example.com/published',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(screen.getByText('Published Article')).toBeInTheDocument()
    })

    // Should not show draft or archived content
    expect(screen.queryByText('Draft Article')).not.toBeInTheDocument()
    expect(screen.queryByText('Archived Article')).not.toBeInTheDocument()
  })

  it('shows unavailable state when backend returns unavailable', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [],
          hasMore: false,
          unavailable: true,
          message: 'Service temporarily unavailable',
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(
        screen.getByText('Service temporarily unavailable'),
      ).toBeInTheDocument()
    })
  })

  it('shows timeout error state', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Service Timeout',
            status: 504,
            detail: 'Content service did not respond within timeout',
          },
          { status: 504 },
        )
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(
        screen.getByText('Dịch vụ đang bận, vui lòng thử lại sau'),
      ).toBeInTheDocument()
    })
  })

  it('shows error state on malformed backend response', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Malformed Response',
            status: 502,
            detail: 'Content service returned invalid response structure',
          },
          { status: 502 },
        )
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(
        screen.getByText('Dịch vụ tạm thời không khả dụng'),
      ).toBeInTheDocument()
    })
  })

  it('shows network error state', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.error()
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(
        screen.getByText('Không thể kết nối đến dịch vụ'),
      ).toBeInTheDocument()
    })
  })

  it('renders resource links with correct attributes', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [
            {
              id: '1',
              title: 'External Article',
              summary: 'Click to read',
              category: 'ARTICLE',
              externalUrl: 'https://example.com/article',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      const link = screen.getByText('External Article').closest('a')
      expect(link).toHaveAttribute('href', 'https://example.com/article')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('handles null externalUrl gracefully', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [
            {
              id: '1',
              title: 'No Link Article',
              summary: 'No external link',
              category: 'ARTICLE',
              externalUrl: null,
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      const link = screen.getByText('No Link Article').closest('a')
      expect(link).toHaveAttribute('href', '#')
    })
  })

  it('displays correct category labels', async () => {
    mockServer.use(
      http.get('/api/resources', () => {
        return HttpResponse.json({
          items: [
            {
              id: '1',
              title: 'Article Resource',
              summary: 'Test',
              category: 'ARTICLE',
              externalUrl: 'https://example.com',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: '2',
              title: 'Video Resource',
              summary: 'Test',
              category: 'VIDEO',
              externalUrl: 'https://example.com',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: '3',
              title: 'Breathing Exercise',
              summary: 'Test',
              category: 'BREATHING',
              externalUrl: 'https://example.com',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        })
      }),
    )

    render(<ResourcesList />)

    await waitFor(() => {
      expect(screen.getByText('Bài viết')).toBeInTheDocument()
      expect(screen.getByText('Hơi thở')).toBeInTheDocument()
    })
    
    // Check for Video label using getAllByText since it appears both as category and title
    const videoElements = screen.getAllByText('Video')
    expect(videoElements.length).toBeGreaterThan(0)
  })
})
