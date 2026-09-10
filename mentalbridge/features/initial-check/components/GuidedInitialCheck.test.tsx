import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'

import GuidedInitialCheck from './GuidedInitialCheck'

const phq9AssessmentId = '10000000-0000-4000-8000-000000000101'
const gad7AssessmentId = '10000000-0000-4000-8000-000000000102'

function assessment(instrument: 'PHQ9' | 'GAD7') {
  const phq9 = instrument === 'PHQ9'
  return {
    assessmentId: phq9 ? phq9AssessmentId : gad7AssessmentId,
    questionnaireDefinitionId: phq9
      ? '30000000-0000-4000-8000-000000000101'
      : '30000000-0000-4000-8000-000000000102',
    instrument,
    questionnaireVersion: phq9
      ? 'phq9-vi-vn-capstone-v2'
      : 'gad7-vi-vn-adult-v1',
    privacyPolicyVersion: 'privacy-capstone-v3',
    submittedAt: '2026-09-10T08:00:00Z',
    voidedAt: null,
    result: {
      totalScore: phq9 ? 5 : 4,
      screeningLevel: phq9 ? 'MILD' : 'MINIMAL',
      scoringVersion: phq9
        ? 'phq9-standard-bands-v1'
        : 'gad7-standard-bands-v1',
      safetyStatus: phq9 ? 'NEGATIVE_SAFETY_SCREEN' : 'NOT_APPLICABLE',
      safetyPolicyVersion: phq9 ? 'MB-SAFETY-PHQ9-001/1.0-capstone' : null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  }
}

function completedState() {
  const phq9 = assessment('PHQ9')
  const gad7 = assessment('GAD7')
  return {
    phase: 'COMPLETED',
    phq9,
    gad7,
    evaluation: {
      supportEvaluationId: '20000000-0000-4000-8000-000000000101',
      policyVersion: 'mb-support-routing-capstone-v1',
      evaluatedAt: '2026-09-10T08:00:00Z',
      supportTier: 'SELF_GUIDED_SUPPORT',
      reasonCodes: ['ALL_SCREENING_LEVELS_MINIMAL_OR_MILD'],
      evidence: [
        {
          assessmentId: phq9AssessmentId,
          instrument: 'PHQ9',
          questionnaireVersion: phq9.questionnaireVersion,
          scoringVersion: phq9.result.scoringVersion,
          screeningLevel: phq9.result.screeningLevel,
          safetyStatus: phq9.result.safetyStatus,
          meaning: {
            meaningCode: 'PHQ9_MILD_14D',
            contentVersion: 'mb-screening-meaning-vi-vn-v1',
            referencePeriodDays: 14,
            text: 'Câu trả lời PHQ-9 của bạn thuộc mức triệu chứng nhẹ trong 14 ngày qua.',
            limitation:
              'Kết quả chỉ phản ánh câu trả lời tự khai trong 14 ngày qua và không phải chẩn đoán.',
          },
        },
        {
          assessmentId: gad7AssessmentId,
          instrument: 'GAD7',
          questionnaireVersion: gad7.questionnaireVersion,
          scoringVersion: gad7.result.scoringVersion,
          screeningLevel: gad7.result.screeningLevel,
          safetyStatus: gad7.result.safetyStatus,
          meaning: {
            meaningCode: 'GAD7_MINIMAL_14D',
            contentVersion: 'mb-screening-meaning-vi-vn-v1',
            referencePeriodDays: 14,
            text: 'Câu trả lời GAD-7 của bạn thuộc mức triệu chứng tối thiểu trong 14 ngày qua.',
            limitation:
              'Kết quả chỉ phản ánh câu trả lời tự khai trong 14 ngày qua và không phải chẩn đoán.',
          },
        },
      ],
      nextStep: {
        code: 'REVIEW_SELF_GUIDED_RESOURCE',
        contentVersion: 'mb-support-next-step-vi-vn-v1',
        text: 'Bạn có thể chọn một tài nguyên tự hỗ trợ đã được rà soát.',
        boundary:
          'Không có cuộc hẹn hoặc chia sẻ dữ liệu tự động nào được thực hiện.',
      },
      safetyGuidance: null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
      disclaimer:
        'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
    },
  }
}

function problem(status: number, code: string) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      title: 'Unavailable',
      status,
      code,
      correlationId: '40000000-0000-4000-8000-000000000101',
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

describe('GuidedInitialCheck', () => {
  it('routes a first-time user to profile readiness and back to the journey', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/initial-check', () =>
        HttpResponse.json({ phase: 'PROFILE_REQUIRED' }),
      ),
    )

    render(<GuidedInitialCheck />)

    await screen.findByRole('heading', { name: 'Hoàn thiện hồ sơ cơ bản' })
    expect(
      screen.getByRole('link', { name: 'Tạo hồ sơ và tiếp tục' }),
    ).toHaveAttribute('href', '/profile?returnTo=%2Finitial-check')
    expect(screen.getByText(/không yêu cầu nhật ký/i)).toBeVisible()
  })

  it('keeps safety and every result block visible when optional resources fail', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/initial-check', () =>
        HttpResponse.json(completedState()),
      ),
      http.get('http://localhost/api/resources', () =>
        problem(503, 'CONTENT_UNAVAILABLE'),
      ),
    )

    const { container } = render(<GuidedInitialCheck />)

    await screen.findByRole('heading', { name: 'Kết quả kiểm tra ban đầu' })
    expect(
      screen.getByRole('heading', { name: 'PHQ-9 — triệu chứng trầm cảm' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'GAD-7 — triệu chứng lo âu' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: /mục an toàn/i })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Tự hỗ trợ có hướng dẫn' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Hiểu kết quả trong đúng phạm vi' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Một lựa chọn bạn có thể cân nhắc' }),
    ).toBeVisible()
    expect(
      await screen.findByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeVisible()
    expect(container.textContent).not.toMatch(/sprint|backend|demo|test/i)

    await userEvent.click(
      screen.getByRole('button', { name: 'Bắt đầu lượt kiểm tra mới' }),
    )
    const confirmation = screen.getByRole('group', {
      name: 'Xác nhận bắt đầu lượt mới',
    })
    expect(confirmation).toBeVisible()
    expect(confirmation).toHaveFocus()
    expect(
      screen.getByText(/kết quả đã lưu vẫn có trong lịch sử/i),
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Giữ kết quả này' }),
    )
    expect(
      screen.queryByRole('group', { name: 'Xác nhận bắt đầu lượt mới' }),
    ).not.toBeInTheDocument()
  })

  it('offers a retry without discarding completed assessments when evaluation is unavailable', async () => {
    const state = {
      phase: 'EVALUATION_PENDING',
      phq9: assessment('PHQ9'),
      gad7: assessment('GAD7'),
    }
    const evaluate = vi.fn(() => problem(503, 'CARE_UNAVAILABLE'))
    mockServer.use(
      http.get('http://localhost/api/care/initial-check', () =>
        HttpResponse.json(state),
      ),
      http.post('http://localhost/api/care/initial-check/evaluation', evaluate),
    )

    render(<GuidedInitialCheck />)

    await screen.findByRole('heading', { name: 'Chưa thể tiếp tục' })
    expect(
      screen.getByText(/các bài đã hoàn thành vẫn được giữ lại/i),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('heading', { name: 'Chưa thể tiếp tục' }),
    ).toBeVisible()
    expect(evaluate).toHaveBeenCalledTimes(2)
  })
})
