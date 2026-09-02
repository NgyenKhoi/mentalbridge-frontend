import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import AssessmentsPage from './page'

describe('Assessment history page', () => {
  it('renders owned backend summaries and a link that reopens the exact result', async () => {
    const assessmentId = '10000000-0000-4000-8000-000000000003'
    mockServer.use(
      http.get('http://localhost/api/care/assessments/history', () =>
        HttpResponse.json({
          items: [
            {
              assessmentId,
              questionnaireDefinitionId: '10000000-0000-4000-8000-000000000001',
              instrument: 'PHQ9',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              privacyPolicyVersion: 'privacy-capstone-v1',
              submittedAt: '2026-09-02T00:00:00Z',
              result: {
                totalScore: 8,
                screeningLevel: 'MILD',
                scoringVersion: 'phq9-standard-bands-v1',
                safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
                safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
                disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
              },
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )
    render(<AssessmentsPage />)
    expect(await screen.findByText('8/27')).toBeVisible()
    expect(screen.getByText('Nhẹ')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem lại' })).toHaveAttribute(
      'href',
      `/assessment/phq9?assessmentId=${assessmentId}`,
    )
  })
})
