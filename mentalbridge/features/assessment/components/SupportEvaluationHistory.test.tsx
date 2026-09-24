import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { SupportEvaluationHistory } from './SupportEvaluationHistory'

const disclaimer =
  'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.'

describe('SupportEvaluationHistory', () => {
  it('reopens the full saved support evaluation without workflow cookies', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/support-evaluations/history', () =>
        HttpResponse.json({
          items: [
            {
              supportEvaluationId: '20000000-0000-4000-8000-000000000101',
              policyVersion: 'mb-support-routing-capstone-v1',
              evaluatedAt: '2026-09-23T08:00:00Z',
              supportTier: 'PROFESSIONAL_SUPPORT_RECOMMENDED',
              reasonCodes: ['PHQ9_MODERATE_OR_HIGHER'],
              evidence: [
                {
                  assessmentId: '10000000-0000-4000-8000-000000000101',
                  instrument: 'PHQ9',
                  questionnaireVersion: 'phq9-vi-vn-capstone-v2',
                  scoringVersion: 'phq9-standard-bands-v1',
                  screeningLevel: 'MODERATE',
                  safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
                  meaning: {
                    meaningCode: 'PHQ9_MODERATE_14D',
                    contentVersion: 'mb-screening-meaning-vi-vn-v2',
                    referencePeriodDays: 14,
                    text: 'Diễn giải PHQ-9 dễ hiểu và có thêm ngữ cảnh.',
                    limitation: 'Giới hạn của kết quả sàng lọc PHQ-9.',
                  },
                },
                {
                  assessmentId: '10000000-0000-4000-8000-000000000102',
                  instrument: 'GAD7',
                  questionnaireVersion: 'gad7-vi-vn-adult-v1',
                  scoringVersion: 'gad7-standard-bands-v1',
                  screeningLevel: 'MILD',
                  safetyStatus: 'NOT_APPLICABLE',
                  meaning: {
                    meaningCode: 'GAD7_MILD_14D',
                    contentVersion: 'mb-screening-meaning-vi-vn-v2',
                    referencePeriodDays: 14,
                    text: 'Diễn giải GAD-7 dễ hiểu và có thêm ngữ cảnh.',
                    limitation: 'Giới hạn của kết quả sàng lọc GAD-7.',
                  },
                },
              ],
              nextStep: {
                code: 'CONSIDER_PROFESSIONAL_SUPPORT',
                contentVersion: 'mb-support-next-step-vi-vn-v1',
                text: 'Bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
                boundary: 'Không có cuộc hẹn hoặc chia sẻ dữ liệu tự động.',
              },
              safetyGuidance: null,
              disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
              disclaimer,
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    )

    render(<SupportEvaluationHistory />)

    const open = await screen.findByRole('button', {
      name: /Xem bài tổng hợp ngày/,
    })
    await userEvent.click(open)

    expect(open).toHaveFocus()
    expect(
      screen.getByText('Diễn giải PHQ-9 dễ hiểu và có thêm ngữ cảnh.'),
    ).toBeVisible()
    expect(
      screen.getByText('Diễn giải GAD-7 dễ hiểu và có thêm ngữ cảnh.'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
      ),
    ).toBeVisible()
    expect(screen.getByText(disclaimer)).toBeVisible()
  })
})
