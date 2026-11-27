import type {
  CombinedScreeningMeaning,
  ScreeningEpisodeHistoryItem,
  SupportEvaluation,
} from '@/features/assessment/api/care-contract'

const disclaimer =
  'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.'

type Options = Readonly<{
  supportEvaluationId?: string
  episodeId?: string
  purpose?: 'INITIAL_CHECK' | 'REASSESSMENT'
  supportGuideId?: string | null
  priority?: CombinedScreeningMeaning['presentationPriority']
}>

export function combinedMeaningFixture(
  options: Options = {},
): CombinedScreeningMeaning {
  const priority = options.priority ?? 'SELF_GUIDED'
  const safety = priority === 'SAFETY'
  const professional = priority === 'PROFESSIONAL_SUPPORT'

  return {
    supportEvaluationId:
      options.supportEvaluationId ?? '20000000-0000-4000-8000-000000000101',
    sourcePolicyVersion: 'mb-support-routing-capstone-v1',
    evaluatedAt: '2026-09-10T08:00:00Z',
    presentationPolicyVersion: 'mb-combined-screening-meaning-v1',
    contentVersion: 'mb-combined-screening-meaning-vi-vn-v1-draft.3',
    referencePeriodDays: 14,
    episodeId: options.episodeId ?? '70000000-0000-4000-8000-000000000101',
    episodePurpose: options.purpose ?? 'INITIAL_CHECK',
    episodeCompletedAt: '2026-09-10T08:00:00Z',
    domainSupportEvaluationId: '80000000-0000-4000-8000-000000000101',
    supportGuideId: options.supportGuideId ?? null,
    evidence: [
      {
        assessmentId: '10000000-0000-4000-8000-000000000101',
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-vi-vn-capstone-v2',
        scoringVersion: 'phq9-standard-bands-v1',
        totalScore: professional ? 12 : 5,
        screeningLevel: professional ? 'MODERATE' : 'MILD',
        safetyStatus: safety
          ? 'POSITIVE_SAFETY_SCREEN'
          : 'NEGATIVE_SAFETY_SCREEN',
      },
      {
        assessmentId: '10000000-0000-4000-8000-000000000102',
        instrument: 'GAD7',
        questionnaireVersion: 'gad7-vi-vn-adult-v1',
        scoringVersion: 'gad7-standard-bands-v1',
        totalScore: 4,
        screeningLevel: 'MINIMAL',
        safetyStatus: 'NOT_APPLICABLE',
      },
    ],
    supportTier: safety
      ? 'SAFETY_FOLLOW_UP_RECOMMENDED'
      : professional
        ? 'PROFESSIONAL_SUPPORT_RECOMMENDED'
        : 'SELF_GUIDED_SUPPORT',
    baseMeaning: {
      code: professional
        ? 'PHQ9_MODERATE_GAD7_MINIMAL'
        : 'PHQ9_MILD_GAD7_MINIMAL',
      text: professional
        ? 'Dấu hiệu trầm cảm ở mức trung bình, lo âu rất ít. Bạn nên trao đổi thêm với chuyên gia.'
        : 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
      rationale: professional
        ? 'Dấu hiệu trầm cảm từ mức trung bình trở lên là lý do MentalBridge gợi ý trao đổi với chuyên gia, để bạn hiểu rõ hơn những thay đổi về tâm trạng, giấc ngủ hay năng lượng.'
        : 'Bạn có thể bắt đầu bằng nghỉ ngơi, ăn uống đều đặn và một hoạt động nhỏ giúp nâng đỡ tâm trạng.',
      supportTier: professional
        ? 'PROFESSIONAL_SUPPORT_RECOMMENDED'
        : 'SELF_GUIDED_SUPPORT',
    },
    presentationPriority: priority,
    nextStep: {
      code: professional
        ? 'CONSIDER_PROFESSIONAL_SUPPORT'
        : 'REVIEW_SELF_GUIDED_RESOURCE',
      contentVersion: 'mb-support-next-step-vi-vn-v1',
      text: professional
        ? 'Bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.'
        : 'Bạn có thể chọn một tài nguyên tự hỗ trợ đã được rà soát.',
      boundary: 'Không có cuộc hẹn hoặc chia sẻ dữ liệu tự động.',
    },
    safetyGuidance: safety
      ? 'Nếu bạn cảm thấy mình không an toàn, hãy chủ động tìm hỗ trợ trực tiếp ngay lúc này.'
      : null,
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    disclaimer,
  }
}

export function completedScreeningEpisodeFixture(
  meaning: CombinedScreeningMeaning = combinedMeaningFixture(),
): ScreeningEpisodeHistoryItem {
  const [phq9, gad7] = meaning.evidence
  return {
    episodeId: meaning.episodeId!,
    purpose: meaning.episodePurpose!,
    status: 'COMPLETED',
    startedAt: '2026-09-10T07:50:00Z',
    updatedAt: meaning.episodeCompletedAt!,
    completedAt: meaning.episodeCompletedAt!,
    presentationEvaluationId: meaning.supportEvaluationId,
    meaningState: 'AVAILABLE',
    evidence: [
      {
        instrument: 'PHQ9',
        state: 'AVAILABLE',
        assessmentId: phq9.assessmentId,
        totalScore: phq9.totalScore,
        screeningLevel: phq9.screeningLevel,
        safetyStatus: phq9.safetyStatus,
      },
      {
        instrument: 'GAD7',
        state: 'AVAILABLE',
        assessmentId: gad7.assessmentId,
        totalScore: gad7.totalScore,
        screeningLevel: gad7.screeningLevel,
        safetyStatus: gad7.safetyStatus,
      },
    ],
    meaning,
  }
}

export function supportEvaluationFixture(
  meaning: CombinedScreeningMeaning = combinedMeaningFixture(),
): SupportEvaluation {
  return {
    supportEvaluationId: meaning.supportEvaluationId,
    policyVersion: meaning.sourcePolicyVersion,
    evaluatedAt: meaning.evaluatedAt,
    supportTier: meaning.supportTier,
    reasonCodes: [
      meaning.presentationPriority === 'SAFETY'
        ? 'PHQ9_SAFETY_SCREEN_POSITIVE'
        : meaning.presentationPriority === 'PROFESSIONAL_SUPPORT'
          ? 'PHQ9_MODERATE_OR_HIGHER'
          : 'ALL_SCREENING_LEVELS_MINIMAL_OR_MILD',
    ],
    evidence: meaning.evidence.map((item) => ({
      assessmentId: item.assessmentId,
      instrument: item.instrument,
      questionnaireVersion: item.questionnaireVersion,
      scoringVersion: item.scoringVersion,
      screeningLevel: item.screeningLevel,
      safetyStatus: item.safetyStatus,
      meaning: {
        meaningCode: `${item.instrument}_${item.screeningLevel}_14D`,
        contentVersion: 'mb-screening-meaning-vi-vn-v2',
        referencePeriodDays: 14,
        text: `Diễn giải riêng của ${item.instrument}.`,
        limitation: 'Kết quả sàng lọc không phải chẩn đoán.',
      },
    })),
    nextStep: meaning.nextStep,
    safetyGuidance: meaning.safetyGuidance,
    disclaimerCode: meaning.disclaimerCode,
    disclaimer: meaning.disclaimer,
  }
}
