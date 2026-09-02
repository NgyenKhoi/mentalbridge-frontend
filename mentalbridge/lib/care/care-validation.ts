import type {
  AnonymousAssessment,
  AnonymousSession,
  Assessment,
  AssessmentResult,
  AssessmentSubmissionRequest,
  Instrument,
  Questionnaire,
  SafetyStatus,
  ScreeningLevel,
  CareProfile,
  CareProfileUpdate,
  ConsentCollection,
  ConsentDecisionRequest,
  PrivacyDisclosure,
  AssessmentHistoryPage,
} from '@/features/assessment/api/care-contract'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCREENING_LEVELS = new Set<ScreeningLevel>([
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
])
const SAFETY_STATUSES = new Set<SafetyStatus>([
  'NEGATIVE_SAFETY_SCREEN',
  'POSITIVE_SAFETY_SCREEN',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

export function parseProfile(value: unknown): CareProfile | null {
  if (
    !isRecord(value) ||
    !isUuid(value.accountId) ||
    typeof value.displayName !== 'string' ||
    !isOptionalString(value.dateOfBirth) ||
    !isOptionalString(value.gender) ||
    typeof value.locale !== 'string' ||
    typeof value.timezone !== 'string' ||
    typeof value.reminderEnabled !== 'boolean' ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 0
  )
    return null
  return value as CareProfile
}

export function parseProfileUpdate(value: unknown): CareProfileUpdate | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          'displayName',
          'dateOfBirth',
          'gender',
          'locale',
          'timezone',
          'reminderEnabled',
        ].includes(key),
    ) ||
    typeof value.displayName !== 'string' ||
    value.displayName.trim().length < 1 ||
    value.displayName.length > 120 ||
    !isOptionalString(value.dateOfBirth) ||
    !isOptionalString(value.gender) ||
    typeof value.locale !== 'string' ||
    typeof value.timezone !== 'string' ||
    typeof value.reminderEnabled !== 'boolean'
  )
    return null
  return value as CareProfileUpdate
}

export function parsePrivacyDisclosure(
  value: unknown,
): PrivacyDisclosure | null {
  if (
    !isRecord(value) ||
    value.consentType !== 'PRIVACY_POLICY' ||
    value.version !== 'privacy-capstone-v1' ||
    value.locale !== 'vi-VN' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    value.capstoneOnly !== true
  )
    return null
  return value as PrivacyDisclosure
}

function parseConsentDecision(value: unknown) {
  if (
    !isRecord(value) ||
    !isUuid(value.decisionId) ||
    value.consentType !== 'PRIVACY_POLICY' ||
    typeof value.policyVersion !== 'string' ||
    typeof value.granted !== 'boolean' ||
    !isDateTime(value.decidedAt)
  )
    return null
  return value
}

export function parseConsentCollection(
  value: unknown,
): ConsentCollection | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.decisions) ||
    value.decisions.some((item) => !parseConsentDecision(item))
  )
    return null
  return value as ConsentCollection
}

export function parseConsentRequest(
  value: unknown,
): ConsentDecisionRequest | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) => !['consentType', 'policyVersion', 'granted'].includes(key),
    ) ||
    value.consentType !== 'PRIVACY_POLICY' ||
    value.policyVersion !== 'privacy-capstone-v1' ||
    typeof value.granted !== 'boolean'
  )
    return null
  return value as ConsentDecisionRequest
}

function isInstrument(value: unknown): value is Instrument {
  return value === 'PHQ9' || value === 'GAD7'
}

export function parseQuestionnaire(value: unknown): Questionnaire | null {
  if (!isRecord(value)) return null
  if (
    !isUuid(value.definitionId) ||
    !isInstrument(value.instrument) ||
    typeof value.version !== 'string' ||
    typeof value.locale !== 'string' ||
    typeof value.title !== 'string' ||
    !Number.isInteger(value.referencePeriodDays) ||
    !Array.isArray(value.responseOptions) ||
    value.responseOptions.length !== 4 ||
    !Array.isArray(value.questions) ||
    value.questions.length < 1 ||
    value.questions.length > 32
  ) {
    return null
  }

  const responseOptions = value.responseOptions.map((option) => {
    if (
      !isRecord(option) ||
      !Number.isInteger(option.value) ||
      Number(option.value) < 0 ||
      Number(option.value) > 3 ||
      typeof option.label !== 'string' ||
      option.label.length < 1
    ) {
      return null
    }
    return { value: Number(option.value), label: option.label }
  })
  const questions = value.questions.map((question) => {
    if (
      !isRecord(question) ||
      !isUuid(question.questionId) ||
      !Number.isInteger(question.itemNumber) ||
      Number(question.itemNumber) < 1 ||
      typeof question.prompt !== 'string' ||
      question.prompt.length < 1
    ) {
      return null
    }
    return {
      questionId: question.questionId,
      itemNumber: Number(question.itemNumber),
      prompt: question.prompt,
    }
  })

  if (responseOptions.some((option) => option === null)) return null
  if (questions.some((question) => question === null)) return null
  if (new Set(responseOptions.map((option) => option?.value)).size !== 4) {
    return null
  }
  if (
    new Set(questions.map((question) => question?.questionId)).size !==
      questions.length ||
    new Set(questions.map((question) => question?.itemNumber)).size !==
      questions.length
  ) {
    return null
  }

  return {
    definitionId: value.definitionId,
    instrument: value.instrument,
    version: value.version,
    locale: value.locale,
    title: value.title,
    referencePeriodDays: Number(value.referencePeriodDays),
    responseOptions: responseOptions as Questionnaire['responseOptions'],
    questions: (questions as Questionnaire['questions']).toSorted(
      (left, right) => left.itemNumber - right.itemNumber,
    ),
  }
}

