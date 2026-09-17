import { render, screen } from '@testing-library/react'
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
  it('keeps safety, one-time scope, exact resource provenance, and AI fallback visible', () => {
    const { container } = render(
      <SupportGuideCard guide={fixture('AVAILABLE')} />,
    )

    expect(screen.getByText('Safety guidance is available now.')).toBeVisible()
    expect(screen.getByText('Reviewed resource')).toBeVisible()
    expect(screen.getByText(/SupportPlan/)).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/AI/)
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/support-guides/10000000-0000-4000-8000-000000000511',
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
})
