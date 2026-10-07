import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AssessmentSummary } from '@/features/assessment/api/care-contract'
import AssessmentDetailModal from './AssessmentDetailModal'

const mockSummary: AssessmentSummary = {
  assessmentId: '10000000-0000-4000-8000-000000000003',
  questionnaireDefinitionId: '10000000-0000-4000-8000-000000000001',
  instrument: 'PHQ9',
  questionnaireVersion: 'phq9-vi-vn-capstone-v1',
  privacyPolicyVersion: 'privacy-capstone-v2',
  submittedAt: '2026-09-02T14:30:00Z',
  result: {
    totalScore: 8,
    screeningLevel: 'MILD',
    scoringVersion: 'phq9-standard-bands-v1',
    safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
    safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  },
}

describe('AssessmentDetailModal', () => {
  it('renders score, level, instrument, and meaning', () => {
    const handleClose = vi.fn()
    render(<AssessmentDetailModal item={mockSummary} onClose={handleClose} />)

    expect(
      screen.getByRole('heading', { name: 'Chi tiết kết quả sàng lọc' }),
    ).toBeVisible()
    expect(screen.getByText('8')).toBeVisible()
    expect(screen.getByText('/ 27 điểm')).toBeVisible()
    expect(screen.getByText('Mức nhẹ')).toBeVisible()
    expect(screen.getByText(/PHQ-9 · Đánh giá tâm trạng/)).toBeVisible()
    expect(
      screen.getByText(
        /các câu trả lời PHQ-9 của bạn cho thấy một số dấu hiệu nhẹ/,
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem toàn bài' })).toHaveAttribute(
      'href',
      '/assessment/phq9?assessmentId=10000000-0000-4000-8000-000000000003',
    )
  })

  it('renders safety box when safety status is positive', () => {
    const positiveSummary: AssessmentSummary = {
      ...mockSummary,
      result: {
        ...mockSummary.result,
        safetyStatus: 'POSITIVE_SAFETY_SCREEN',
      },
    }
    render(<AssessmentDetailModal item={positiveSummary} onClose={vi.fn()} />)

    expect(screen.getByText('Ưu tiên thông tin an toàn')).toBeVisible()
  })

  it('closes on close button click and escape key', async () => {
    const handleClose = vi.fn()
    render(<AssessmentDetailModal item={mockSummary} onClose={handleClose} />)

    const closeBtn = screen.getByRole('button', { name: 'Đóng chi tiết' })
    await userEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{Escape}')
    expect(handleClose).toHaveBeenCalledTimes(2)
  })
})