export function parseAnonymousSession(value: unknown): AnonymousSession | null {
  if (
    !isRecord(value) ||
    !isUuid(value.sessionId) ||
    typeof value.sessionToken !== 'string' ||
    value.sessionToken.length < 43 ||
    !isDateTime(value.expiresAt)
  ) {
    return null
  }

  return {
    sessionId: value.sessionId,
    sessionToken: value.sessionToken,
    expiresAt: value.expiresAt,
  }
}

function parseResult(value: unknown): AssessmentResult | null {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.totalScore) ||
    Number(value.totalScore) < 0 ||
    Number(value.totalScore) > 27 ||
    !SCREENING_LEVELS.has(value.screeningLevel as ScreeningLevel) ||
    typeof value.scoringVersion !== 'string' ||
    !SAFETY_STATUSES.has(value.safetyStatus as SafetyStatus) ||
    typeof value.safetyPolicyVersion !== 'string' ||
    value.disclaimerCode !== 'SCREENING_NOT_DIAGNOSIS'
  ) {
    return null
  }

  return {
    totalScore: Number(value.totalScore),
    screeningLevel: value.screeningLevel as ScreeningLevel,
    scoringVersion: value.scoringVersion,
    safetyStatus: value.safetyStatus as SafetyStatus,
    safetyPolicyVersion: value.safetyPolicyVersion,
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  }
}

function parseAssessmentBase(value: unknown) {
  if (!isRecord(value)) return null
  const result = parseResult(value.result)

  if (
    !isUuid(value.assessmentId) ||
    !isUuid(value.questionnaireDefinitionId) ||
    !isInstrument(value.instrument) ||
    typeof value.questionnaireVersion !== 'string' ||
    typeof value.privacyPolicyVersion !== 'string' ||
    !isDateTime(value.submittedAt) ||
    (value.voidedAt !== undefined &&
      value.voidedAt !== null &&
      !isDateTime(value.voidedAt)) ||
    !result
  ) {
    return null
  }

  return {
    assessmentId: value.assessmentId,
    questionnaireDefinitionId: value.questionnaireDefinitionId,
    instrument: value.instrument,
    questionnaireVersion: value.questionnaireVersion,
    privacyPolicyVersion: value.privacyPolicyVersion,
    submittedAt: value.submittedAt,
    ...(value.voidedAt === undefined ? {} : { voidedAt: value.voidedAt }),
    result,
  }
}

export function parseAssessment(value: unknown): Assessment | null {
  return parseAssessmentBase(value)
}

export function parseAnonymousAssessment(
  value: unknown,
): AnonymousAssessment | null {
  const base = parseAssessmentBase(value)
  if (!base || !isRecord(value) || !isDateTime(value.expiresAt)) return null
  return { ...base, expiresAt: value.expiresAt }
}

export function parseSubmission(
  value: unknown,
): AssessmentSubmissionRequest | null {
  if (
    !isRecord(value) ||
    !isUuid(value.questionnaireDefinitionId) ||
    value.privacyPolicyVersion !== 'privacy-capstone-v1' ||
    value.privacyDisclosureAcknowledged !== true
  )
    return null
  const keys = Object.keys(value)
  if (
    keys.some(
      (key) =>
        ![
          'questionnaireDefinitionId',
          'privacyPolicyVersion',
          'privacyDisclosureAcknowledged',
          'answers',
        ].includes(key),
    )
  ) {
    return null
  }
  if (
    !Array.isArray(value.answers) ||
    value.answers.length < 1 ||
    value.answers.length > 32
  ) {
    return null
  }

  const answers = value.answers.map((answer) => {
    if (
      !isRecord(answer) ||
      Object.keys(answer).some(
        (key) => !['questionId', 'value'].includes(key),
      ) ||
      !isUuid(answer.questionId) ||
      !Number.isInteger(answer.value) ||
      Number(answer.value) < 0 ||
      Number(answer.value) > 3
    ) {
      return null
    }
    return { questionId: answer.questionId, value: Number(answer.value) }
  })

  if (
    answers.some((answer) => answer === null) ||
    new Set(answers.map((answer) => answer?.questionId)).size !== answers.length
  ) {
    return null
  }

  return {
    questionnaireDefinitionId: value.questionnaireDefinitionId,
    privacyPolicyVersion: 'privacy-capstone-v1',
    privacyDisclosureAcknowledged: true,
    answers: answers as AssessmentSubmissionRequest['answers'],
  }
}

export function parseAssessmentHistory(
  value: unknown,
): AssessmentHistoryPage | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.hasMore !== 'boolean' ||
    (value.nextCursor !== undefined &&
      value.nextCursor !== null &&
      typeof value.nextCursor !== 'string')
  )
    return null
  const items = value.items.map(parseAssessment)
  if (items.some((item) => item === null)) return null
  return {
    items: items as AssessmentHistoryPage['items'],
    nextCursor: value.nextCursor as string | null | undefined,
    hasMore: value.hasMore,
  }
}

export function isCareIdempotencyKey(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[!-~]+$/.test(value)
  )
}
