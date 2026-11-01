import { http, HttpResponse } from 'msw'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import {
  combinedMeaningFixture,
  supportEvaluationFixture,
} from '@/tests/fixtures/combined-meaning'
import { SupportEvaluationHistory } from './SupportEvaluationHistory'

const newest = combinedMeaningFixture({
  supportGuideId: '90000000-0000-4000-8000-000000000101',
})
const older = {
  ...combinedMeaningFixture({
    supportEvaluationId: '20000000-0000-4000-8000-000000000202',
    priority: 'PROFESSIONAL_SUPPORT',
  }),
  evaluatedAt: '2026-09-01T08:00:00Z',
  episodeCompletedAt: '2026-09-01T08:00:00Z',
}
const historyUrl = 'http://localhost/api/care/support-evaluations/history'
const meaningUrl =
  'http://localhost/api/care/support-evaluations/:id/combined-meaning'

function mockHistory() {
  mockServer.use(
    http.get(historyUrl, () =>
      HttpResponse.json({
        items: [
          supportEvaluationFixture(newest),
          supportEvaluationFixture(older),
        ],
        nextCursor: null,
        hasMore: false,
      }),
    ),
    http.get(meaningUrl, ({ params }) =>
      HttpResponse.json(
        params.id === older.supportEvaluationId ? older : newest,
      ),
    ),
  )
}

async function openSelector() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Chọn lần sàng lọc để xem kết quả' }),
  )
  return within(screen.getByRole('list', { name: 'Các kết quả đã lưu' }))
}

