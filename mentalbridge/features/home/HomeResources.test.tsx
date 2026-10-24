import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeResources } from './HomeResources'
import { loadHomeResources, type HomeResourceSource } from './home-resources'
import { homeNextStepFixture } from './testing/home-next-step-fixture'

vi.mock('./home-resources', () => ({ loadHomeResources: vi.fn() }))

function data(source: HomeResourceSource = 'plan', count = 3) {
  return {
    source,
    items: Array.from({ length: count }, (_, index) => ({
      id: `resource-${index}`,
      title: `Bài đọc ${index + 1}`,
      href: `/resources/resource-${index}`,
      category: 'ARTICLE' as const,
      meta: index === 0 ? null : 'Bài đọc · 6 phút',
      action: 'Đọc',
    })),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(loadHomeResources).mockResolvedValue(data())
})

describe('HomeResources', () => {
  it.each([
    ['plan', 3, 'Trong kế hoạch'],
    ['plan', 1, 'Trong kế hoạch'],
    ['guide', 3, 'Từ hướng dẫn của bạn'],
    ['library', 3, 'Từ thư viện'],
  ] as const)(
    'renders %s source with %i cards and truthful tags',
    async (source, count, tag) => {
      vi.mocked(loadHomeResources).mockResolvedValue(data(source, count))
      render(<HomeResources home={homeNextStepFixture()} />)
      const heading = await screen.findByRole('heading', {
        name:
          source === 'library' ? 'Từ thư viện MentalBridge' : 'Dành cho bạn',
      })
      expect(heading).toBeVisible()
      await waitFor(() => expect(screen.getAllByText(tag)).toHaveLength(count))
      expect(screen.getAllByTestId(/home-resource-\d/)).toHaveLength(count)
      expect(
        within(screen.getByTestId('home-resource-0')).queryByText(/phút/),
      ).toBeNull()
      expect(screen.getByTestId('home-resource-0')).toHaveAttribute(
        'href',
        '/resources/resource-0',
      )
    },
  )

  it('holds three correctly sized skeletons while Home is loading', () => {
    render(<HomeResources home={null} loading />)
    expect(
      screen.getByRole('status', { name: 'Đang tải tài nguyên' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(loadHomeResources).not.toHaveBeenCalled()
  })

  it('hides the whole section and makes no request in safety', () => {
    const { container } = render(
      <HomeResources home={homeNextStepFixture()} hidden />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(loadHomeResources).not.toHaveBeenCalled()
  })

  it('shows a section-local error and retries the same source', async () => {
    vi.mocked(loadHomeResources).mockRejectedValueOnce(new Error('503'))
    render(<HomeResources home={homeNextStepFixture()} />)
    await screen.findByText('Chưa tải được tài nguyên.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('Bài đọc 1')
    expect(loadHomeResources).toHaveBeenCalledTimes(2)
  })

  it('offers the library when its catalogue is empty', async () => {
    vi.mocked(loadHomeResources).mockResolvedValue(data('library', 0))
    render(<HomeResources home={null} />)
    await screen.findByText('Chưa có tài nguyên để hiển thị.')
    expect(
      screen.getByRole('link', { name: 'Mở thư viện tài nguyên →' }),
    ).toHaveAttribute('href', '/resources')
  })

  it('keeps the plan heading when every recommendation is already the next step', async () => {
    vi.mocked(loadHomeResources).mockResolvedValue(data('plan', 0))
    render(<HomeResources home={homeNextStepFixture()} />)
    await screen.findByText('Chưa có tài nguyên để hiển thị.')
    expect(screen.getByRole('heading', { name: 'Dành cho bạn' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Từ thư viện MentalBridge' }),
    ).toBeNull()
    expect(screen.queryAllByTestId(/home-resource-\d/)).toHaveLength(0)
  })

  it('holds the skeleton during a new Home read instead of showing the old resource source', async () => {
    const first = homeNextStepFixture()
    vi.mocked(loadHomeResources).mockResolvedValueOnce(data('library', 1))
    const { rerender } = render(<HomeResources home={first} />)
    await screen.findByRole('heading', { name: 'Từ thư viện MentalBridge' })
    vi.mocked(loadHomeResources).mockReturnValueOnce(new Promise(() => {}))
    rerender(<HomeResources home={homeNextStepFixture()} />)
    expect(
      screen.getByRole('status', { name: 'Đang tải tài nguyên' }),
    ).toBeVisible()
    expect(screen.queryByText('Bài đọc 1')).toBeNull()
  })
})
