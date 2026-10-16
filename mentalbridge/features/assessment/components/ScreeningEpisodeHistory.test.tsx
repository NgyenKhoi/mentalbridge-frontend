import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import {
  combinedMeaningFixture,
  completedScreeningEpisodeFixture,
} from '@/tests/fixtures/combined-meaning'
import { ScreeningEpisodeHistory } from './ScreeningEpisodeHistory'

describe('ScreeningEpisodeHistory', () => {
  it('keeps the Mầm An loading state visible until the first page resolves', async () => {
    const initial = combinedMeaningFixture()
    let releaseResponse!: () => void
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })

    mockServer.use(
      http.get(
        'http://localhost/api/care/screening-episodes/history',
        async () => {
          await responseGate
          return HttpResponse.json({
            items: [completedScreeningEpisodeFixture(initial)],
            nextCursor: null,
            hasMore: false,
          })
        },
      ),
    )

    render(<ScreeningEpisodeHistory />)

    const loadingState = await screen.findByRole('status')
    expect(loadingState).toHaveAttribute('aria-busy', 'true')
    expect(within(loadingState).getAllByText(/M.*m An/)).toHaveLength(2)

    releaseResponse()

    expect(await screen.findByRole('link', { name: /Xem k/ })).toHaveAttribute(
      'href',
      `/assessments/results/${initial.supportEvaluationId}`,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows one card per exact saved pair and links to its meaning and persisted guide', async () => {
    const initial = combinedMeaningFixture({
      supportGuideId: '90000000-0000-4000-8000-000000000101',
    })
    const reassessment = combinedMeaningFixture({
      supportEvaluationId: '20000000-0000-4000-8000-000000000202',
      episodeId: '70000000-0000-4000-8000-000000000202',
      purpose: 'REASSESSMENT',
      priority: 'PROFESSIONAL_SUPPORT',
    })
    reassessment.episodeCompletedAt = '2026-10-10T09:30:00Z'

    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [
            completedScreeningEpisodeFixture(initial),
            completedScreeningEpisodeFixture(reassessment),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    const resultLinks = await screen.findAllByRole('link', {
      name: /Xem kết quả/,
    })
    expect(resultLinks).toHaveLength(2)
    expect(resultLinks[0]).toHaveAttribute(
      'href',
      `/assessments/results/${initial.supportEvaluationId}`,
    )
    expect(screen.getByText('5')).toBeVisible()
    const gad7Scales = screen.getAllByRole('meter', {
      name: 'GAD-7: 4 trên 21 điểm, mức Tối thiểu',
    })
    expect(gad7Scales).toHaveLength(2)
    expect(gad7Scales[0].querySelectorAll('[data-active="true"]')).toHaveLength(
      1,
    )
    expect(screen.getByRole('link', { name: /Gợi ý đã lưu/ })).toHaveAttribute(
      'href',
      `/support-guides/${initial.supportGuideId}?from=screening-history&resultEvaluationId=${initial.supportEvaluationId}`,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Đánh giá lại' }))
    expect(screen.getAllByRole('link', { name: /Xem kết quả/ })).toHaveLength(1)
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

  it('keeps an incompatible historical episode visible without guessing another pair', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [
            {
              episodeId: '70000000-0000-4000-8000-000000000303',
              purpose: 'INITIAL_CHECK',
              status: 'COMPLETED',
              startedAt: '2026-08-10T09:00:00Z',
              updatedAt: '2026-08-10T09:30:00Z',
              completedAt: '2026-08-10T09:30:00Z',
              presentationEvaluationId: '20000000-0000-4000-8000-000000000303',
              meaningState: 'UNAVAILABLE',
              evidence: [
                {
                  instrument: 'PHQ9',
                  state: 'UNAVAILABLE',
                  assessmentId: '10000000-0000-4000-8000-000000000303',
                  totalScore: null,
                  screeningLevel: null,
                  safetyStatus: null,
                },
                {
                  instrument: 'GAD7',
                  state: 'MISSING',
                  assessmentId: null,
                  totalScore: null,
                  screeningLevel: null,
                  safetyStatus: null,
                },
              ],
              meaning: null,
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    const warning = await screen.findByText(
      'Không thể dựng lại ý nghĩa tổng hợp của lượt này',
    )
    const card = warning.closest('article')
    expect(card).not.toBeNull()
    expect(within(card!).getByText(/không ghép đoán/i)).toBeVisible()
    expect(
      within(card!).queryByRole('link', { name: /Xem kết quả/ }),
    ).not.toBeInTheDocument()
  })

  it('surfaces the safety override before the reassuring base meaning', async () => {
    const safety = combinedMeaningFixture({ priority: 'SAFETY' })
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [completedScreeningEpisodeFixture(safety)],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(await screen.findByText('Ưu tiên an toàn')).toBeVisible()
    expect(
      screen.getByText(/thông tin an toàn cần được ưu tiên/i),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem hướng dẫn an toàn' }),
    ).toHaveAttribute(
      'href',
      `/assessments/results/${safety.supportEvaluationId}`,
    )
    expect(screen.queryByText(safety.baseMeaning.text)).not.toBeInTheDocument()
  })

  it('does not turn an unfinished historical safety answer into a new positive trigger', async () => {
    const episode = completedScreeningEpisodeFixture(
      combinedMeaningFixture({ priority: 'SAFETY' }),
    )
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [
            {
              ...episode,
              status: 'IN_PROGRESS',
              completedAt: null,
              presentationEvaluationId: null,
              meaningState: 'INCOMPLETE',
              meaning: null,
              evidence: [
                episode.evidence[0],
                {
                  instrument: 'GAD7',
                  state: 'MISSING',
                  assessmentId: null,
                  totalScore: null,
                  screeningLevel: null,
                  safetyStatus: null,
                },
              ],
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(
      await screen.findByRole('link', { name: 'Nếu bạn cần hỗ trợ ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(screen.getByText(/PHQ-9 đã ghi nhận một câu trả lời/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Làm tiếp bài còn thiếu/ }),
    ).toBeVisible()
  })

  it('uses the four-range visual while preserving the exact higher PHQ-9 level', async () => {
    const highSeverity = combinedMeaningFixture({
      priority: 'PROFESSIONAL_SUPPORT',
    })
    highSeverity.evidence[0] = {
      ...highSeverity.evidence[0],
      totalScore: 18,
      screeningLevel: 'MODERATELY_SEVERE',
    }
    highSeverity.evidence[1] = {
      ...highSeverity.evidence[1],
      totalScore: 16,
      screeningLevel: 'SEVERE',
    }

    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [completedScreeningEpisodeFixture(highSeverity)],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(await screen.findByText('Mức Khá nặng')).toBeVisible()
    expect(screen.getByText('Mức Nặng')).toBeVisible()

    const phqScale = screen.getByRole('meter', {
      name: 'PHQ-9: 18 trên 27 điểm, mức Khá nặng',
    })
    const gadScale = screen.getByRole('meter', {
      name: 'GAD-7: 16 trên 21 điểm, mức Nặng',
    })
    expect(phqScale.querySelectorAll('[data-active="true"]')).toHaveLength(4)
    expect(gadScale.querySelectorAll('[data-active="true"]')).toHaveLength(4)
  })

  it('loads an opaque older page and does not treat unloaded filtered history as empty', async () => {
    const initial = combinedMeaningFixture()
    const reassessment = combinedMeaningFixture({
      supportEvaluationId: '20000000-0000-4000-8000-000000000404',
      episodeId: '70000000-0000-4000-8000-000000000404',
      purpose: 'REASSESSMENT',
      priority: 'PROFESSIONAL_SUPPORT',
    })

    mockServer.use(
      http.get(
        'http://localhost/api/care/screening-episodes/history',
        ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor')
          if (!cursor) {
            return HttpResponse.json({
              items: [completedScreeningEpisodeFixture(initial)],
              nextCursor: 'older-page',
              hasMore: true,
            })
          }

          expect(cursor).toBe('older-page')
          return HttpResponse.json({
            items: [completedScreeningEpisodeFixture(reassessment)],
            nextCursor: null,
            hasMore: false,
          })
        },
      ),
    )

    render(<ScreeningEpisodeHistory />)

    await screen.findByRole('link', { name: /Xem kết quả/ })
    await userEvent.click(screen.getByRole('button', { name: 'Đánh giá lại' }))
    expect(
      screen.getByText('Chưa thấy lượt phù hợp trong các mục đã tải'),
    ).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', { name: 'Xem thêm các lượt trước' }),
    )
    expect(
      await screen.findByRole('link', { name: /Xem kết quả/ }),
    ).toHaveAttribute(
      'href',
      `/assessments/results/${reassessment.supportEvaluationId}`,
    )
    expect(
      screen.queryByText('Chưa thấy lượt phù hợp trong các mục đã tải'),
    ).not.toBeInTheDocument()
  })

  it('keeps loaded history after an append failure and deduplicates the retry page', async () => {
    const initial = combinedMeaningFixture()
    const reassessment = combinedMeaningFixture({
      supportEvaluationId: '20000000-0000-4000-8000-000000000606',
      episodeId: '70000000-0000-4000-8000-000000000606',
      purpose: 'REASSESSMENT',
      priority: 'PROFESSIONAL_SUPPORT',
    })
    let requestCount = 0

    mockServer.use(
      http.get(
        'http://localhost/api/care/screening-episodes/history',
        ({ request }) => {
          requestCount += 1
          const cursor = new URL(request.url).searchParams.get('cursor')

          if (!cursor) {
            return HttpResponse.json({
              items: [completedScreeningEpisodeFixture(initial)],
              nextCursor: 'older-page',
              hasMore: true,
            })
          }

          expect(cursor).toBe('older-page')
          if (requestCount === 2) {
            return HttpResponse.json(
              {
                type: 'about:blank',
                title: 'Service unavailable',
                status: 503,
                code: 'CARE_UNAVAILABLE',
                correlationId: 'mb-667-history-append-unavailable',
              },
              { status: 503 },
            )
          }

          return HttpResponse.json({
            items: [
              completedScreeningEpisodeFixture(initial),
              completedScreeningEpisodeFixture(reassessment),
            ],
            nextCursor: null,
            hasMore: false,
          })
        },
      ),
    )

    render(<ScreeningEpisodeHistory />)

    const initialLink = await screen.findByRole('link', { name: /Xem k/ })
    expect(initialLink).toHaveAttribute(
      'href',
      `/assessments/results/${initial.supportEvaluationId}`,
    )

    await userEvent.click(screen.getByRole('button', { name: /Xem th/ }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('link', { name: /Xem k/ })).toHaveAttribute(
      'href',
      `/assessments/results/${initial.supportEvaluationId}`,
    )

    await userEvent.click(screen.getByRole('button', { name: /Xem th/ }))

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Xem k/ })).toHaveLength(2)
    })
    const resultHrefs = screen
      .getAllByRole('link', { name: /Xem k/ })
      .map((link) => link.getAttribute('href'))
    expect(resultHrefs).toEqual([
      `/assessments/results/${initial.supportEvaluationId}`,
      `/assessments/results/${reassessment.supportEvaluationId}`,
    ])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('recovers from a dependency failure into the explicit empty state', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Service unavailable',
            status: 503,
            code: 'CARE_UNAVAILABLE',
            correlationId: 'mb-667-history-unavailable',
          },
          { status: 503 },
        ),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dịch vụ tạm thời chưa sẵn sàng',
    )

    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Chưa có lượt sàng lọc nào')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Bắt đầu kiểm tra ban đầu' }),
    ).toHaveAttribute('href', '/initial-check')
  })

  it('shows the exact incomplete pair, authoritative safety signal, and canonical resume route', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [
            {
              episodeId: '70000000-0000-4000-8000-000000000505',
              purpose: 'REASSESSMENT',
              status: 'IN_PROGRESS',
              startedAt: '2026-10-15T08:00:00Z',
              updatedAt: '2026-10-15T08:05:00Z',
              completedAt: null,
              presentationEvaluationId: null,
              meaningState: 'INCOMPLETE',
              evidence: [
                {
                  instrument: 'PHQ9',
                  state: 'AVAILABLE',
                  assessmentId: '10000000-0000-4000-8000-000000000505',
                  totalScore: 2,
                  screeningLevel: 'MINIMAL',
                  safetyStatus: 'POSITIVE_SAFETY_SCREEN',
                },
                {
                  instrument: 'GAD7',
                  state: 'MISSING',
                  assessmentId: null,
                  totalScore: null,
                  screeningLevel: null,
                  safetyStatus: null,
                },
              ],
              meaning: null,
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(await screen.findAllByText('Chưa hoàn tất')).toHaveLength(2)
    expect(screen.getByText('2')).toBeVisible()
    expect(screen.getByText('Chưa làm GAD-7')).toBeVisible()
    expect(screen.getByText('Có thông tin an toàn cần xem')).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Làm tiếp bài còn thiếu/ }),
    ).toHaveAttribute('href', '/initial-check?purpose=reassessment')
    expect(
      screen.queryByRole('link', { name: /Xem kết quả/ }),
    ).not.toBeInTheDocument()
  })

  it('describes a READY pair truthfully without claiming that either score is missing', async () => {
    const completed = completedScreeningEpisodeFixture()
    mockServer.use(
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({
          items: [
            {
              ...completed,
              status: 'READY',
              completedAt: null,
              presentationEvaluationId: null,
              meaningState: 'INCOMPLETE',
              meaning: null,
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<ScreeningEpisodeHistory />)

    expect(
      await screen.findByText('Hai bài đã được lưu cùng một lượt:'),
    ).toBeVisible()
    expect(screen.getByText('5')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Hoàn tất tổng hợp kết quả/ }),
    ).toHaveAttribute('href', '/initial-check')
    expect(
      screen.queryByText(/chưa đủ cả PHQ-9 và GAD-7/),
    ).not.toBeInTheDocument()
  })
})
