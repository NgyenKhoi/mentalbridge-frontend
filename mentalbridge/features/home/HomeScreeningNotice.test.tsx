import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCombinedScreeningMeaning } from '@/features/assessment/api/browser-care'
import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
import { homeJourneyFixture } from './testing/home-next-step-fixture'
import { HomeScreeningNotice } from './HomeScreeningNotice'

vi.mock('@/features/assessment/api/browser-care', () => ({
  getCombinedScreeningMeaning: vi.fn(),
}))

const meaning = combinedMeaningFixture()
const journey = homeJourneyFixture({
  episodeId: meaning.episodeId,
  episodeCompletedAt: meaning.episodeCompletedAt,
  presentationEvaluationId: meaning.supportEvaluationId,
})

describe('HomeScreeningNotice', () => {
  beforeEach(() => vi.mocked(getCombinedScreeningMeaning).mockReset())

  it.each([
    ['PHQ9', 19, 'MODERATELY_SEVERE', false],
    ['PHQ9', 20, 'SEVERE', true],
    ['GAD7', 14, 'MODERATE', false],
    ['GAD7', 15, 'SEVERE', true],
  ] as const)(
    'shows the notice only at the agreed %s threshold (%s)',
    async (instrument, score, level, visible) => {
      vi.mocked(getCombinedScreeningMeaning).mockResolvedValue({
        ...meaning,
        evidence: meaning.evidence.map((item) =>
          item.instrument === instrument
            ? { ...item, totalScore: score, screeningLevel: level }
            : item,
        ),
      })
      const view = render(<HomeScreeningNotice journey={journey} />)
      if (visible) {
        expect(
          await screen.findByRole('heading', {
            name: 'Nên tìm hỗ trợ chuyên môn',
          }),
        ).toBeVisible()
        expect(
          screen.getByRole('link', { name: 'Xem chuyên gia' }),
        ).toHaveAttribute('href', '/specialists')
        expect(
          screen.getByRole('link', { name: 'Xem kết quả' }),
        ).toHaveAttribute(
          'href',
          `/assessments/results/${meaning.supportEvaluationId}`,
        )
        expect(view.container.querySelector('a[href^="tel:"]')).toBeNull()
      } else {
        await waitFor(() => expect(view.container).toBeEmptyDOMElement())
      }
    },
  )

  it('does not read or display a warning before an episode is completed', () => {
    const { container } = render(
      <HomeScreeningNotice
        journey={{ ...journey, episodeCompletedAt: null }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(getCombinedScreeningMeaning).not.toHaveBeenCalled()
  })

  it('does not turn a positive safety answer at a low score into the high-score warning', async () => {
    vi.mocked(getCombinedScreeningMeaning).mockResolvedValue(
      combinedMeaningFixture({ priority: 'SAFETY' }),
    )
    const { container } = render(<HomeScreeningNotice journey={journey} />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('rejects evidence from another episode and offers a local retry', async () => {
    vi.mocked(getCombinedScreeningMeaning)
      .mockResolvedValueOnce({
        ...meaning,
        episodeId: '70000000-0000-4000-8000-000000000999',
      })
      .mockResolvedValueOnce(meaning)
    const { container } = render(<HomeScreeningNotice journey={journey} />)
    await screen.findByText('Chưa tải được mức độ từ lần kiểm tra đã lưu.')
    expect(screen.queryByRole('heading')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(getCombinedScreeningMeaning).toHaveBeenCalledTimes(2)
  })
})
