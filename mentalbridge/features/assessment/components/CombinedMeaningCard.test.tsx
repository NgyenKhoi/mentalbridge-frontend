import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isMamFeatureHiding } from '@/features/mam/mam-suppression'
import { ensureCurrentSupportGuide } from '@/features/support-guide/api/browser-support-guide'
import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
import { CombinedMeaningCard } from './CombinedMeaningCard'

vi.mock('@/features/support-guide/api/browser-support-guide', () => ({
  ensureCurrentSupportGuide: vi.fn(),
}))

describe('CombinedMeaningCard', () => {
  beforeEach(() => vi.mocked(ensureCurrentSupportGuide).mockReset())

  it('uses one shared composition with both exact scores and no summary-download action', () => {
    render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({
          supportGuideId: '90000000-0000-4000-8000-000000000101',
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Dấu hiệu trầm cảm' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Dấu hiệu lo âu' }),
    ).toBeVisible()
    // The plain meaning leads; instrument names and raw scores sit in the details.
    expect(screen.getAllByRole('heading')[0]).toHaveTextContent(
      'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    )
    expect(screen.getByText('5/27 điểm · Nhẹ')).toBeInTheDocument()
    expect(screen.getByText('4/21 điểm · Tối thiểu')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Tiếp tục xem gợi ý hỗ trợ/ }),
    ).toHaveAttribute(
      'href',
      '/support-guides/90000000-0000-4000-8000-000000000101',
    )
    expect(
      screen.queryByRole('button', { name: /Lưu bản tóm tắt/ }),
    ).not.toBeInTheDocument()
  })

  it.each(['SELF_GUIDED', 'PROFESSIONAL_SUPPORT', 'SAFETY'] as const)(
    'continues a current %s initial check to the Guide Care prepares for this exact episode',
    (priority) => {
      render(
        <CombinedMeaningCard meaning={combinedMeaningFixture({ priority })} />,
      )

      expect(
        screen.getByRole('link', { name: /Tiếp tục xem gợi ý hỗ trợ/ }),
      ).toHaveAttribute('href', '/support-guides')
      expect(
        screen.queryByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).not.toBeInTheDocument()
    },
  )

  it.each(['SELF_GUIDED', 'PROFESSIONAL_SUPPORT', 'SAFETY'] as const)(
    'never substitutes the initial-check Guide for a current %s reassessment without a saved Guide',
    (priority) => {
      render(
        <CombinedMeaningCard
          meaning={combinedMeaningFixture({
            priority,
            purpose: 'REASSESSMENT',
          })}
        />,
      )

      expect(
        screen.getByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
      expect(
        screen
          .getAllByRole('link')
          .some((link) =>
            link.getAttribute('href')?.startsWith('/support-guides'),
          ),
      ).toBe(false)
    },
  )

  it('hides Mầm while a SAFETY result is on screen, and only then', () => {
    const safe = render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })}
      />,
    )
    expect(isMamFeatureHiding()).toBe(false)
    safe.unmount()

    const safety = render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ priority: 'SAFETY' })}
      />,
    )
    expect(isMamFeatureHiding()).toBe(true)
    safety.unmount()
    expect(isMamFeatureHiding()).toBe(false)
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
      screen.getByRole('link', { name: /Tiếp tục xem gợi ý hỗ trợ/ }),
    ).toHaveClass('combined-meaning-secondary')
    expect(
      screen.queryByText(/Nếu bạn không yên tâm về tình trạng của mình/),
    ).not.toBeInTheDocument()
  })

  it('continues a current professional result to the Guide before specialist discovery', () => {
    render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })}
      />,
    )

    expect(
      screen.getByRole('link', { name: /Tiếp tục xem gợi ý hỗ trợ/ }),
    ).toHaveClass('combined-meaning-primary')
    expect(screen.getByRole('link', { name: /Xem chuyên gia/ })).toHaveClass(
      'combined-meaning-secondary',
    )
  })

  it('keeps an exact saved Guide reachable after historical safety guidance', () => {
    const meaning = combinedMeaningFixture({
      priority: 'SAFETY',
      supportGuideId: '90000000-0000-4000-8000-000000000101',
    })
    render(<CombinedMeaningCard meaning={meaning} historical />)

    expect(
      screen.getByRole('link', { name: 'Nếu bạn cần hỗ trợ ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(
      screen.getByRole('heading', {
        name: 'Thông tin an toàn của lần sàng lọc này',
      }),
    ).toBeVisible()
    expect(
      screen.queryByText('Ưu tiên an toàn ngay lúc này'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/không khẳng định tình trạng hiện tại/),
    ).toBeVisible()
    expect(screen.getByText(meaning.safetyGuidance!)).toBeVisible()
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
      screen.getByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Xem tài nguyên hiện tại/ }),
    ).toHaveAttribute('href', '/resources')
    expect(
      screen.queryByRole('link', { name: /Xem gợi ý đã lưu/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps the unhurried professional heading for a moderate highest band', () => {
    render(
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Trao đổi với chuyên gia khi bạn sẵn sàng',
      }),
    ).toBeVisible()
  })

  it('renders a severe band as professional support without inferring a safety override', () => {
    const meaning = combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })
    meaning.evidence[0].totalScore = 24
    meaning.evidence[0].screeningLevel = 'SEVERE'
    meaning.baseMeaning.code = 'PHQ9_SEVERE_GAD7_MINIMAL'

    render(<CombinedMeaningCard meaning={meaning} />)

    expect(screen.getByText('24/27 điểm · Nặng')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Nên sớm trao đổi với chuyên gia',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: /hướng dẫn an toàn/i }),
    ).not.toBeInTheDocument()
  })

  describe('latest screening without a saved Guide', () => {
    const latest = () => (
      <CombinedMeaningCard
        meaning={combinedMeaningFixture({ purpose: 'REASSESSMENT' })}
        historical
        ensureLatestGuide
      />
    )

    it('prepares the Guide once, shows a busy status, then links the new Guide', async () => {
      let resolve!: (guide: { supportGuideId: string }) => void
      vi.mocked(ensureCurrentSupportGuide).mockReturnValue(
        new Promise((r) => (resolve = r)) as never,
      )
      render(latest())

      const status = screen.getByRole('status')
      expect(status).not.toHaveAttribute('aria-busy')
      expect(status).toHaveTextContent(
        'Đang chuẩn bị gợi ý từ lần sàng lọc này…',
      )
      expect(
        screen.queryByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).not.toBeInTheDocument()

      resolve({ supportGuideId: '90000000-0000-4000-8000-000000000202' })

      expect(
        await screen.findByRole('link', { name: /Xem gợi ý đã lưu/ }),
      ).toHaveAttribute(
        'href',
        '/support-guides/90000000-0000-4000-8000-000000000202?from=screening-history&resultEvaluationId=20000000-0000-4000-8000-000000000101',
      )
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(ensureCurrentSupportGuide).toHaveBeenCalledTimes(1)
    })

    it('keeps the banner and offers a retry when preparing fails', async () => {
      vi.mocked(ensureCurrentSupportGuide)
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce({
          supportGuideId: '90000000-0000-4000-8000-000000000202',
        } as never)
      render(latest())

      expect(
        await screen.findByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Tạo gợi ý' }))

      expect(
        await screen.findByRole('link', { name: /Xem gợi ý đã lưu/ }),
      ).toBeVisible()
      expect(ensureCurrentSupportGuide).toHaveBeenCalledTimes(2)
    })

    it('moves focus to the status on retry, then to the new Guide link', async () => {
      let resolve!: (guide: { supportGuideId: string }) => void
      vi.mocked(ensureCurrentSupportGuide)
        .mockRejectedValueOnce(new Error('down'))
        .mockReturnValueOnce(new Promise((r) => (resolve = r)) as never)
      render(latest())

      const retry = await screen.findByRole('button', { name: 'Tạo gợi ý' })
      retry.focus()
      fireEvent.click(retry)

      expect(await screen.findByRole('status')).toHaveFocus()
      resolve({ supportGuideId: '90000000-0000-4000-8000-000000000202' })
      expect(
        await screen.findByRole('link', { name: /Xem gợi ý đã lưu/ }),
      ).toHaveFocus()
    })

    it('does not steal focus when the user moved outside the card', async () => {
      let resolve!: (guide: { supportGuideId: string }) => void
      vi.mocked(ensureCurrentSupportGuide)
        .mockRejectedValueOnce(new Error('down'))
        .mockReturnValueOnce(new Promise((r) => (resolve = r)) as never)
      render(
        <>
          <button type="button">outside</button>
          {latest()}
        </>,
      )

      fireEvent.click(await screen.findByRole('button', { name: 'Tạo gợi ý' }))
      await screen.findByRole('status')
      const outside = screen.getByRole('button', { name: 'outside' })
      outside.focus()
      resolve({ supportGuideId: '90000000-0000-4000-8000-000000000202' })

      await screen.findByRole('link', { name: /Xem gợi ý đã lưu/ })
      expect(outside).toHaveFocus()
    })

    it('does nothing when the Guide is already saved', () => {
      render(
        <CombinedMeaningCard
          meaning={combinedMeaningFixture({
            purpose: 'REASSESSMENT',
            supportGuideId: '90000000-0000-4000-8000-000000000101',
          })}
          historical
          ensureLatestGuide
        />,
      )

      expect(ensureCurrentSupportGuide).not.toHaveBeenCalled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('leaves an older episode with the banner and no request', () => {
      render(
        <CombinedMeaningCard
          meaning={combinedMeaningFixture({ purpose: 'REASSESSMENT' })}
          historical
        />,
      )

      expect(ensureCurrentSupportGuide).not.toHaveBeenCalled()
      expect(
        screen.getByText('Lần sàng lọc này chưa có gợi ý đã lưu.'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Tạo gợi ý' }),
      ).not.toBeInTheDocument()
    })
  })
})
