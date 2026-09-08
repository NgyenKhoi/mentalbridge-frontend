import { http, HttpResponse, delay } from 'msw'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import AssessmentProgressPanel from './AssessmentProgressPanel'

const assessmentId = '10000000-0000-4000-8000-000000000003'
const endpoint = `http://localhost/api/care/assessments/by-id/${assessmentId}/progress`

function problem(status: number, code: string) {
  return HttpResponse.json(
    {
      type: `/problems/${code.toLowerCase()}`,
      title: 'Safe problem',
      status,
      code,
      correlationId: '10000000-0000-4000-8000-000000000009',
    },
    { status },
  )
}

describe('AssessmentProgressPanel', () => {
  it('announces loading before a comparison is available', async () => {
    mockServer.use(
      http.get(endpoint, async () => {
        await delay(100)
        return problem(409, 'INSUFFICIENT_COMPARABLE_DATA')
      }),
    )

    render(
      <AssessmentProgressPanel assessmentId={assessmentId} onClose={vi.fn()} />,
    )

    expect(screen.getByText('Đang tải so sánh từ Care…')).toBeVisible()
    expect(await screen.findByText('Chưa đủ dữ liệu tương thích')).toBeVisible()
  })

  it.each([
    [409, 'INSUFFICIENT_COMPARABLE_DATA', 'Chưa đủ dữ liệu tương thích', false],
    [401, 'UNAUTHENTICATED', 'Không thể truy cập so sánh này', false],
    [400, 'VALIDATION_FAILED', 'Yêu cầu so sánh không hợp lệ', false],
    [504, 'CARE_TIMEOUT', 'Care phản hồi quá thời gian', true],
    [503, 'CARE_UNAVAILABLE', 'Care tạm thời không khả dụng', true],
    [502, 'CARE_MALFORMED_RESPONSE', 'Care trả về dữ liệu không hợp lệ', true],
  ])('renders explicit %s %s state', async (status, code, title, retryable) => {
    mockServer.use(http.get(endpoint, () => problem(status, code)))

    render(
      <AssessmentProgressPanel assessmentId={assessmentId} onClose={vi.fn()} />,
    )

    expect(await screen.findByText(title)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Thử lại' }) !== null).toBe(
      retryable,
    )
  })
})
