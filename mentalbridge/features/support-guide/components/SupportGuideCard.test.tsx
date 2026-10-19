import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
import type { SupportGuide } from '../api/support-guide-contract'
import SupportGuideCard from './SupportGuideCard'

function fixture(
  status: SupportGuide['resourceResolution']['status'],
): SupportGuide {
  return {
    supportGuideId: '10000000-0000-4000-8000-000000000511',
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '20000000-0000-4000-8000-000000000511',
    generatedAt: '2026-09-17T06:00:00Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Approved, non-diagnostic guidance.',
    },
    safety: {
      status: 'POSITIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_POSITIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'REVIEW_SAFETY_GUIDANCE',
      guidance: 'Safety guidance is available now.',
    },
    resourceResolution: {
      status,
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-09-17T06:00:00Z',
    },
    resources:
      status === 'AVAILABLE'
        ? [
            {
              resourceId: '30000000-0000-4000-8000-000000000511',
              contentVersion: '0',
              publicationId: '40000000-0000-4000-8000-000000000511',
              domain: 'DEPRESSIVE_SYMPTOMS',
              role: 'PRIMARY',
              category: 'ARTICLE',
              title: 'Reviewed resource',
              summary: 'Reviewed summary.',
              externalUrl: null,
            },
          ]
        : [],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [
        {
          assessmentId: '50000000-0000-4000-8000-000000000511',
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-v2',
          scoringVersion: 'phq9-standard-bands-v1',
          screeningLevel: 'MILD',
        },
        {
          assessmentId: '60000000-0000-4000-8000-000000000511',
          instrument: 'GAD7',
          questionnaireVersion: 'gad7-v1',
          scoringVersion: 'gad7-standard-bands-v1',
          screeningLevel: 'MINIMAL',
        },
      ],
    },
    phrasing: {
      source: 'CARE_APPROVED_STANDARD',
      status: 'AI_UNAVAILABLE_FALLBACK',
    },
  }
}

function negative(guide: SupportGuide): SupportGuide {
  return {
    ...guide,
    safety: {
      ...guide.safety,
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
    },
  }
}

