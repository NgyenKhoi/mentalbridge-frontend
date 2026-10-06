import { fireEvent, render, screen } from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { AssessmentApi } from './assessment-api'
import type {
  Assessment,
  Questionnaire,
  ScreeningEpisode,
  SupportEvaluation,
  SupportGuide,
} from './assessment-contract'
import { AssessmentJourneyScreen } from './AssessmentJourneyScreen'

const mockBack = jest.fn()
const mockSignOut = jest.fn()

jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), push: jest.fn() },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: '11111111-1111-4111-8111-111111111111',
      role: 'USER',
    },
    signOut: mockSignOut,
  }),
}))

const disclosure = {
  consentType: 'PRIVACY_POLICY' as const,
  version: 'privacy-capstone-v3' as const,
  locale: 'vi-VN' as const,
  title: 'Xử lý dữ liệu sàng lọc',
  content: 'Dữ liệu được xử lý để trả kết quả và gợi ý hỗ trợ.',
  capstoneOnly: true as const,
}

function questionnaire(instrument: 'PHQ9' | 'GAD7'): Questionnaire {
  return {
    definitionId:
      instrument === 'PHQ9'
        ? '20000000-0000-4000-8000-000000000101'
        : '20000000-0000-4000-8000-000000000102',
    instrument,
    version:
      instrument === 'PHQ9' ? 'phq9-vi-vn-capstone-v2' : 'gad7-vi-vn-adult-v1',
    locale: 'vi-VN',
    title: instrument === 'PHQ9' ? 'Bài PHQ-9' : 'Bài GAD-7',
    referencePeriodDays: 14,
    scoringVersion:
      instrument === 'PHQ9' ? 'phq9-standard-v1' : 'gad7-standard-v1',
    responseOptions: [
      { value: 0, label: 'Không lần nào' },
      { value: 1, label: 'Vài ngày' },
      { value: 2, label: 'Hơn một nửa số ngày' },
      { value: 3, label: 'Gần như mỗi ngày' },
    ],
    questions: [
      {
        questionId:
          instrument === 'PHQ9'
            ? '60000000-0000-4000-8000-000000000101'
            : '60000000-0000-4000-8000-000000000102',
        itemNumber: 1,
        prompt:
          instrument === 'PHQ9'
            ? 'Bạn có ít hứng thú làm việc không?'
            : 'Bạn có cảm thấy lo lắng không?',
      },
    ],
    scoreBands: [
      { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 4 },
    ],
  }
}