describe('SupportEvaluationHistory unified Meaning', () => {
  it('opens the newest exact saved pair with the same scores, meaning and Guide as Results', async () => {
    mockHistory()
    const { container } = render(<SupportEvaluationHistory />)
    expect(
      await screen.findByRole('heading', {
        name: newest.baseMeaning.text,
        level: 2,
      }),
    ).toBeVisible()
    expect(screen.getByText('5/27 điểm · Nhẹ')).toBeInTheDocument()
    expect(screen.getByText('4/21 điểm · Tối thiểu')).toBeInTheDocument()
    expect(container.querySelectorAll('.combined-meaning-score')).toHaveLength(
      2,
    )
    expect(container.querySelector('.combined-meaning-summary')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Mở trang kết quả' }),
    ).toHaveAttribute(
      'href',
      `/assessments/results/${newest.supportEvaluationId}`,
    )
    expect(
      screen.getByRole('link', { name: /Xem gợi ý đã lưu/ }),
    ).toHaveAttribute(
      'href',
      `/support-guides/${newest.supportGuideId}?from=screening-history&resultEvaluationId=${newest.supportEvaluationId}`,
    )
    expect(screen.queryByText('Hướng hỗ trợ tổng thể')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Quay lại lịch sử/ }),
    ).not.toBeInTheDocument()
    expect(container.querySelector('main')).not.toBeInTheDocument()
  })

  it('selects an older exact result without using latest scores or creating a Guide', async () => {
    mockHistory()
    const requests: string[] = []
    mockServer.use(
      http.get(meaningUrl, ({ params }) => {
        requests.push(String(params.id))
        return HttpResponse.json(
          params.id === older.supportEvaluationId ? older : newest,
        )
      }),
    )
    render(<SupportEvaluationHistory />)
    await screen.findByRole('heading', { name: newest.baseMeaning.text })
    const choices = await openSelector()
    const chooseOlder = choices.getByRole('button', {
      name: /Hỗ trợ chuyên môn/,
    })
    await userEvent.click(chooseOlder)
    expect(
      await screen.findByRole('heading', { name: older.baseMeaning.text }),
    ).toBeVisible()
    expect(chooseOlder).toHaveFocus()
    expect(chooseOlder).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('12/27 điểm · Trung bình')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Mở trang kết quả' }),
    ).toHaveAttribute(
      'href',
      `/assessments/results/${older.supportEvaluationId}`,
    )
    expect(requests).toEqual([
      newest.supportEvaluationId,
      older.supportEvaluationId,
    ])
    expect(
      screen.queryByRole('button', { name: /Tạo gợi ý/ }),
    ).not.toBeInTheDocument()
  })

  it('shows Mầm An and only loads the tab when activated', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let requests = 0
    mockHistory()
    mockServer.use(
      http.get(historyUrl, async () => {
        requests++
        await gate
        return HttpResponse.json({
          items: [supportEvaluationFixture(newest)],
          nextCursor: null,
          hasMore: false,
        })
      }),
    )
    const { rerender } = render(<SupportEvaluationHistory active={false} />)
    expect(requests).toBe(0)
    rerender(<SupportEvaluationHistory active />)
    await waitFor(() => expect(requests).toBe(1))
    expect(
      screen.getByRole('status', { name: 'Đang mở kết quả sau sàng lọc' }),
    ).toBeVisible()
    release()
    expect(
      await screen.findByRole('heading', { name: newest.baseMeaning.text }),
    ).toBeVisible()
    rerender(<SupportEvaluationHistory active={false} />)
    rerender(<SupportEvaluationHistory active />)
    expect(requests).toBe(1)
  })

  it('keeps selected Meaning when pagination fails and retries the same cursor without duplicates', async () => {
    mockHistory()
    let attempts = 0
    mockServer.use(
      http.get(historyUrl, ({ request }) => {
        if (new URL(request.url).searchParams.has('cursor')) {
          attempts++
          return attempts === 1
            ? HttpResponse.json({ code: 'CARE_UNAVAILABLE' }, { status: 503 })
            : HttpResponse.json({
                items: [
                  supportEvaluationFixture(newest),
                  supportEvaluationFixture(older),
                ],
                nextCursor: null,
                hasMore: false,
              })
        }
        return HttpResponse.json({
          items: [supportEvaluationFixture(newest)],
          nextCursor: 'next-page',
          hasMore: true,
        })
      }),
    )
    render(<SupportEvaluationHistory />)
    await screen.findByRole('heading', { name: newest.baseMeaning.text })
    await openSelector()
    await userEvent.click(
      screen.getByRole('button', { name: 'Tải thêm kết quả' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải thêm kết quả',
    )
    expect(
      screen.getByRole('heading', { name: newest.baseMeaning.text }),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    const choices = within(
      screen.getByRole('list', { name: 'Các kết quả đã lưu' }),
    )
    expect(
      await choices.findByRole('button', { name: /Hỗ trợ chuyên môn/ }),
    ).toBeVisible()
    expect(choices.getAllByRole('button')).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: newest.baseMeaning.text }),
    ).toBeVisible()
    expect(attempts).toBe(2)
  })

  it('does not replace unavailable historical Meaning with another pair', async () => {
    mockHistory()
    mockServer.use(
      http.get(meaningUrl, ({ params }) =>
        params.id === older.supportEvaluationId
          ? HttpResponse.json(
              {
                type: 'about:blank',
                title: 'Unavailable',
                status: 503,
                code: 'COMBINED_SCREENING_MEANING_UNAVAILABLE',
                correlationId: '40000000-0000-4000-8000-000000000101',
              },
              {
                status: 503,
                headers: { 'Content-Type': 'application/problem+json' },
              },
            )
          : HttpResponse.json(newest),
      ),
    )
    render(<SupportEvaluationHistory />)
    await screen.findByRole('heading', { name: newest.baseMeaning.text })
    const choices = await openSelector()
    await userEvent.click(
      choices.getByRole('button', { name: /Hỗ trợ chuyên môn/ }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'không ghép kết quả',
    )
    expect(
      screen.queryByRole('heading', { name: newest.baseMeaning.text }),
    ).not.toBeInTheDocument()
    expect(
      choices.getByRole('button', { name: /Hỗ trợ chuyên môn/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('prioritizes the same authoritative Safety surface as Results', async () => {
    const safety = combinedMeaningFixture({ priority: 'SAFETY' })
    mockServer.use(
      http.get(historyUrl, () =>
        HttpResponse.json({
          items: [supportEvaluationFixture(safety)],
          nextCursor: null,
          hasMore: false,
        }),
      ),
      http.get(meaningUrl, () => HttpResponse.json(safety)),
    )
    const { container } = render(<SupportEvaluationHistory />)
    expect(
      await screen.findByRole('heading', {
        name: 'Thông tin an toàn của lần sàng lọc này',
        level: 2,
      }),
    ).toBeVisible()
    const safetyRegion = container.querySelector('.combined-meaning-safety')!
    const scoreRegion = container.querySelector('.combined-meaning-scores')!
    expect(
      safetyRegion.compareDocumentPosition(scoreRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Nếu bạn cần hỗ trợ ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
  })

  it('offers an assessment start when there is no saved result', async () => {
    mockServer.use(
      http.get(historyUrl, () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
    )
    render(<SupportEvaluationHistory />)
    expect(
      await screen.findByRole('heading', { name: 'Chưa có kết quả tổng hợp' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Làm bài sàng lọc' }),
    ).toHaveAttribute('href', '/initial-check')
  })
})
