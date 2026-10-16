import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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

describe('SupportGuideCard', () => {
  it('keeps authoritative safety, exact resource provenance, and fallback visible', () => {
    const { container } = render(
      <SupportGuideCard guide={fixture('AVAILABLE')} />,
    )

    expect(screen.getByText('Safety guidance is available now.')).toBeVisible()
    expect(screen.getByText('Reviewed resource')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nội dung chuẩn bị sẵn',
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
      '/resources/30000000-0000-4000-8000-000000000511?contentVersion=0',
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

  it('labels an exact historical Guide as read-only and returns to screening history', () => {
    render(<SupportGuideCard guide={fixture('AVAILABLE')} historical />)

    expect(screen.getByText('Bản ghi lịch sử · Chỉ đọc')).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'Gợi ý đã lưu: thông tin an toàn được ưu tiên trước',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Quay lại lịch sử sàng lọc' }),
    ).toHaveAttribute('href', '/assessments')
    expect(
      screen.queryByRole('link', { name: 'Mở lại hướng dẫn này' }),
    ).not.toBeInTheDocument()
  })

  it('renders every actual resource and no invented hotline or counter', () => {
    const guide = fixture('AVAILABLE')
    const source = guide.resources[0]
    guide.resources = [
      source,
      { ...source, resourceId: 'resource-2', title: 'Resource two' },
      { ...source, resourceId: 'resource-3', title: 'Resource three' },
    ]
    const { container } = render(<SupportGuideCard guide={guide} />)
    const resources = screen.getByRole('region', {
      name: 'Bài tập bạn có thể thử',
    })
    expect(
      within(resources).getAllByRole('link', { name: 'Xem bài tập' }),
    ).toHaveLength(3)
    expect(
      container.querySelectorAll('.support-guide-resources > ol > li'),
    ).toHaveLength(3)
    expect(container.querySelector('a[href^="tel:"]')).toBeNull()
    expect(
      container.querySelectorAll(
        'a[href="/safety-directory?trigger=positive-item-9"]',
      ),
    ).toHaveLength(1)
    expect(container.textContent).not.toMatch(/1900|24\/7|đã tự động kết nối/i)
  })

  it('shows saved exact scores and professional action without inventing a safety signal', () => {
    const guide = fixture('AVAILABLE')
    guide.safety = {
      ...guide.safety,
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
    }
    guide.provenance.assessmentResults[0].screeningLevel = 'MODERATE'
    const { container } = render(
      <SupportGuideCard
        guide={guide}
        historical
        resultEvaluationId="presentation-evaluation"
        scorePair={{
          phq9: { totalScore: 12, screeningLevel: 'MODERATE' },
          gad7: { totalScore: 3, screeningLevel: 'MINIMAL' },
        }}
      />,
    )
    expect(screen.getByText('12/27')).toBeVisible()
    expect(screen.getByText('3/21')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Tìm chuyên gia phù hợp' }),
    ).toHaveAttribute('href', '/specialists')
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
      screen.getAllByText(
        'Lần đánh giá này không có tài nguyên đã lưu kèm theo.',
      ).length,
    ).toBeGreaterThan(0)
  })
})
