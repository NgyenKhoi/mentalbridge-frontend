import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { AnonymousAssessmentApi } from './anonymous-assessment-api'
import type {
  AnonymousAssessment,
  AnonymousSession,
  Instrument,
  Questionnaire,
} from './assessment-contract'
import { AnonymousAssessmentScreen } from './AnonymousAssessmentScreen'

const mockBack = jest.fn()

jest.mock('expo-router', () => ({ router: { back: () => mockBack() } }))

const questionId = '40000000-0000-4000-8000-000000000721'
const definitionId = '30000000-0000-4000-8000-000000000721'
const session: AnonymousSession = {
  sessionId: '10000000-0000-4000-8000-000000000721',
  sessionToken: 'a'.repeat(43),
  expiresAt: '2026-10-23T10:30:00.000Z',
}

function questionnaire(instrument: Instrument): Questionnaire {
  return {
    definitionId,
    instrument,
    version: `${instrument.toLowerCase()}-vi-vn-v1`,
    locale: 'vi-VN',
    title: instrument,
    referencePeriodDays: 14,
    scoringVersion: `${instrument.toLowerCase()}-standard-v1`,
    responseOptions: [
      { value: 0, label: 'Không bao giờ' },
      { value: 1, label: 'Vài ngày' },
      { value: 2, label: 'Hơn một nửa số ngày' },
      { value: 3, label: 'Gần như mỗi ngày' },
    ],
    questions: [{ questionId, itemNumber: 1, prompt: 'Bạn cảm thấy thế nào?' }],
    scoreBands: [
      { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 3 },
    ],
  }
}

const result: AnonymousAssessment = {
  assessmentId: '20000000-0000-4000-8000-000000000721',
  questionnaireDefinitionId: definitionId,
  instrument: 'PHQ9',
  questionnaireVersion: 'phq9-vi-vn-v1',
  privacyPolicyVersion: 'privacy-capstone-v3',
  submittedAt: '2026-10-23T10:05:00.000Z',
  expiresAt: '2026-10-23T10:35:00.000Z',
  result: {
    totalScore: 1,
    screeningLevel: 'MINIMAL',
    scoringVersion: 'phq9-standard-v1',
    safetyStatus: 'POSITIVE_SAFETY_SCREEN',
    safetyPolicyVersion: 'phq9-item9-v1',
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  },
}

function api(
  overrides: Partial<AnonymousAssessmentApi> = {},
): AnonymousAssessmentApi {
  return {
    createSession: jest.fn().mockResolvedValue(session),
    getQuestionnaire: jest
      .fn()
      .mockImplementation((instrument: Instrument) =>
        Promise.resolve(questionnaire(instrument)),
      ),
    getPrivacyDisclosure: jest.fn().mockResolvedValue({
      consentType: 'PRIVACY_POLICY',
      version: 'privacy-capstone-v3',
      locale: 'vi-VN',
      title: 'Công bố quyền riêng tư',
      content: 'Dữ liệu chỉ được xử lý cho lượt sàng lọc tạm thời này.',
      capstoneOnly: true,
    }),
    submitAssessment: jest.fn().mockResolvedValue(result),
    getAssessment: jest.fn().mockResolvedValue(result),
    ...overrides,
  }
}

async function answerAndSubmit(assessmentApi: AnonymousAssessmentApi) {
  await screen.findByRole('header', { name: 'Hiểu hơn về cảm xúc hiện tại' })
  await fireEvent.press(screen.getByRole('checkbox'))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Bắt đầu sàng lọc' }),
  )
  await screen.findByRole('header', { name: 'Bạn cảm thấy thế nào?' })
  await fireEvent.press(screen.getByRole('radio', { name: 'Vài ngày' }))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Gửi và xem kết quả' }),
  )
  return assessmentApi
}

describe('anonymous mobile assessment journey', () => {
  beforeEach(() => mockBack.mockClear())

  it('requires disclosure acknowledgement and shows only the authoritative result', async () => {
    const assessmentApi = api()
    await render(
      <AnonymousAssessmentScreen
        api={assessmentApi}
        createIdempotencyKey={() => '50000000-0000-4000-8000-000000000721'}
      />,
    )

    const start = await screen.findByRole('button', {
      name: 'Bắt đầu sàng lọc',
    })
    expect(start).toBeDisabled()
    await answerAndSubmit(assessmentApi)

    await screen.findByRole('header', { name: 'Bạn đã hoàn tất PHQ-9' })
    expect(screen.getByText('1 điểm')).toBeOnTheScreen()
    expect(screen.getByText('Mức độ Tối thiểu')).toBeOnTheScreen()
    expect(
      screen.getByText('Đây không phải chẩn đoán y khoa'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Nếu bạn đang không an toàn')).toBeOnTheScreen()
    expect(assessmentApi.submitAssessment).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        questionnaireDefinitionId: definitionId,
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 1 }],
      }),
      '50000000-0000-4000-8000-000000000721',
    )
    expect(assessmentApi.getAssessment).toHaveBeenCalledWith(
      session,
      result.assessmentId,
    )
  })

  it('keeps a failed result read explicit and retries without resubmitting', async () => {
    const getAssessment = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ message: 'Mất mạng.', code: 'NETWORK_ERROR' }),
      )
      .mockResolvedValueOnce(result)
    const assessmentApi = api({ getAssessment })
    await render(<AnonymousAssessmentScreen api={assessmentApi} />)

    await answerAndSubmit(assessmentApi)
    await screen.findByRole('header', { name: 'Chưa đọc được kết quả' })
    expect(screen.queryByText('1 điểm')).not.toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Thử đọc lại kết quả' }),
    )

    await screen.findByText('1 điểm')
    expect(getAssessment).toHaveBeenCalledTimes(2)
    expect(assessmentApi.submitAssessment).toHaveBeenCalledTimes(1)
  })

  it('clears the session and never exposes stale result after expiry', async () => {
    const assessmentApi = api({
      getAssessment: jest.fn().mockRejectedValue(
        new ApiError({
          message: 'Phiên đã hết hạn.',
          code: 'ANONYMOUS_SESSION_EXPIRED',
          status: 410,
        }),
      ),
    })
    await render(<AnonymousAssessmentScreen api={assessmentApi} />)

    await answerAndSubmit(assessmentApi)
    await screen.findByRole('header', {
      name: 'Kết quả tạm thời không còn truy cập được',
    })
    expect(screen.queryByText('1 điểm')).not.toBeOnTheScreen()
    expect(screen.queryByText('Bạn cảm thấy thế nào?')).not.toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu phiên mới' }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('header', { name: 'Hiểu hơn về cảm xúc hiện tại' }),
      ).toBeOnTheScreen(),
    )
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })
})
