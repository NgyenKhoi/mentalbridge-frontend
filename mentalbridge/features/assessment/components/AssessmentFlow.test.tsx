import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'

import AssessmentFlow from './AssessmentFlow'

const definitionId = '10000000-0000-4000-8000-000000000001'
const questionId = '10000000-0000-4000-8000-000000000002'
const assessmentId = '10000000-0000-4000-8000-000000000003'
const correlationId = '10000000-0000-4000-8000-000000000004'

const questionnaire = {
  definitionId,
  instrument: 'PHQ9',
  version: 'phq9-vi-vn-capstone-v1',
  locale: 'vi-VN',
  title: 'PHQ-9 — Sàng lọc triệu chứng',
  referencePeriodDays: 14,
  responseOptions: [
    { value: 0, label: 'Không có gì' },
    { value: 1, label: 'Vài ngày' },
    { value: 2, label: 'Hơn nửa ngày' },
    { value: 3, label: 'Gần như mỗi ngày' },
  ],
  questions: [{ questionId, itemNumber: 1, prompt: 'Câu hỏi từ Care' }],
}
const disclosure = {
  consentType: 'PRIVACY_POLICY',
  version: 'privacy-capstone-v1',
  locale: 'vi-VN',
  title: 'Thông báo xử lý dữ liệu',
  content: 'Nội dung do Care cung cấp.',
  capstoneOnly: true,
}

function problem(status: number, code: string) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      title: 'Request rejected',
      status,
      code,
      correlationId,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

describe('AssessmentFlow', () => {
  it('submits only versioned answers and renders the server-owned result', async () => {
    const received = vi.fn()
    mockServer.use(
      http.get('http://localhost/api/care/anonymous-assessments/current', () =>
        problem(401, 'ANONYMOUS_SESSION_REQUIRED'),
      ),
      http.get('http://localhost/api/care/questionnaires/phq9', () =>
        HttpResponse.json(questionnaire),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.post('http://localhost/api/care/anonymous-session', () =>
        HttpResponse.json(
          { expiresAt: '2099-01-01T00:30:00Z' },
          { status: 201 },
        ),
      ),
      http.post(
        'http://localhost/api/care/anonymous-assessments/current',
        async ({ request }) => {
          received({
            body: await request.json(),
            idempotencyKey: request.headers.get('Idempotency-Key'),
          })
          return HttpResponse.json(
            {
              assessmentId,
              questionnaireDefinitionId: definitionId,
              instrument: 'PHQ9',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              privacyPolicyVersion: 'privacy-capstone-v1',
              submittedAt: '2026-09-01T00:00:00Z',
              voidedAt: null,
              expiresAt: '2099-01-01T00:30:00Z',
              result: {
                totalScore: 1,
                screeningLevel: 'MINIMAL',
                scoringVersion: 'phq9-standard-bands-v1',
                safetyStatus: 'POSITIVE_SAFETY_SCREEN',
                safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
                disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
              },
            },
            { status: 201 },
          )
        },
      ),
    )

    render(<AssessmentFlow mode="anonymous" />)
    await screen.findByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' })

    await userEvent.click(screen.getByRole('radio', { name: 'Vài ngày' }))
    await userEvent.click(
      screen.getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Gửi cho Care chấm điểm' }),
    )

    await screen.findByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' })
    expect(screen.getByText('1')).toBeVisible()
    expect(screen.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
    expect(screen.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
    expect(screen.queryByText(/hotline/i)).not.toBeInTheDocument()
    expect(received).toHaveBeenCalledWith({
      body: {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 1 }],
      },
      idempotencyKey: expect.stringMatching(/^[\x20-\x7E]{16,128}$/),
    })
    expect(JSON.stringify(received.mock.calls)).not.toMatch(
      /totalScore|screeningLevel|safetyStatus/,
    )
  })

  it('shows an explicit approved-content fallback instead of inventing questions', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/anonymous-assessments/current', () =>
        problem(401, 'ANONYMOUS_SESSION_REQUIRED'),
      ),
      http.get('http://localhost/api/care/questionnaires/phq9', () =>
        problem(404, 'QUESTIONNAIRE_NOT_FOUND'),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
    )

    render(<AssessmentFlow mode="anonymous" />)

    await screen.findByRole('heading', {
      name: 'Bài sàng lọc hiện chưa khả dụng',
    })
    expect(
      screen.getByText(/không tự tạo hoặc dịch nội dung thay thế/i),
    ).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })
  })
})
