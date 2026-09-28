import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAssessmentHistory } from '@/features/assessment/api/browser-care'

import LatestPhq9Result from './LatestPhq9Result'

vi.mock('@/features/assessment/api/browser-care', () => ({
  getAssessmentHistory: vi.fn(),
}))

const mockedHistory = vi.mocked(getAssessmentHistory)

describe('LatestPhq9Result', () => {
  beforeEach(() => {
    mockedHistory.mockReset()
  })

  it('shows the latest PHQ-9 result from owned assessment history', async () => {
    mockedHistory.mockResolvedValue({
      items: [
        {
          assessmentId: '10000000-0000-4000-8000-000000000001',
          questionnaireDefinitionId: '10000000-0000-4000-8000-000000000002',
          instrument: 'GAD7',
          questionnaireVersion: 'gad7-v1',
          privacyPolicyVersion: 'privacy-v1',
          submittedAt: '2026-09-28T01:00:00Z',
          result: {
            totalScore: 4,
            screeningLevel: 'MILD',
            scoringVersion: 'gad7-v1',
            safetyStatus: 'NOT_APPLICABLE',
            safetyPolicyVersion: null,
            disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
          },
        },
        {
          assessmentId: '20000000-0000-4000-8000-000000000001',
          questionnaireDefinitionId: '20000000-0000-4000-8000-000000000002',
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-v2',
          privacyPolicyVersion: 'privacy-v1',
          submittedAt: '2026-09-27T01:00:00Z',
          result: {
            totalScore: 8,
            screeningLevel: 'MILD',
            scoringVersion: 'phq9-v1',
            safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
            safetyPolicyVersion: 'phq9-item9-v1',
            disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
          },
        },
      ],
      hasMore: false,
    })

    render(<LatestPhq9Result />)

    expect(await screen.findByText('8')).toBeVisible()
    expect(screen.getByText('Mức sàng lọc:')).toHaveTextContent('Nhẹ')
    expect(
      screen.getByRole('link', { name: 'Xem các lần sàng lọc' }),
    ).toHaveAttribute('href', '/assessments')
  })

  it('keeps the PHQ-9 action when no PHQ-9 result exists', async () => {
    mockedHistory.mockResolvedValue({ items: [], hasMore: false })

    render(<LatestPhq9Result />)

    expect(
      await screen.findByText('Chưa có kết quả PHQ-9 nào được hiển thị.'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Làm PHQ-9 để nhận kết quả' }),
    ).toHaveAttribute('href', '/assessment/phq9')
  })

  it('shows a safe recovery path when history cannot be loaded', async () => {
    mockedHistory.mockRejectedValue(new Error('unavailable'))

    render(<LatestPhq9Result />)

    expect(
      await screen.findByText(
        'Chưa thể tải kết quả lúc này. Kết quả bạn đã lưu vẫn được giữ nguyên.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Mở Bài sàng lọc' }),
    ).toHaveAttribute('href', '/assessments')
  })
})