function assessment(instrument: 'PHQ9' | 'GAD7', positive = false): Assessment {
  return {
    assessmentId:
      instrument === 'PHQ9'
        ? '10000000-0000-4000-8000-000000000101'
        : '10000000-0000-4000-8000-000000000102',
    questionnaireDefinitionId: questionnaire(instrument).definitionId,
    instrument,
    questionnaireVersion: questionnaire(instrument).version,
    privacyPolicyVersion: 'privacy-capstone-v3',
    submittedAt: '2026-10-06T08:00:00.000Z',
    result: {
      totalScore: positive ? 6 : 2,
      screeningLevel: positive ? 'MILD' : 'MINIMAL',
      scoringVersion: questionnaire(instrument).scoringVersion,
      safetyStatus:
        instrument === 'PHQ9'
          ? positive
            ? 'POSITIVE_SAFETY_SCREEN'
            : 'NEGATIVE_SAFETY_SCREEN'
          : 'NOT_APPLICABLE',
      safetyPolicyVersion: instrument === 'PHQ9' ? 'phq9-item9-v1' : null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  }
}

const emptyEpisode: ScreeningEpisode = {
  episodeId: '50000000-0000-4000-8000-000000000101',
  purpose: 'INITIAL_CHECK',
  status: 'IN_PROGRESS',
  phq9AssessmentId: null,
  gad7AssessmentId: null,
  supportEvaluationId: null,
  presentationEvaluationId: null,
  createdAt: '2026-10-06T07:00:00.000Z',
  updatedAt: '2026-10-06T07:00:00.000Z',
  completedAt: null,
  version: 0,
}

const phqEpisode: ScreeningEpisode = {
  ...emptyEpisode,
  phq9AssessmentId: '10000000-0000-4000-8000-000000000101',
  updatedAt: '2026-10-06T08:00:00.000Z',
  version: 1,
}

const readyEpisode: ScreeningEpisode = {
  ...phqEpisode,
  status: 'READY',
  gad7AssessmentId: '10000000-0000-4000-8000-000000000102',
  updatedAt: '2026-10-06T08:03:00.000Z',
  version: 2,
}

const completedEpisode: ScreeningEpisode = {
  ...readyEpisode,
  status: 'COMPLETED',
  supportEvaluationId: '40000000-0000-4000-8000-000000000100',
  presentationEvaluationId: '40000000-0000-4000-8000-000000000101',
  completedAt: '2026-10-06T08:04:00.000Z',
  version: 3,
}

const evaluation: SupportEvaluation = {
  supportEvaluationId: '40000000-0000-4000-8000-000000000101',
  policyVersion: 'mb-support-routing-capstone-v1',
  evaluatedAt: '2026-10-06T08:04:00.000Z',
  supportTier: 'SAFETY_FOLLOW_UP_RECOMMENDED',
  reasonCodes: ['PHQ9_SAFETY_SCREEN_POSITIVE'],
  evidence: [
    {
      assessmentId: assessment('PHQ9', true).assessmentId,
      instrument: 'PHQ9',
      questionnaireVersion: questionnaire('PHQ9').version,
      scoringVersion: questionnaire('PHQ9').scoringVersion,
      screeningLevel: 'MILD',
      safetyStatus: 'POSITIVE_SAFETY_SCREEN',
      meaning: {
        meaningCode: 'PHQ9_MILD_14D',
        contentVersion: 'meaning-v1',
        referencePeriodDays: 14,
        text: 'Nội dung diễn giải PHQ-9 đã duyệt.',
        limitation: 'Không phải chẩn đoán.',
      },
    },
    {
      assessmentId: assessment('GAD7').assessmentId,
      instrument: 'GAD7',
      questionnaireVersion: questionnaire('GAD7').version,
      scoringVersion: questionnaire('GAD7').scoringVersion,
      screeningLevel: 'MINIMAL',
      safetyStatus: 'NOT_APPLICABLE',
      meaning: {
        meaningCode: 'GAD7_MINIMAL_14D',
        contentVersion: 'meaning-v1',
        referencePeriodDays: 14,
        text: 'Nội dung diễn giải GAD-7 đã duyệt.',
        limitation: 'Không phải chẩn đoán.',
      },
    },
  ],
  nextStep: {
    code: 'REVIEW_GUIDE',
    contentVersion: 'next-v1',
    text: 'Xem gợi ý hỗ trợ phù hợp với lượt sàng lọc này.',
    boundary: 'Bạn chủ động chọn bước tiếp theo.',
  },
  safetyGuidance: 'Hãy xem hướng dẫn an toàn đã được duyệt.',
  disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  disclaimer: 'Đây là kết quả sàng lọc, không phải chẩn đoán.',
}

const guide: SupportGuide = {
  supportGuideId: '30000000-0000-4000-8000-000000000101',
  guideVersion: 1,
  guidePolicyVersion: 'mb-support-guide-capstone-v1',
  supportEvaluationId: evaluation.supportEvaluationId,
  generatedAt: '2026-10-06T08:05:00.000Z',
  guideType: 'ONE_TIME_SUPPORT_GUIDE',
  explanation: {
    code: 'SAFETY_FIRST',
    text: 'Ưu tiên xem hỗ trợ an toàn trước các tài nguyên bổ sung.',
  },
  safety: {
    status: 'POSITIVE_SAFETY_SCREEN',
    reasonCode: 'PHQ9_ITEM9_POSITIVE',
    policyVersion: 'phq9-item9-v1',
    guidanceCode: 'LOCAL_MINIMUM',
    guidance:
      'Nếu bạn cảm thấy không an toàn, hãy chủ động tìm hỗ trợ phù hợp.',
  },
  resourceResolution: {
    status: 'EMPTY',
    policyVersion: 'resource-v1',
    resolvedAt: '2026-10-06T08:05:00.000Z',
  },
  resources: [],
  provenance: {
    supportEvaluationPolicyVersion: evaluation.policyVersion,
    assessmentResults: [
      {
        assessmentId: assessment('PHQ9', true).assessmentId,
        instrument: 'PHQ9',
        questionnaireVersion: questionnaire('PHQ9').version,
        scoringVersion: questionnaire('PHQ9').scoringVersion,
        screeningLevel: 'MILD',
      },
      {
        assessmentId: assessment('GAD7').assessmentId,
        instrument: 'GAD7',
        questionnaireVersion: questionnaire('GAD7').version,
        scoringVersion: questionnaire('GAD7').scoringVersion,
        screeningLevel: 'MINIMAL',
      },
    ],
  },
  phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
}

function missingEpisode() {
  return new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 })
}

