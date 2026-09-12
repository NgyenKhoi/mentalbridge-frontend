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
  scoringVersion: 'phq9-standard-bands-v1',
  responseOptions: [
    { value: 0, label: 'Không có gì' },
    { value: 1, label: 'Vài ngày' },
    { value: 2, label: 'Hơn nửa ngày' },
    { value: 3, label: 'Gần như mỗi ngày' },
  ],
  questions: [{ questionId, itemNumber: 1, prompt: 'Câu hỏi từ Care' }],
  scoreBands: [
    { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 4 },
    { screeningLevel: 'MILD', minimumScore: 5, maximumScore: 9 },
    { screeningLevel: 'MODERATE', minimumScore: 10, maximumScore: 14 },
    {
      screeningLevel: 'MODERATELY_SEVERE',
      minimumScore: 15,
      maximumScore: 19,
    },
    { screeningLevel: 'SEVERE', minimumScore: 20, maximumScore: 27 },
  ],
}
const disclosure = {
  consentType: 'PRIVACY_POLICY',
  version: 'privacy-capstone-v3',
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
  it('can describe the next guided step in its completion action', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/questionnaires/phq9', () =>
        HttpResponse.json(questionnaire),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
    )

    render(
      <AssessmentFlow
        mode="authenticated"
        instrument="PHQ9"
        workflow="initial-check"
        completionLabel="Lưu PHQ-9 và bắt đầu GAD-7"
        completionPendingLabel="Đang lưu PHQ-9…"
      />,
    )

    await screen.findByRole('heading', {
      name: 'PHQ-9 — Sàng lọc triệu chứng',
    })
    expect(
      screen.getByRole('button', {
        name: 'Lưu PHQ-9 và bắt đầu GAD-7',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Xem kết quả' }),
    ).not.toBeInTheDocument()
  })

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
              privacyPolicyVersion: 'privacy-capstone-v2',
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

    render(<AssessmentFlow mode="anonymous" instrument="PHQ9" />)
    await screen.findByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' })

    await userEvent.click(screen.getByRole('radio', { name: 'Vài ngày' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /tôi đồng ý/i }))
    await userEvent.click(screen.getByRole('button', { name: /Xem kết quả/ }))

    await screen.findByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' })
    expect(screen.getByText('1')).toBeVisible()
    expect(screen.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
    expect(screen.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
    expect(screen.queryByText(/hotline/i)).not.toBeInTheDocument()
    expect(received).toHaveBeenCalledWith({
      body: {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v3',
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

    render(<AssessmentFlow mode="anonymous" instrument="PHQ9" />)

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

  it('completes authenticated GAD-7 without inventing a safety policy', async () => {
    const gadQuestionnaire = {
      ...questionnaire,
      definitionId: '20000000-0000-4000-8000-000000000001',
      instrument: 'GAD7',
      version: 'gad7-vi-vn-adult-v1',
      title: 'GAD-7 — Sàng lọc triệu chứng lo âu',
      scoringVersion: 'gad7-standard-bands-v1',
      scoreBands: [
        { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 4 },
        { screeningLevel: 'MILD', minimumScore: 5, maximumScore: 9 },
        { screeningLevel: 'MODERATE', minimumScore: 10, maximumScore: 14 },
        { screeningLevel: 'SEVERE', minimumScore: 15, maximumScore: 21 },
      ],
    }
    mockServer.use(
      http.get('http://localhost/api/care/assessments/current', () =>
        problem(404, 'ASSESSMENT_NOT_FOUND'),
      ),
      http.get('http://localhost/api/care/questionnaires/gad7', () =>
        HttpResponse.json(gadQuestionnaire),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({
          decisions: [
            {
              decisionId: correlationId,
              consentType: 'PRIVACY_POLICY',
              policyVersion: disclosure.version,
              granted: true,
              decidedAt: '2026-09-01T00:00:00Z',
            },
          ],
        }),
      ),
      http.post('http://localhost/api/care/assessments/current', () =>
        HttpResponse.json(
          {
            assessmentId,
            questionnaireDefinitionId: gadQuestionnaire.definitionId,
            instrument: 'GAD7',
            questionnaireVersion: gadQuestionnaire.version,
            privacyPolicyVersion: disclosure.version,
            submittedAt: '2026-09-01T00:00:00Z',
            voidedAt: null,
            result: {
              totalScore: 3,
              screeningLevel: 'MINIMAL',
              scoringVersion: gadQuestionnaire.scoringVersion,
              safetyStatus: 'NOT_APPLICABLE',
              safetyPolicyVersion: null,
              disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
            },
          },
          { status: 201 },
        ),
      ),
    )

    render(<AssessmentFlow mode="authenticated" instrument="GAD7" />)
    await screen.findByRole('heading', { name: gadQuestionnaire.title })
    await userEvent.click(
      screen.getByRole('radio', { name: 'Gần như mỗi ngày' }),
    )
    await userEvent.click(screen.getByRole('checkbox', { name: /tôi đồng ý/i }))
    await userEvent.click(screen.getByRole('button', { name: /Xem kết quả/ }))

    await screen.findByRole('heading', { name: 'Kết quả sàng lọc GAD-7' })
    expect(screen.getByText('/ 21 điểm')).toBeVisible()
    expect(screen.getByText('Không áp dụng cho bộ câu hỏi này')).toBeVisible()
    expect(screen.getAllByText('Không áp dụng')).not.toHaveLength(0)
    expect(screen.queryByText(/invented-gad-policy/i)).not.toBeInTheDocument()
  })

  it('reopens an assessment with its immutable retired definition', async () => {
    const oldQuestion = 'Cảm thấy chán nản, chán nản hoặc vô vọng'
    mockServer.use(
      http.get(
        `http://localhost/api/care/assessments/by-id/${assessmentId}`,
        () =>
          HttpResponse.json({
            assessmentId,
            questionnaireDefinitionId: definitionId,
            instrument: 'PHQ9',
            questionnaireVersion: 'phq9-vi-vn-capstone-v1',
            privacyPolicyVersion: disclosure.version,
            submittedAt: '2026-08-01T00:00:00Z',
            voidedAt: null,
            result: {
              totalScore: 4,
              screeningLevel: 'MINIMAL',
              scoringVersion: questionnaire.scoringVersion,
              safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
              safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
              disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
            },
          }),
      ),
      http.get(
        `http://localhost/api/care/questionnaires/definitions/${definitionId}`,
        () =>
          HttpResponse.json({
            ...questionnaire,
            questions: [{ questionId, itemNumber: 2, prompt: oldQuestion }],
          }),
      ),
    )

    render(
      <AssessmentFlow
        mode="authenticated"
        instrument="PHQ9"
        initialAssessmentId={assessmentId}
      />,
    )

    await screen.findByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' })
    await userEvent.click(screen.getByText('Nội dung và thang điểm đã dùng'))
    expect(screen.getByText(oldQuestion)).toBeVisible()
    expect(screen.getAllByText(/phq9-vi-vn-capstone-v1/i)).toHaveLength(2)
  })
})
