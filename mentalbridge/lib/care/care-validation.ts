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
  AssessmentProgress,
  AssessmentProgressPoint,
  ScoreDirection,
} from '@/features/assessment/api/care-contract'
import type {
  ValidationResult,
  ValidationViolation,
} from '@/lib/auth/identity-validation'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
  'NOT_APPLICABLE',
])
const INSTRUMENT_MAX_SCORES: Readonly<Record<Instrument, number>> = {
  PHQ9: 27,
  GAD7: 21,
}
const INSTRUMENT_QUESTION_COUNTS: Readonly<Record<Instrument, number>> = {
  PHQ9: 9,
  GAD7: 7,
}
const SCORE_DIRECTIONS = new Set<ScoreDirection>([
  'INCREASED',
  'DECREASED',
  'UNCHANGED',
])

const FORBIDDEN_PROGRESS_FIELDS = new Set([
  'answers',
  'rawAnswers',
  'safetyItemPositive',
  'safetyStatus',
  'safetyPolicyVersion',
  'consent',
  'profile',
])
const DURATION_PATTERN =
  /^PT(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?$/
const RFC3339_DATE_TIME_PATTERN =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[Tt]([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?([Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
const NANOSECONDS_PER_MILLISECOND = 1_000_000

type PreciseMilliseconds = Readonly<{
  milliseconds: number
  subMillisecondNanoseconds: number
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function parseRfc3339Instant(value: unknown): PreciseMilliseconds | null {
  if (typeof value !== 'string') return null
  const match = RFC3339_DATE_TIME_PATTERN.exec(value)
  if (!match) return null

  const [, year, month, day, hour, minute, second, fraction = '', zone] = match
  const local = new Date(0)
  local.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  local.setUTCHours(Number(hour), Number(minute), Number(second), 0)
  if (
    local.getUTCFullYear() !== Number(year) ||
    local.getUTCMonth() !== Number(month) - 1 ||
    local.getUTCDate() !== Number(day) ||
    local.getUTCHours() !== Number(hour) ||
    local.getUTCMinutes() !== Number(minute) ||
    local.getUTCSeconds() !== Number(second)
  ) {
    return null
  }

  let offsetMinutes = 0
  if (zone.toUpperCase() !== 'Z') {
    const sign = zone.startsWith('+') ? 1 : -1
    offsetMinutes =
      sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)))
  }
  const epochMilliseconds = local.getTime() - offsetMinutes * 60_000
  if (!Number.isSafeInteger(epochMilliseconds)) return null

  const fractionNanoseconds = Number(fraction.padEnd(9, '0'))
  return {
    milliseconds:
      epochMilliseconds +
      Math.floor(fractionNanoseconds / NANOSECONDS_PER_MILLISECOND),
    subMillisecondNanoseconds:
      fractionNanoseconds % NANOSECONDS_PER_MILLISECOND,
  }
}

function isDateTime(value: unknown): value is string {
  return parseRfc3339Instant(value) !== null
}

function parseDuration(value: unknown): PreciseMilliseconds | null {
  if (typeof value !== 'string') return null
  const match = DURATION_PATTERN.exec(value)
  if (!match) return null

  const [, hours = '0', minutes = '0', secondsWithFraction = '0'] = match
  const [seconds, fraction = ''] = secondsWithFraction.split('.')
  const wholeMilliseconds =
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000
  const fractionNanoseconds = Number(fraction.padEnd(9, '0'))
  const milliseconds =
    wholeMilliseconds +
    Math.floor(fractionNanoseconds / NANOSECONDS_PER_MILLISECOND)
  if (!Number.isSafeInteger(milliseconds)) return null

  return {
    milliseconds,
    subMillisecondNanoseconds:
      fractionNanoseconds % NANOSECONDS_PER_MILLISECOND,
  }
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
  const result = validateProfileUpdate(value)
  return result.success ? result.value : null
}

export function validateProfileUpdate(
  value: unknown,
  today = new Date(),
): ValidationResult<CareProfileUpdate> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }

  const violations: ValidationViolation[] = []
  const allowedKeys = new Set([
    'displayName',
    'dateOfBirth',
    'gender',
    'locale',
    'timezone',
    'reminderEnabled',
  ])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }
  if (
    typeof value.displayName !== 'string' ||
    value.displayName.trim().length < 1 ||
    value.displayName.length > 120
  ) {
    violations.push({ field: 'displayName', code: 'INVALID_LENGTH' })
  }
  if (
    value.gender !== undefined &&
    value.gender !== null &&
    (typeof value.gender !== 'string' || value.gender.length > 32)
  ) {
    violations.push({ field: 'gender', code: 'INVALID_LENGTH' })
  }
  if (value.locale !== undefined && value.locale !== 'vi-VN') {
    violations.push({ field: 'locale', code: 'INVALID_VALUE' })
  }
  if (value.timezone !== undefined && value.timezone !== 'Asia/Ho_Chi_Minh') {
    violations.push({ field: 'timezone', code: 'INVALID_VALUE' })
  }
  if (value.reminderEnabled !== undefined && value.reminderEnabled !== false) {
    violations.push({ field: 'reminderEnabled', code: 'INVALID_VALUE' })
  }

  let dateOfBirth: string | null | undefined
  if (value.dateOfBirth === undefined || value.dateOfBirth === null) {
    dateOfBirth = value.dateOfBirth
  } else if (
    typeof value.dateOfBirth !== 'string' ||
    parseIsoDate(value.dateOfBirth) === null
  ) {
    violations.push({ field: 'dateOfBirth', code: 'INVALID_DATE' })
  } else {
    dateOfBirth = value.dateOfBirth
    const birth = parseIsoDate(value.dateOfBirth)
    const current = utcDateParts(today)
    if (birth && compareDateParts(birth, current) > 0) {
      violations.push({
        field: 'dateOfBirth',
        code: 'DATE_OF_BIRTH_IN_FUTURE',
      })
    } else if (
      birth &&
      compareDateParts(eighteenthBirthday(birth), current) > 0
    ) {
      violations.push({ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' })
    }
  }

  if (violations.length > 0) return { success: false, violations }

  return {
    success: true,
    value: {
      displayName: (value.displayName as string).trim(),
      ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
      ...(value.gender === undefined
        ? {}
        : { gender: value.gender as string | null }),
    },
  }
}

type DateParts = Readonly<{ year: number; month: number; day: number }>

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const result = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  }
  const date = new Date(Date.UTC(result.year, result.month - 1, result.day))
  return date.getUTCFullYear() === result.year &&
    date.getUTCMonth() === result.month - 1 &&
    date.getUTCDate() === result.day
    ? result
    : null
}

