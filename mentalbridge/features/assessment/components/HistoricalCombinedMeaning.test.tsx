import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
import { HistoricalCombinedMeaning } from './HistoricalCombinedMeaning'

const evaluationId = '20000000-0000-4000-8000-000000000101'

describe('HistoricalCombinedMeaning', () => {
  it('opens the exact saved pair and keeps the return path to history', async () => {
    mockServer.use(
      http.get(
        `http://localhost/api/care/support-evaluations/${evaluationId}/combined-meaning`,
        () => HttpResponse.json(combinedMeaningFixture()),
      ),
    )

    render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

    expect(
      await screen.findByRole('heading', {
        name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Quay lại lịch sử sàng lọc/ }),
    ).toHaveAttribute('href', '/assessments')
  })

  it('does not substitute another result when the saved pair is unavailable', async () => {
    mockServer.use(
      http.get(
        `http://localhost/api/care/support-evaluations/${evaluationId}/combined-meaning`,
        () =>
          HttpResponse.json(
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
          ),
      ),
    )

    render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

    expect(
      await screen.findByRole('heading', { name: 'Chưa thể mở kết quả này' }),
    ).toBeVisible()
    expect(screen.getByText(/không ghép kết quả/i)).toBeVisible()
  })

  describe('Guide for the latest screening', () => {
    const episodeId = '70000000-0000-4000-8000-000000000101'
    const guideId = '90000000-0000-4000-8000-000000000303'
    const reassessment = () =>
      combinedMeaningFixture({ purpose: 'REASSESSMENT', episodeId })
    const useMeaning = () =>
      mockServer.use(
        http.get(
          `http://localhost/api/care/support-evaluations/${evaluationId}/combined-meaning`,
          () => HttpResponse.json(reassessment()),
        ),
      )
    const useJourney = (latestEpisodeId: string | null) =>
      mockServer.use(
        http.get('http://localhost/api/care/guided-journey', () =>
          HttpResponse.json({
            stage: 'ASSESSMENT_REQUIRED',
            episodeId: null,
            latestScreening: latestEpisodeId
              ? { episodeId: latestEpisodeId, purpose: 'REASSESSMENT' }
              : null,
          }),
        ),
      )

    it('prepares and links the Guide when this is the latest completed episode', async () => {
      useMeaning()
      useJourney(episodeId)
      mockServer.use(
        http.post('http://localhost/api/care/support-guides', () =>
          HttpResponse.json({ supportGuideId: guideId }),
        ),
      )

      render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

      expect(
        await screen.findByRole('link', { name: /Xem gợi ý đã lưu/ }),
      ).toHaveAttribute(
        'href',
        expect.stringContaining(`/support-guides/${guideId}`),
      )
    })

    it('keeps the banner and creates nothing for an older episode', async () => {
      useMeaning()
      useJourney('70000000-0000-4000-8000-000000000999')
      let created = false
      mockServer.use(
        http.post('http://localhost/api/care/support-guides', () => {
          created = true
          return HttpResponse.json({ supportGuideId: guideId })
        }),
      )

      render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

      expect(
        await screen.findByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
      expect(created).toBe(false)
    })

    it('asks for the journey while the meaning is still loading', async () => {
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      let journeyAsked = false
      mockServer.use(
        http.get('http://localhost/api/care/guided-journey', () => {
          journeyAsked = true
          return HttpResponse.json({
            stage: 'ASSESSMENT_REQUIRED',
            episodeId: null,
            latestScreening: null,
          })
        }),
        http.get(
          `http://localhost/api/care/support-evaluations/${evaluationId}/combined-meaning`,
          async () => {
            await gate
            return HttpResponse.json(reassessment())
          },
        ),
      )

      render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

      await waitFor(() => expect(journeyAsked).toBe(true))
      release()
      expect(
        await screen.findByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
    })

    it('keeps the banner when the latest screening cannot be checked', async () => {
      useMeaning()
      mockServer.use(
        http.get('http://localhost/api/care/guided-journey', () =>
          HttpResponse.error(),
        ),
      )

      render(<HistoricalCombinedMeaning supportEvaluationId={evaluationId} />)

      expect(
        await screen.findByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
    })
  })
})
