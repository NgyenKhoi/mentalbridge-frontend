import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
              privacyPolicyVersion: 'privacy-capstone-v2',
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
      http.get(
        `http://localhost/api/care/assessments/by-id/${assessmentId}/progress`,
        () =>
          HttpResponse.json({
            instrument: 'PHQ9',
            scoringVersion: 'phq9-standard-bands-v1',
            previous: {
              assessmentId: '10000000-0000-4000-8000-000000000002',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-08-30T00:00:00Z',
              totalScore: 2,
              screeningLevel: 'MINIMAL',
            },
            current: {
              assessmentId,
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-09-02T00:00:00Z',
              totalScore: 8,
              screeningLevel: 'MILD',
            },
            rawDelta: 6,
            scoreDirection: 'INCREASED',
            bandTransition: { previous: 'MINIMAL', current: 'MILD' },
            elapsedDuration: 'PT72H',
          }),
      ),
    )
    render(<AssessmentsPage />)
    expect(await screen.findByText('8 điểm')).toBeVisible()
    expect(screen.getAllByRole('link', { name: /bắt đầu/i })).toHaveLength(2)
    expect(screen.getByText('Nhẹ')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem lại' })).toHaveAttribute(
      'href',
      `/assessment/phq9?assessmentId=${assessmentId}`,
    )
    const compareButton = screen.getByRole('button', { name: 'So sánh' })
    await userEvent.click(compareButton)
    expect(await screen.findByText('Điểm đã tăng 6 điểm.')).toBeVisible()
    expect(screen.getByText('3 ngày')).toBeVisible()
    expect(
      screen.queryByText(/hồi phục|cải thiện|xấu đi/i),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Đóng so sánh' }))
    expect(compareButton).toHaveFocus()
    expect(
      screen.queryByRole('heading', { name: 'Tiến trình assessment đã chọn' }),
    ).not.toBeInTheDocument()
  })
})
