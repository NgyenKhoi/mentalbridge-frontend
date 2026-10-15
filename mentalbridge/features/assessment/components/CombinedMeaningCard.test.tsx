import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
import { CombinedMeaningCard } from './CombinedMeaningCard'

describe('CombinedMeaningCard', () => {
  it('uses one shared composition with both exact scores and no summary-download action', () => {
    render(<CombinedMeaningCard meaning={combinedMeaningFixture()} />)

    expect(screen.getByRole('heading', { name: 'PHQ-9' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'GAD-7' })).toBeVisible()
    expect(screen.getByText('5')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Xem gợi ý hỗ trợ/ }),
    ).toHaveAttribute('href', '/support-guides')
    expect(
      screen.queryByRole('button', { name: /Lưu bản tóm tắt/ }),
    ).not.toBeInTheDocument()
  })

  it('gives backend safety priority precedence over the ordinary CTA', () => {
    render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ priority: 'SAFETY' })}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Xem hỗ trợ trong khu vực/ }),
    ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
    expect(
      screen.queryByText(/Nếu bạn không yên tâm về tình trạng của mình/),
    ).not.toBeInTheDocument()
  })

  it('keeps an exact saved Guide reachable after historical safety guidance', () => {
    render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({
          priority: 'SAFETY',
          supportGuideId: '90000000-0000-4000-8000-000000000101',
        })}
        historical
      />,
    )

    expect(
      screen.getByRole('link', { name: /Xem hỗ trợ trong khu vực/ }),
    ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
    expect(
      screen.getByRole('link', { name: /Xem gợi ý an toàn đã lưu/ }),
    ).toHaveAttribute(
      'href',
      '/support-guides/90000000-0000-4000-8000-000000000101?from=screening-history&resultEvaluationId=20000000-0000-4000-8000-000000000101',
    )
  })

  it('links a historical result only to the Guide saved for that exact episode', () => {
    const meaning = combinedMeaningFixture({
      purpose: 'REASSESSMENT',
      supportGuideId: '90000000-0000-4000-8000-000000000101',
    })
    render(<CombinedMeaningCard meaning={meaning} historical />)

    expect(screen.getByText('Đánh giá lại')).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Xem gợi ý đã lưu/ }),
    ).toHaveAttribute(
      'href',
      '/support-guides/90000000-0000-4000-8000-000000000101?from=screening-history&resultEvaluationId=20000000-0000-4000-8000-000000000101',
    )
    expect(
      screen.getAllByRole('link', {
        name: /Xem gợi ý (đã lưu|của lần này)/,
      }),
    ).toHaveLength(1)
  })

  it('labels current support when a historical result has no saved Guide', () => {
    render(
      <CombinedMeaningCard meaning={combinedMeaningFixture()} historical />,
    )

    expect(
      screen.getByText('Lần đánh giá này chưa có gợi ý đã lưu.'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Xem tài nguyên hiện tại/ }),
    ).toHaveAttribute('href', '/resources')
    expect(
      screen.queryByRole('link', { name: /Xem gợi ý đã lưu/ }),
    ).not.toBeInTheDocument()
  })

  it('renders a severe band as professional support without inferring a safety override', () => {
    const meaning = combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })
    meaning.evidence[0].totalScore = 24
    meaning.evidence[0].screeningLevel = 'SEVERE'
    meaning.baseMeaning.code = 'PHQ9_SEVERE_GAD7_MINIMAL'

    render(<CombinedMeaningCard meaning={meaning} />)

    expect(
      screen.getByRole('progressbar', {
        name: 'PHQ-9: 24 trên 27 điểm, mức Nặng',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Trao đổi với chuyên gia khi bạn sẵn sàng',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: /hướng dẫn an toàn/i }),
    ).not.toBeInTheDocument()
  })
})
