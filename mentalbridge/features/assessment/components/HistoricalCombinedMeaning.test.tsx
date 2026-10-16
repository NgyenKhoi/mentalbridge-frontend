import { render, screen } from '@testing-library/react'
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
})