function assessmentApi(overrides: Partial<AssessmentApi> = {}): AssessmentApi {
  return {
    getCurrentEpisode: jest.fn().mockRejectedValue(missingEpisode()),
    startEpisode: jest.fn().mockResolvedValue(emptyEpisode),
    getQuestionnaire: jest
      .fn()
      .mockImplementation((instrument) =>
        Promise.resolve(questionnaire(instrument)),
      ),
    getQuestionnaireDefinition: jest
      .fn()
      .mockImplementation(() => Promise.resolve(questionnaire('PHQ9'))),
    getPrivacyDisclosure: jest.fn().mockResolvedValue(disclosure),
    getConsents: jest.fn().mockResolvedValue({
      decisions: [
        {
          decisionId: '80000000-0000-4000-8000-000000000101',
          consentType: 'PRIVACY_POLICY',
          policyVersion: disclosure.version,
          granted: true,
          decidedAt: '2026-10-06T07:00:00.000Z',
        },
      ],
    }),
    grantPrivacyConsent: jest.fn().mockResolvedValue(undefined),
    submitEpisodeAssessment: jest
      .fn()
      .mockImplementation((_episodeId, instrument) =>
        Promise.resolve(assessment(instrument, instrument === 'PHQ9')),
      ),
    completeEpisode: jest.fn().mockResolvedValue({
      episode: completedEpisode,
      presentationEvaluation: evaluation,
    }),
    getAssessment: jest
      .fn()
      .mockImplementation((assessmentId) =>
        Promise.resolve(
          assessmentId === assessment('PHQ9', true).assessmentId
            ? assessment('PHQ9', true)
            : assessment('GAD7'),
        ),
      ),
    listAssessments: jest
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    getSupportEvaluation: jest.fn().mockResolvedValue(evaluation),
    generateSupportGuide: jest.fn().mockResolvedValue(guide),
    getSupportGuide: jest.fn().mockResolvedValue(guide),
    listSupportGuides: jest
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    lookupSafetyDirectory: jest.fn().mockResolvedValue({
      trigger: 'POSITIVE_ITEM_9',
      state: 'RESULTS',
      areaWording: 'Cơ sở trong khu vực đã chọn',
      safetyGuidance: 'Hướng dẫn an toàn từ hệ thống.',
      limitation: 'MentalBridge không tự động liên hệ bên thứ ba.',
      entries: [
        {
          directoryEntryId: '90000000-0000-4000-8000-000000000101',
          name: 'Cơ sở hỗ trợ đã rà soát',
          type: 'FACILITY',
          phone: '0123456789',
          address: 'Thành phố Hồ Chí Minh',
          coverage: [{}],
          sourceName: 'Nguồn đã rà soát',
          sourceReference: 'REF-1',
          reviewedAt: '2026-10-01T00:00:00.000Z',
          verifiedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    }),
    ...overrides,
  }
}

describe('mobile assessment and support-guide journey', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('completes PHQ-9 then GAD-7 and renders only authoritative result, safety, and guide data', async () => {
    const api = assessmentApi({
      getCurrentEpisode: jest
        .fn()
        .mockRejectedValueOnce(missingEpisode())
        .mockResolvedValueOnce(phqEpisode)
        .mockResolvedValueOnce(readyEpisode),
    })
    await render(<AssessmentJourneyScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Bắt đầu hoặc tiếp tục' }),
    )
    expect(await screen.findByText('Bài PHQ-9')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Vài ngày' }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Đồng ý xử lý dữ liệu sàng lọc',
      }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hoàn tất bài này' }),
    )

    expect(await screen.findByText('Bài GAD-7')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Không lần nào' }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Đồng ý xử lý dữ liệu sàng lọc',
      }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hoàn tất bài này' }),
    )

    expect(
      await screen.findByText('Bạn đã hoàn tất lượt sàng lọc'),
    ).toBeOnTheScreen()
    expect(screen.getByText('6 điểm')).toBeOnTheScreen()
    expect(screen.getByText('2 điểm')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Ưu tiên xem hỗ trợ an toàn trước các tài nguyên bổ sung.',
      ),
    ).toBeOnTheScreen()
    expect(api.completeEpisode).toHaveBeenCalledWith(emptyEpisode.episodeId)
    expect(api.generateSupportGuide).toHaveBeenCalledWith(
      assessment('PHQ9', true).assessmentId,
      assessment('GAD7').assessmentId,
      expect.any(String),
    )

    await fireEvent.press(
      screen.getByRole('button', { name: 'Tôi cần hỗ trợ ngay' }),
    )
    await fireEvent.changeText(
      screen.getByLabelText('Khu vực cần tìm hỗ trợ'),
      'Thành phố Hồ Chí Minh',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tìm hỗ trợ đã rà soát' }),
    )
    expect(await screen.findByText('Cơ sở hỗ trợ đã rà soát')).toBeOnTheScreen()
    expect(api.lookupSafetyDirectory).toHaveBeenCalledWith(
      'POSITIVE_ITEM_9',
      'Thành phố Hồ Chí Minh',
    )
  })

  it('keeps answers in memory and explains a server validation failure', async () => {
    const api = assessmentApi({
      submitEpisodeAssessment: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'VALIDATION_FAILED',
          message: 'Invalid answers',
          status: 400,
        }),
      ),
    })
    await render(<AssessmentJourneyScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Bắt đầu hoặc tiếp tục' }),
    )
    const submit = await screen.findByRole('button', {
      name: 'Hoàn tất bài này',
    })
    expect(submit).toBeDisabled()
    await fireEvent.press(screen.getByRole('radio', { name: 'Vài ngày' }))
    expect(submit).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Đồng ý xử lý dữ liệu sàng lọc',
      }),
    )
    await fireEvent.press(submit)

    expect(
      await screen.findByText(
        'Câu trả lời chưa đầy đủ hoặc không còn phù hợp với phiên bản câu hỏi hiện tại.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Vài ngày' })).toBeChecked()
  })

  it('resumes the next authoritative instrument after reload', async () => {
    const api = assessmentApi({
      getCurrentEpisode: jest.fn().mockResolvedValue(phqEpisode),
    })
    await render(<AssessmentJourneyScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Bắt đầu hoặc tiếp tục' }),
    )

    expect(await screen.findByText('Bài GAD-7')).toBeOnTheScreen()
    expect(screen.queryByText('Bài PHQ-9')).not.toBeOnTheScreen()
    expect(api.startEpisode).not.toHaveBeenCalled()
  })

  it('reopens an owned result with its exact immutable questionnaire definition', async () => {
    const historical = assessment('PHQ9')
    const api = assessmentApi({
      listAssessments: jest.fn().mockResolvedValue({
        items: [historical],
        nextCursor: null,
        hasMore: false,
      }),
      getAssessment: jest.fn().mockResolvedValue(historical),
      getQuestionnaireDefinition: jest
        .fn()
        .mockResolvedValue(questionnaire('PHQ9')),
    })
    await render(<AssessmentJourneyScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: /PHQ-9 · Tối thiểu/ }),
    )

    expect(await screen.findByText('Xem lại PHQ-9')).toBeOnTheScreen()
    expect(
      screen.getByText(/Phiên bản phq9-vi-vn-capstone-v2/),
    ).toBeOnTheScreen()
    expect(api.getAssessment).toHaveBeenCalledWith(historical.assessmentId)
    expect(api.getQuestionnaireDefinition).toHaveBeenCalledWith(
      historical.questionnaireDefinitionId,
    )
  })

  it('fails closed for unauthorized history and dependency unavailability', async () => {
    const forbiddenApi = assessmentApi({
      listAssessments: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'FORBIDDEN',
          message: 'Forbidden',
          status: 403,
        }),
      ),
    })
    const forbidden = await render(
      <AssessmentJourneyScreen api={forbiddenApi} />,
    )

    expect(
      await screen.findByText(
        'Tài khoản này không có quyền sử dụng hành trình sàng lọc cá nhân.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Kết quả gần đây')).not.toBeOnTheScreen()
    await forbidden.unmount()

    const unavailableApi = assessmentApi({
      listAssessments: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CARE_UNAVAILABLE',
          message: 'Unavailable',
          status: 503,
        }),
      ),
    })
    await render(<AssessmentJourneyScreen api={unavailableApi} />)

    expect(
      await screen.findByText(
        'Chưa thể tải hành trình sàng lọc lúc này. Dữ liệu đã lưu không bị thay đổi.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen()
  })

  it('reopens the exact persisted support-guide snapshot', async () => {
    const api = assessmentApi({
      listSupportGuides: jest.fn().mockResolvedValue({
        items: [guide],
        nextCursor: null,
        hasMore: false,
      }),
    })
    await render(<AssessmentJourneyScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: /Gợi ý sau sàng lọc/ }),
    )

    expect(
      await screen.findByText('Snapshot hỗ trợ sau sàng lọc'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Ưu tiên xem hỗ trợ an toàn trước các tài nguyên bổ sung.',
      ),
    ).toBeOnTheScreen()
    expect(api.getSupportGuide).toHaveBeenCalledWith(guide.supportGuideId)
  })
})