describe('SupportGuideCard', () => {
  it('keeps authoritative safety first and the exact saved resource behind it', () => {
    const { container } = render(
      <SupportGuideCard guide={fixture('AVAILABLE')} />,
    )

    expect(screen.getByText('Safety guidance is available now.')).toBeVisible()
    expect(screen.getByText('Reviewed resource')).toBeInTheDocument()
    expect(
      container.querySelector('.support-guide-resources-deferred'),
    ).not.toHaveAttribute('open')
    expect(container.textContent).not.toMatch(
      /Nội dung chuẩn bị sẵn|mb-support-guide|content-eligibility/,
    )
    expect(
      screen.getByRole('link', { name: 'Mở lại hướng dẫn này' }),
    ).toHaveAttribute(
      'href',
      '/support-guides/10000000-0000-4000-8000-000000000511',
    )
    expect(
      screen.getByRole('link', { name: 'Xem hỗ trợ trong khu vực' }),
    ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
    expect(screen.getByRole('link', { name: 'Xem bài tập' })).toHaveAttribute(
      'href',
      '/resources/30000000-0000-4000-8000-000000000511?contentVersion=0&from=support-guide&supportGuideId=10000000-0000-4000-8000-000000000511',
    )
    expect(container.textContent).not.toMatch(
      /diagnosis|treatment|totalScore|answers/i,
    )
  })

  it.each(['EMPTY', 'STALE', 'UNAVAILABLE'] as const)(
    'renders a stable %s state while retaining safety guidance',
    (status) => {
      render(<SupportGuideCard guide={fixture(status)} />)
      expect(
        screen.getByText('Safety guidance is available now.'),
      ).toBeVisible()
      expect(screen.queryByText('Reviewed resource')).not.toBeInTheDocument()
    },
  )

  it('labels historical safety as past evidence without a fresh positive trigger', () => {
    render(<SupportGuideCard guide={fixture('AVAILABLE')} historical />)

    expect(
      screen.getByText(/Gợi ý này được lưu ngày 17\/09\/2026/),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'Lần sàng lọc này đã ưu tiên thông tin an toàn',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem hỗ trợ trong khu vực' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(
      screen.getByRole('link', { name: 'Quay lại lịch sử sàng lọc' }),
    ).toHaveAttribute('href', '/assessments')
    expect(
      screen.queryByRole('link', { name: 'Mở lại hướng dẫn này' }),
    ).not.toBeInTheDocument()
  })

  it('renders every saved resource of an older snapshot and no invented hotline', () => {
    const guide = negative(fixture('AVAILABLE'))
    const source = guide.resources[0]
    guide.resources = [
      source,
      { ...source, resourceId: 'resource-2', title: 'Resource two' },
      { ...source, resourceId: 'resource-3', title: 'Resource three' },
      { ...source, resourceId: 'resource-4', title: 'Resource four' },
    ]
    const { container } = render(<SupportGuideCard guide={guide} historical />)
    const resources = screen.getByRole('region', {
      name: 'Việc bạn có thể thử',
    })
    expect(
      within(resources).getAllByRole('link', { name: 'Xem bài tập' }),
    ).toHaveLength(4)
    expect(
      container.querySelectorAll('.support-guide-resources ol > li'),
    ).toHaveLength(4)
    expect(
      within(resources).getAllByRole('link', { name: 'Xem bài tập' })[1],
    ).toHaveAttribute(
      'href',
      '/resources/resource-2?contentVersion=0&from=support-guide&supportGuideId=10000000-0000-4000-8000-000000000511&guideHistory=1',
    )
    expect(container.querySelector('a[href^="tel:"]')).toBeNull()
    expect(container.textContent).not.toMatch(/1900|24\/7|đã tự động kết nối/i)
  })

  it('does not infer a professional pathway from saved levels without Care authority', () => {
    const guide = negative(fixture('AVAILABLE'))
    guide.provenance.assessmentResults[0].screeningLevel = 'SEVERE'
    render(<SupportGuideCard guide={guide} historical />)

    expect(
      screen.getByRole('heading', {
        name: 'Gợi ý hỗ trợ đã lưu cho lần sàng lọc này',
      }),
    ).toBeVisible()
    expect(screen.queryByText(/3 bước tự hỗ trợ/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Tìm chuyên gia phù hợp/ }),
    ).not.toBeInTheDocument()
  })

  it('leads a professional Guide with the saved Care meaning and specialist discovery', () => {
    const guide = negative(fixture('AVAILABLE'))
    guide.provenance.assessmentResults[0].screeningLevel = 'MODERATE'
    const meaning = combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' })
    const { container } = render(
      <SupportGuideCard
        guide={guide}
        historical
        meaning={meaning}
        resultEvaluationId="presentation-evaluation"
        scorePair={{
          phq9: { totalScore: 12, screeningLevel: 'MODERATE' },
          gad7: { totalScore: 3, screeningLevel: 'MINIMAL' },
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: meaning.baseMeaning.text }),
    ).toBeVisible()
    expect(screen.getByText(meaning.baseMeaning.rationale)).toBeVisible()
    expect(screen.getByText('12/27')).toBeVisible()
    expect(screen.getByText('3/21')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Tìm chuyên gia phù hợp' }),
    ).toHaveAttribute('href', '/specialists')
    expect(screen.getByText(/Chưa có lịch hẹn nào được đặt/)).toBeVisible()
    expect(
      screen.getByRole('region', {
        name: 'Trong lúc chờ trao đổi với chuyên gia',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem bài tập' })).toHaveAttribute(
      'href',
      '/resources/30000000-0000-4000-8000-000000000511?contentVersion=0&from=support-guide&supportGuideId=10000000-0000-4000-8000-000000000511&guideHistory=1&resultEvaluationId=presentation-evaluation',
    )
    expect(
      screen.getByText('Approved, non-diagnostic guidance.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Quay lại Kết quả trước đây' }),
    ).toHaveAttribute('href', '/assessments/results/presentation-evaluation')
    expect(container.querySelector('.support-guide-safety-priority')).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'Xem hỗ trợ an toàn' }),
    ).not.toBeInTheDocument()
  })

  it('keeps missing numeric evidence as missing rather than treating it as zero', () => {
    render(<SupportGuideCard guide={fixture('AVAILABLE')} />)
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText('0/27')).not.toBeInTheDocument()
    expect(screen.queryByText('0/21')).not.toBeInTheDocument()
  })

  it('renders only the Care-decided continuation as the primary action', () => {
    const guide = {
      ...fixture('AVAILABLE'),
      safety: {
        ...fixture('AVAILABLE').safety,
        status: 'NEGATIVE_SAFETY_SCREEN' as const,
        reasonCode: 'PHQ9_ITEM9_NEGATIVE' as const,
      },
    }
    const { container } = render(
      <SupportGuideCard
        guide={guide}
        continuation={{
          href: '/support-plan',
          label: 'Tiếp tục kế hoạch hiện tại',
        }}
      />,
    )

    expect(
      screen.getByRole('link', { name: /Tiếp tục kế hoạch hiện tại/ }),
    ).toHaveAttribute('href', '/support-plan')
    expect(container.querySelectorAll('.support-guide-primary')).toHaveLength(1)
    expect(
      screen.queryByRole('link', { name: /Khám phá bài tập phù hợp/ }),
    ).not.toBeInTheDocument()
  })

  it('uses the Care professional decision for copy instead of guessing from levels', () => {
    const guide = {
      ...fixture('AVAILABLE'),
      safety: {
        ...fixture('AVAILABLE').safety,
        status: 'NEGATIVE_SAFETY_SCREEN' as const,
        reasonCode: 'PHQ9_ITEM9_NEGATIVE' as const,
      },
    }
    render(
      <SupportGuideCard
        guide={guide}
        continuation={{
          href: '/specialists?from=support-guide&supportGuideId=x',
          label: 'Tìm chuyên gia phù hợp',
          professional: true,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Bạn nên trao đổi với chuyên gia tâm lý',
      }),
    ).toBeVisible()
    expect(screen.getAllByRole('link', { name: /chuyên gia/i })).toHaveLength(1)
    expect(
      screen.queryByText(/Miễn phí cho mọi tài khoản/),
    ).not.toBeInTheDocument()
  })

  it('keeps a self-guided Guide free of sales copy and offers specialists as an optional link', () => {
    render(
      <SupportGuideCard
        guide={negative(fixture('PARTIAL'))}
        meaning={combinedMeaningFixture()}
        continuation={{
          href: '#support-guide-resources',
          label: 'Khám phá bài tập phù hợp',
        }}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: /Tìm chuyên gia$/ })).toBeVisible()
    expect(screen.queryByText(/Miễn phí|gói|nâng cấp/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Xem thư viện tài nguyên chung' }),
    ).toHaveAttribute('href', '/resources')
  })

  it('keeps safety guidance as the only primary step when Care routes to safety', () => {
    const { container } = render(
      <SupportGuideCard guide={fixture('AVAILABLE')} continuation={null} />,
    )

    expect(container.querySelectorAll('.support-guide-primary')).toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Xem hỗ trợ trong khu vực' }),
    ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
  })

  it('uses a page heading and omits the self-link on a direct saved Guide page', () => {
    render(
      <SupportGuideCard
        guide={fixture('EMPTY')}
        headingLevel="h1"
        showOpenLink={false}
      />,
    )
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Ưu tiên hàng đầu là kết nối hỗ trợ an toàn ngay',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Mở lại hướng dẫn này' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Gợi ý này không có bài tập nào được lưu kèm.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /thư viện tài nguyên/ }),
    ).not.toBeInTheDocument()
  })
})