function utcDateParts(value: Date): DateParts {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  }
}

function eighteenthBirthday(birth: DateParts): DateParts {
  const year = birth.year + 18
  const lastDay = new Date(Date.UTC(year, birth.month, 0)).getUTCDate()
  return { year, month: birth.month, day: Math.min(birth.day, lastDay) }
}

function compareDateParts(left: DateParts, right: DateParts) {
  return (
    left.year - right.year || left.month - right.month || left.day - right.day
  )
}

export function parsePrivacyDisclosure(
  value: unknown,
): PrivacyDisclosure | null {
  if (
    !isRecord(value) ||
    value.consentType !== 'PRIVACY_POLICY' ||
    value.version !== 'privacy-capstone-v3' ||
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
    value.policyVersion !== 'privacy-capstone-v3' ||
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
    typeof value.scoringVersion !== 'string' ||
    value.scoringVersion.length < 1 ||
    !Array.isArray(value.responseOptions) ||
    value.responseOptions.length !== 4 ||
    !Array.isArray(value.questions) ||
    value.questions.length !== INSTRUMENT_QUESTION_COUNTS[value.instrument] ||
    !Array.isArray(value.scoreBands) ||
    value.scoreBands.length < 1
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
  const scoreBands = value.scoreBands.map((band) => {
    if (
      !isRecord(band) ||
      !SCREENING_LEVELS.has(band.screeningLevel as ScreeningLevel) ||
      !Number.isInteger(band.minimumScore) ||
      !Number.isInteger(band.maximumScore) ||
      Number(band.minimumScore) < 0 ||
      Number(band.maximumScore) < Number(band.minimumScore)
    ) {
      return null
    }
    return {
      screeningLevel: band.screeningLevel as ScreeningLevel,
      minimumScore: Number(band.minimumScore),
      maximumScore: Number(band.maximumScore),
    }
  })

  if (responseOptions.some((option) => option === null)) return null
  if (questions.some((question) => question === null)) return null
  if (scoreBands.some((band) => band === null)) return null
  if (
    responseOptions
      .map((option) => option?.value)
      .toSorted((left, right) => Number(left) - Number(right))
      .join(',') !== '0,1,2,3'
  ) {
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
  const sortedQuestions = (questions as Questionnaire['questions']).toSorted(
    (left, right) => left.itemNumber - right.itemNumber,
  )
  if (
    sortedQuestions.some((question, index) => question.itemNumber !== index + 1)
  ) {
    return null
  }
  const sortedBands = (scoreBands as Questionnaire['scoreBands']).toSorted(
    (left, right) => left.minimumScore - right.minimumScore,
  )
  if (
    new Set(sortedBands.map((band) => band.screeningLevel)).size !==
      sortedBands.length ||
    sortedBands[0]?.minimumScore !== 0 ||
    sortedBands.at(-1)?.maximumScore !==
      INSTRUMENT_MAX_SCORES[value.instrument] ||
    sortedBands.some(
      (band, index) =>
        index > 0 &&
        band.minimumScore !== sortedBands[index - 1].maximumScore + 1,
    )
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
    scoringVersion: value.scoringVersion,
    responseOptions: responseOptions as Questionnaire['responseOptions'],
    questions: sortedQuestions,
    scoreBands: sortedBands,
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

function parseResult(
  value: unknown,
  instrument: Instrument,
): AssessmentResult | null {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.totalScore) ||
    Number(value.totalScore) < 0 ||
    Number(value.totalScore) > INSTRUMENT_MAX_SCORES[instrument] ||
    !SCREENING_LEVELS.has(value.screeningLevel as ScreeningLevel) ||
    typeof value.scoringVersion !== 'string' ||
    !SAFETY_STATUSES.has(value.safetyStatus as SafetyStatus) ||
    value.disclaimerCode !== 'SCREENING_NOT_DIAGNOSIS'
  ) {
    return null
  }

  const safetyStatus = value.safetyStatus as SafetyStatus
  const hasValidSafetyProvenance =
    instrument === 'PHQ9'
      ? safetyStatus !== 'NOT_APPLICABLE' &&
        typeof value.safetyPolicyVersion === 'string' &&
        value.safetyPolicyVersion.length > 0
      : safetyStatus === 'NOT_APPLICABLE' && value.safetyPolicyVersion === null
  if (!hasValidSafetyProvenance) return null

  return {
    totalScore: Number(value.totalScore),
    screeningLevel: value.screeningLevel as ScreeningLevel,
    scoringVersion: value.scoringVersion,
    safetyStatus,
    safetyPolicyVersion: value.safetyPolicyVersion as string | null,
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  }
}

function parseAssessmentBase(value: unknown) {
  if (!isRecord(value)) return null
  if (!isInstrument(value.instrument)) return null
  const result = parseResult(value.result, value.instrument)

  if (
    !isUuid(value.assessmentId) ||
    !isUuid(value.questionnaireDefinitionId) ||
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
    value.privacyPolicyVersion !== 'privacy-capstone-v3' ||
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
    privacyPolicyVersion: 'privacy-capstone-v3',
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

function parseProgressPoint(
  value: unknown,
  instrument: Instrument,
): AssessmentProgressPoint | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => FORBIDDEN_PROGRESS_FIELDS.has(key)) ||
    !isUuid(value.assessmentId) ||
    typeof value.questionnaireVersion !== 'string' ||
    value.questionnaireVersion.length < 1 ||
    value.questionnaireVersion.length > 32 ||
    !isDateTime(value.submittedAt) ||
    !Number.isInteger(value.totalScore) ||
    Number(value.totalScore) < 0 ||
    Number(value.totalScore) > INSTRUMENT_MAX_SCORES[instrument] ||
    !SCREENING_LEVELS.has(value.screeningLevel as ScreeningLevel)
  )
    return null
  return {
    assessmentId: value.assessmentId,
    questionnaireVersion: value.questionnaireVersion,
    submittedAt: value.submittedAt,
    totalScore: Number(value.totalScore),
    screeningLevel: value.screeningLevel as ScreeningLevel,
  }
}

export function parseAssessmentProgress(
  value: unknown,
  expectedAssessmentId: string,
): AssessmentProgress | null {
  if (
    !isRecord(value) ||
    !isUuid(expectedAssessmentId) ||
    Object.keys(value).some((key) => FORBIDDEN_PROGRESS_FIELDS.has(key))
  )
    return null

  if (!isInstrument(value.instrument)) return null
  const previous = parseProgressPoint(value.previous, value.instrument)
  const current = parseProgressPoint(value.current, value.instrument)
  if (
    typeof value.scoringVersion !== 'string' ||
    value.scoringVersion.length < 1 ||
    value.scoringVersion.length > 32 ||
    !previous ||
    !current ||
    previous.assessmentId.toLowerCase() ===
      current.assessmentId.toLowerCase() ||
    current.assessmentId.toLowerCase() !== expectedAssessmentId.toLowerCase() ||
    !Number.isInteger(value.rawDelta) ||
    Number(value.rawDelta) < -INSTRUMENT_MAX_SCORES[value.instrument] ||
    Number(value.rawDelta) > INSTRUMENT_MAX_SCORES[value.instrument] ||
    !SCORE_DIRECTIONS.has(value.scoreDirection as ScoreDirection) ||
    !isRecord(value.bandTransition) ||
    Object.keys(value.bandTransition).some((key) =>
      FORBIDDEN_PROGRESS_FIELDS.has(key),
    ) ||
    !SCREENING_LEVELS.has(value.bandTransition.previous as ScreeningLevel) ||
    !SCREENING_LEVELS.has(value.bandTransition.current as ScreeningLevel) ||
    typeof value.elapsedDuration !== 'string'
  )
    return null

  const rawDelta = current.totalScore - previous.totalScore
  const direction: ScoreDirection =
    rawDelta > 0 ? 'INCREASED' : rawDelta < 0 ? 'DECREASED' : 'UNCHANGED'
  const previousSubmittedAt = parseRfc3339Instant(previous.submittedAt)
  const currentSubmittedAt = parseRfc3339Instant(current.submittedAt)
  const elapsedDuration = parseDuration(value.elapsedDuration)
  if (
    previousSubmittedAt === null ||
    currentSubmittedAt === null ||
    elapsedDuration === null
  )
    return null

  let calculatedMilliseconds =
    currentSubmittedAt.milliseconds - previousSubmittedAt.milliseconds
  let calculatedSubMillisecondNanoseconds =
    currentSubmittedAt.subMillisecondNanoseconds -
    previousSubmittedAt.subMillisecondNanoseconds
  if (calculatedSubMillisecondNanoseconds < 0) {
    calculatedMilliseconds -= 1
    calculatedSubMillisecondNanoseconds += NANOSECONDS_PER_MILLISECOND
  }
  if (
    value.rawDelta !== rawDelta ||
    value.scoreDirection !== direction ||
    value.bandTransition.previous !== previous.screeningLevel ||
    value.bandTransition.current !== current.screeningLevel ||
    calculatedMilliseconds < 0 ||
    elapsedDuration.milliseconds !== calculatedMilliseconds ||
    elapsedDuration.subMillisecondNanoseconds !==
      calculatedSubMillisecondNanoseconds
  )
    return null

  return {
    instrument: value.instrument,
    scoringVersion: value.scoringVersion,
    previous,
    current,
    rawDelta,
    scoreDirection: direction,
    bandTransition: {
      previous: previous.screeningLevel,
      current: current.screeningLevel,
    },
    elapsedDuration: value.elapsedDuration,
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
