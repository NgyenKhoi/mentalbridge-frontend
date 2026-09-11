import { createServer } from 'node:http'

const host = '127.0.0.1'
const port = Number.parseInt(process.env.IDENTITY_E2E_PORT ?? '3201', 10)
const correlationId = '62cda42f-b286-43c6-aa48-88ef64ff3361'
const timestamps = {
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}
const contentResources = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    category: 'ARTICLE',
    locale: 'en-US',
    title: 'Published Resource',
    summary: 'Reviewed support content from the controlled provider fixture.',
    externalUrl: 'https://example.com/reviewed-resource',
    status: 'PUBLISHED',
    reviewedAt: '2026-08-01T00:00:00Z',
    ...timestamps,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    category: 'ARTICLE',
    locale: 'en-US',
    title: 'Draft Resource',
    summary: 'This resource must never reach the browser.',
    externalUrl: null,
    status: 'DRAFT',
    reviewedAt: null,
    ...timestamps,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    category: 'ARTICLE',
    locale: 'en-US',
    title: 'Archived Resource',
    summary: 'This resource must never reach the browser.',
    externalUrl: null,
    status: 'ARCHIVED',
    reviewedAt: '2026-07-01T00:00:00Z',
    ...timestamps,
  },
]

const actors = new Map([
  [
    'user@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000001',
      roles: ['USER'],
      initialAccessExpired: false,
    },
  ],
  [
    'refresh@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000002',
      roles: ['USER'],
      initialAccessExpired: true,
    },
  ],
  [
    'specialist@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000003',
      roles: ['SPECIALIST'],
      initialAccessExpired: false,
    },
  ],
  [
    'care-e2e@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000004',
      roles: ['USER'],
      initialAccessExpired: false,
    },
  ],
  [
    'resource-e2e@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000005',
      roles: ['USER'],
      initialAccessExpired: false,
    },
  ],
  [
    'mb273-e2e@example.com',
    {
      accountId: '10000000-0000-4000-8000-000000000007',
      roles: ['USER'],
      initialAccessExpired: false,
    },
  ],
])

const accessSessions = new Map()
const refreshSessions = new Map()
const anonymousCareSessions = new Map()
const anonymousAssessments = new Map()
const authenticatedAssessments = new Map()
const supportEvaluations = new Map()
const supportEvaluationByPair = new Map()
const careProfiles = new Map()
const careConsents = new Map()
const journalEntries = new Map()
const journalCommands = new Map()
const careAccessToken = 'synthetic-care-e2e-access'
const otherCareAccessToken = 'synthetic-care-e2e-other-access'
const careActor = actors.get('care-e2e@example.com')
const otherCareActor = actors.get('user@example.com')
const resourceAccessToken = 'synthetic-resource-e2e-access'
const resourceActor = actors.get('resource-e2e@example.com')
const releaseAccessToken = 'synthetic-mb273-e2e-access'
const releaseActor = actors.get('mb273-e2e@example.com')
let careNow = new Date('2098-01-01T00:00:00Z')
let progressFault = null
let questionnaireFault = null
let contentFault = null
let journalConflictOnce = false
accessSessions.set(careAccessToken, careActor)
accessSessions.set(otherCareAccessToken, otherCareActor)
accessSessions.set(resourceAccessToken, resourceActor)
accessSessions.set(releaseAccessToken, releaseActor)
const state = {
  loginCount: 0,
  accountCount: 0,
  refreshCount: 0,
  logoutCount: 0,
  logoutAllCount: 0,
  verificationRequestCount: 0,
  passwordRecoveryRequestCount: 0,
  passwordResetCount: 0,
  passwordChangeCount: 0,
  questionnaireCount: 0,
  anonymousAssessmentCount: 0,
  authenticatedAssessmentCount: 0,
}

function reset() {
  accessSessions.clear()
  refreshSessions.clear()
  anonymousCareSessions.clear()
  anonymousAssessments.clear()
  authenticatedAssessments.clear()
  supportEvaluations.clear()
  supportEvaluationByPair.clear()
  careProfiles.clear()
  careConsents.clear()
  journalEntries.clear()
  journalCommands.clear()
  accessSessions.set(careAccessToken, careActor)
  accessSessions.set(otherCareAccessToken, otherCareActor)
  accessSessions.set(resourceAccessToken, resourceActor)
  accessSessions.set(releaseAccessToken, releaseActor)
  careNow = new Date('2098-01-01T00:00:00Z')
  progressFault = null
  questionnaireFault = null
  contentFault = null
  journalConflictOnce = false
  careProfiles.set(careActor.accountId, {
    accountId: careActor.accountId,
    displayName: 'Care E2E User',
    dateOfBirth: '2000-01-01',
    gender: null,
    locale: 'vi-VN',
    timezone: 'Asia/Ho_Chi_Minh',
    reminderEnabled: false,
    ...timestamps,
    version: 0,
  })
  careConsents.set(otherCareActor.accountId, {
    decisionId: '30000000-0000-4000-8000-000000000001',
    consentType: 'PRIVACY_POLICY',
    policyVersion: 'privacy-capstone-v3',
    granted: true,
    decidedAt: careNow.toISOString(),
  })
  Object.keys(state).forEach((key) => {
    state[key] = 0
  })
}

function json(response, status, body, contentType = 'application/json') {
  response.writeHead(status, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'X-Correlation-Id': correlationId,
  })
  response.end(JSON.stringify(body))
}

function problem(response, status, code, title) {
  json(
    response,
    status,
    {
      type: 'about:blank',
      title,
      status,
      code,
      correlationId,
    },
    'application/problem+json',
  )
}

async function readBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > 16_384) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function tokenPair(actor, suffix) {
  const accessToken = `synthetic-access-${suffix}`
  const refreshToken = `synthetic-refresh-${suffix}-${'r'.repeat(43)}`
  accessSessions.set(accessToken, actor)
  refreshSessions.set(refreshToken, actor)

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken,
    refreshExpiresAt: '2099-01-01T00:00:00Z',
  }
}

function account(actor) {
  return {
    accountId: actor.accountId,
    email: [...actors.entries()].find(([, value]) => value === actor)?.[0],
    status: 'ACTIVE',
    roles: actor.roles,
    emailVerified: true,
    ...timestamps,
    version: 0,
  }
}

function bearerToken(request) {
  const authorization = request.headers.authorization ?? ''
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
}

function journalActor(request, response) {
  const actor = accessSessions.get(bearerToken(request))
  if (!actor || !actor.roles.includes('USER')) {
    problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
    return null
  }
  return actor
}

function journalCommand(actor, request, fingerprint) {
  const key = request.headers['idempotency-key']
  if (typeof key !== 'string') return { error: 'missing' }
  const commandKey = `${actor.accountId}:${key}`
  const existing = journalCommands.get(commandKey)
  if (!existing) return { commandKey }
  if (existing.fingerprint !== fingerprint) return { error: 'conflict' }
  return { replay: existing }
}

function journalEntry(actor, body) {
  const now = new Date().toISOString()
  return {
    id: body.clientEntryId,
    ownerAccountId: actor.accountId,
    currentRevision: 1,
    occurredAt: body.occurredAt,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    tags: body.tags ?? [],
    encryption: {
      algorithm: 'AES-256-GCM',
      keyId: 'e2e-v1',
      encryptedAt: now,
    },
    analysisState: 'not_requested',
    content: {
      text: body.content.text,
      byteLength: Buffer.byteLength(body.content.text, 'utf8'),
    },
  }
}

function journalSummary(entry) {
  return {
    ...entry,
    content: {
      preview: Array.from(entry.content.text).slice(0, 160).join(''),
      byteLength: entry.content.byteLength,
    },
  }
}

const careDefinitionId = '20000000-0000-4000-8000-000000000001'
const careQuestionIds = Array.from(
  { length: 9 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
)
const careQuestionPrompts = [
  'Ít quan tâm hoặc niềm vui khi làm việc',
  'Cảm thấy chán nản, buồn rầu hoặc vô vọng',
  'Khó ngủ hoặc duy trì giấc ngủ, hoặc ngủ quá nhiều',
  'Cảm thấy mệt mỏi hoặc có ít năng lượng',
  'Kém ăn hoặc ăn quá nhiều',
  'Cảm thấy tồi tệ về bản thân - hoặc rằng bạn là một kẻ thất bại hoặc đã khiến bản thân hoặc gia đình thất vọng',
  'Khó tập trung vào mọi thứ, chẳng hạn như đọc báo hoặc xem tivi',
  'Di chuyển hoặc nói chậm đến mức người khác có thể nhận thấy? Hoặc ngược lại - bồn chồn hoặc bồn chồn đến mức bạn đã di chuyển xung quanh nhiều hơn bình thường',
  'Suy nghĩ rằng tốt hơn hết là bạn nên chết hoặc làm tổn thương bản thân theo một cách nào đó',
]
const careQuestionnaire = {
  definitionId: careDefinitionId,
  instrument: 'PHQ9',
  version: 'phq9-vi-vn-capstone-v2',
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
  questions: careQuestionPrompts.map((prompt, index) => ({
    questionId: careQuestionIds[index],
    itemNumber: index + 1,
    prompt,
  })),
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

const gadDefinitionId = '20000000-0000-4000-8000-000000000020'
const gadQuestionIds = Array.from(
  { length: 7 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 21).padStart(12, '0')}`,
)
const gadQuestionnaire = {
  definitionId: gadDefinitionId,
  instrument: 'GAD7',
  version: 'gad7-vi-vn-adult-v1',
  locale: 'vi-VN',
  title: 'GAD-7 — Sàng lọc triệu chứng lo âu',
  referencePeriodDays: 14,
  scoringVersion: 'gad7-standard-bands-v1',
  responseOptions: [
    { value: 0, label: 'Không bao giờ (0 ngày nào)' },
    { value: 1, label: 'Vài ngày (1-7 ngày)' },
    { value: 2, label: 'Hơn một nửa số ngày (8-10 ngày)' },
    { value: 3, label: 'Gần như hàng ngày (11-14 ngày)' },
  ],
  questions: [
    'Cảm giác hồi hộp, lo lắng hoặc cáu kỉnh',
    'Không thể dừng hoặc kiểm soát được việc lo lắng',
    'Lo lắng quá nhiều về những điều khác nhau',
    'Không thể thư giãn được',
    'Cảm thấy bồn chồn đến mức mà khó có thể ngồi yên một chỗ',
    'Trở nên dễ bực mình hoặc cáu kỉnh',
    'Cảm thấy sợ như thể có một điều gì đó khủng khiếp có thể xảy ra',
  ].map((prompt, index) => ({
    questionId: gadQuestionIds[index],
    itemNumber: index + 1,
    prompt,
  })),
  scoreBands: [
    { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 4 },
    { screeningLevel: 'MILD', minimumScore: 5, maximumScore: 9 },
    { screeningLevel: 'MODERATE', minimumScore: 10, maximumScore: 14 },
    { screeningLevel: 'SEVERE', minimumScore: 15, maximumScore: 21 },
  ],
}
const careQuestionnaires = new Map([
  [careQuestionnaire.definitionId, careQuestionnaire],
  [gadQuestionnaire.definitionId, gadQuestionnaire],
])

function careAssessment(assessmentId, body, expiresAt) {
  const questionnaire = careQuestionnaires.get(body.questionnaireDefinitionId)
  const totalScore = body.answers.reduce((sum, answer) => sum + answer.value, 0)
  const band = questionnaire.scoreBands.find(
    ({ minimumScore, maximumScore }) =>
      totalScore >= minimumScore && totalScore <= maximumScore,
  )
  const safetyAnswer =
    questionnaire.instrument === 'PHQ9'
      ? body.answers.find((answer) => answer.questionId === careQuestionIds[8])
      : null
  return {
    assessmentId,
    questionnaireDefinitionId: questionnaire.definitionId,
    instrument: questionnaire.instrument,
    questionnaireVersion: questionnaire.version,
    privacyPolicyVersion: 'privacy-capstone-v3',
    submittedAt: careNow.toISOString(),
    voidedAt: null,
    result: {
      totalScore,
      screeningLevel: band.screeningLevel,
      scoringVersion: questionnaire.scoringVersion,
      safetyStatus:
        questionnaire.instrument === 'GAD7'
          ? 'NOT_APPLICABLE'
          : safetyAnswer?.value >= 1
            ? 'POSITIVE_SAFETY_SCREEN'
            : 'NEGATIVE_SAFETY_SCREEN',
      safetyPolicyVersion:
        questionnaire.instrument === 'GAD7'
          ? null
          : 'MB-SAFETY-PHQ9-001/1.0-capstone',
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
    ...(expiresAt ? { expiresAt } : {}),
  }
}

function supportEvaluation(phq9, gad7) {
  const safetyPositive = phq9.result.safetyStatus === 'POSITIVE_SAFETY_SCREEN'
  const moderateOrHigher = new Set(['MODERATE', 'MODERATELY_SEVERE', 'SEVERE'])
  const professional =
    moderateOrHigher.has(phq9.result.screeningLevel) ||
    moderateOrHigher.has(gad7.result.screeningLevel)
  const supportTier = safetyPositive
    ? 'SAFETY_FOLLOW_UP_RECOMMENDED'
    : professional
      ? 'PROFESSIONAL_SUPPORT_RECOMMENDED'
      : 'SELF_GUIDED_SUPPORT'
  const reasonCodes = safetyPositive
    ? ['PHQ9_SAFETY_SCREEN_POSITIVE']
    : professional
      ? [
          ...(moderateOrHigher.has(phq9.result.screeningLevel)
            ? ['PHQ9_MODERATE_OR_HIGHER']
            : []),
          ...(moderateOrHigher.has(gad7.result.screeningLevel)
            ? ['GAD7_MODERATE_OR_HIGHER']
            : []),
        ]
      : ['ALL_SCREENING_LEVELS_MINIMAL_OR_MILD']
  const meaning = (assessment) => ({
    meaningCode: `${assessment.instrument}_${assessment.result.screeningLevel}_14D`,
    contentVersion: 'mb-screening-meaning-vi-vn-v1',
    referencePeriodDays: 14,
    text: `Câu trả lời ${assessment.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} của bạn thuộc mức triệu chứng ${assessment.result.screeningLevel === 'MINIMAL' ? 'tối thiểu' : assessment.result.screeningLevel === 'MILD' ? 'nhẹ' : assessment.result.screeningLevel === 'MODERATE' ? 'trung bình' : 'nặng'} trong 14 ngày qua.`,
    limitation:
      'Kết quả này chỉ phản ánh câu trả lời tự khai trong 14 ngày qua. Đây là sàng lọc triệu chứng, không phải chẩn đoán y khoa và không thể hiện mức độ bệnh lý tổng thể.',
  })
  const nextStep = safetyPositive
    ? {
        code: 'REVIEW_SAFETY_GUIDANCE',
        contentVersion: 'mb-safety-guidance-vi-vn-v1',
        text: 'Ưu tiên xem hướng dẫn an toàn ngay bên dưới và chủ động tìm hỗ trợ trực tiếp nếu bạn cảm thấy không an toàn.',
        boundary:
          'Kết quả này không xác định ý định, kế hoạch hay mức độ khẩn cấp. MentalBridge không tự động liên hệ người khác, đặt lịch hoặc chia sẻ dữ liệu.',
      }
    : professional
      ? {
          code: 'CONSIDER_PROFESSIONAL_SUPPORT',
          contentVersion: 'mb-support-next-step-vi-vn-v1',
          text: 'Bạn có thể cân nhắc chủ động tìm sự hỗ trợ từ một chuyên gia phù hợp nếu mong muốn.',
          boundary:
            'MentalBridge chưa liên hệ chuyên gia, đặt lịch hoặc chia sẻ dữ liệu của bạn; các hành động đó cần quy trình và sự đồng ý riêng.',
        }
      : {
          code: 'REVIEW_SELF_GUIDED_RESOURCE',
          contentVersion: 'mb-support-next-step-vi-vn-v1',
          text: 'Bạn có thể chọn một tài nguyên tự hỗ trợ đã được MentalBridge rà soát và tiếp tục theo dõi cảm nhận của mình.',
          boundary:
            'Không có cuộc hẹn, liên hệ với chuyên gia, chia sẻ dữ liệu hoặc can thiệp tự động nào được thực hiện.',
        }

  return {
    supportEvaluationId: crypto.randomUUID(),
    policyVersion: 'mb-support-routing-capstone-v1',
    evaluatedAt: careNow.toISOString(),
    supportTier,
    reasonCodes,
    evidence: [phq9, gad7].map((assessment) => ({
      assessmentId: assessment.assessmentId,
      instrument: assessment.instrument,
      questionnaireVersion: assessment.questionnaireVersion,
      scoringVersion: assessment.result.scoringVersion,
      screeningLevel: assessment.result.screeningLevel,
      safetyStatus: assessment.result.safetyStatus,
      meaning: meaning(assessment),
    })),
    nextStep,
    safetyGuidance: safetyPositive
      ? 'Nếu bạn cảm thấy mình không an toàn hoặc có nguy cơ gây hại cho bản thân, hãy chủ động liên hệ dịch vụ khẩn cấp hoặc cơ sở y tế phù hợp tại khu vực của bạn.'
      : null,
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    disclaimer:
      'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, { status: 'UP' })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/resources') {
      if (contentFault === 'UNAVAILABLE') {
        problem(
          response,
          503,
          'CONTENT_UNAVAILABLE',
          'Reviewed resources are unavailable',
        )
        return
      }
      json(response, 200, {
        data: contentResources,
        count: contentResources.length,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/__test/content-fault') {
      const mode = url.searchParams.get('mode')
      if (!['UNAVAILABLE', 'CLEAR'].includes(mode)) {
        problem(response, 400, 'VALIDATION_FAILED', 'Unsupported fault mode')
        return
      }
      contentFault = mode === 'CLEAR' ? null : mode
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === 'POST' && url.pathname === '/__test/reset') {
      reset()
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === 'GET' && url.pathname === '/__test/state') {
      json(response, 200, {
        ...state,
        activeAccessSessionCount: [...accessSessions.keys()].filter(
          (token) =>
            token !== careAccessToken &&
            token !== otherCareAccessToken &&
            token !== resourceAccessToken &&
            token !== releaseAccessToken,
        ).length,
        activeRefreshSessionCount: refreshSessions.size,
      })
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/__test/journal/conflict'
    ) {
      const mode = url.searchParams.get('mode')
      if (!['NEXT_PATCH', 'CLEAR'].includes(mode)) {
        problem(response, 400, 'VALIDATION_FAILED', 'Unsupported fault mode')
        return
      }
      journalConflictOnce = mode === 'NEXT_PATCH'
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/journals') {
      const actor = journalActor(request, response)
      if (!actor) return
      const items = [...journalEntries.values()]
        .filter(
          (entry) =>
            entry.ownerAccountId === actor.accountId && entry.deleted === false,
        )
        .sort(
          (left, right) =>
            right.occurredAt.localeCompare(left.occurredAt) ||
            right.createdAt.localeCompare(left.createdAt) ||
            right.id.localeCompare(left.id),
        )
        .map(journalSummary)
      json(response, 200, {
        items,
        page: { limit: 20, hasMore: false },
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/journals') {
      const actor = journalActor(request, response)
      if (!actor) return
      const body = await readBody(request)
      const fingerprint = `create:${JSON.stringify(body)}`
      const command = journalCommand(actor, request, fingerprint)
      if (command.error === 'missing') {
        problem(
          response,
          400,
          'VALIDATION_FAILED',
          'Idempotency key is required',
        )
        return
      }
      if (command.error === 'conflict') {
        problem(response, 409, 'CONFLICT', 'Idempotency key was reused')
        return
      }
      if (command.replay) {
        json(response, command.replay.status, command.replay.body)
        return
      }
      if (journalEntries.has(body.clientEntryId)) {
        problem(response, 409, 'CONFLICT', 'Journal entry already exists')
        return
      }
      const created = journalEntry(actor, body)
      journalEntries.set(created.id, created)
      journalCommands.set(command.commandKey, {
        fingerprint,
        status: 201,
        body: structuredClone(created),
      })
      json(response, 201, created)
      return
    }

    const journalResource = url.pathname.match(
      /^\/api\/v1\/journals\/([0-9a-f-]+)$/i,
    )
    if (journalResource) {
      const actor = journalActor(request, response)
      if (!actor) return
      const entry = journalEntries.get(journalResource[1])
      if (
        !entry ||
        entry.ownerAccountId !== actor.accountId ||
        entry.deleted === true
      ) {
        problem(response, 404, 'NOT_FOUND', 'Journal entry was not found')
        return
      }

      if (request.method === 'GET') {
        json(response, 200, entry)
        return
      }

      if (request.method === 'PATCH') {
        const body = await readBody(request)
        const expectedRevision = Number.parseInt(
          String(request.headers['if-match-revision'] ?? ''),
          10,
        )
        const fingerprint = `revise:${entry.id}:${expectedRevision}:${JSON.stringify(body)}`
        const command = journalCommand(actor, request, fingerprint)
        if (command.error === 'missing') {
          problem(
            response,
            400,
            'VALIDATION_FAILED',
            'Idempotency key is required',
          )
          return
        }
        if (command.error === 'conflict') {
          problem(response, 409, 'CONFLICT', 'Idempotency key was reused')
          return
        }
        if (command.replay) {
          json(response, command.replay.status, command.replay.body)
          return
        }
        if (journalConflictOnce) {
          journalConflictOnce = false
          const updatedAt = new Date().toISOString()
          Object.assign(entry, {
            currentRevision: entry.currentRevision + 1,
            updatedAt,
            tags: ['remote-update'],
            encryption: { ...entry.encryption, encryptedAt: updatedAt },
            analysisState: 'stale',
            content: {
              text: 'Authoritative update from another session',
              byteLength: 41,
            },
          })
          problem(response, 412, 'PRECONDITION_FAILED', 'Revision conflict')
          return
        }
        if (expectedRevision !== entry.currentRevision) {
          problem(response, 412, 'PRECONDITION_FAILED', 'Revision conflict')
          return
        }
        const updatedAt = new Date().toISOString()
        Object.assign(entry, {
          currentRevision: entry.currentRevision + 1,
          updatedAt,
          tags: body.tags ?? entry.tags,
          encryption: { ...entry.encryption, encryptedAt: updatedAt },
          analysisState: 'stale',
          content: {
            text: body.content.text,
            byteLength: Buffer.byteLength(body.content.text, 'utf8'),
          },
        })
        const result = structuredClone(entry)
        journalCommands.set(command.commandKey, {
          fingerprint,
          status: 200,
          body: result,
        })
        json(response, 200, result)
        return
      }

      if (request.method === 'DELETE') {
        const fingerprint = `delete:${entry.id}`
        const command = journalCommand(actor, request, fingerprint)
        if (command.error === 'missing') {
          problem(
            response,
            400,
            'VALIDATION_FAILED',
            'Idempotency key is required',
          )
          return
        }
        if (command.error === 'conflict') {
          problem(response, 409, 'CONFLICT', 'Idempotency key was reused')
          return
        }
        if (command.replay) {
          json(response, command.replay.status, command.replay.body)
          return
        }
        const tombstone = {
          id: entry.id,
          ownerAccountId: actor.accountId,
          deleted: true,
          deletedAt: new Date().toISOString(),
        }
        entry.deleted = true
        journalCommands.set(command.commandKey, {
          fingerprint,
          status: 200,
          body: tombstone,
        })
        json(response, 200, tombstone)
        return
      }
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/api/v1/privacy-disclosures/current'
    ) {
      json(response, 200, {
        consentType: 'PRIVACY_POLICY',
        version: 'privacy-capstone-v3',
        locale: 'vi-VN',
        title: 'Thông báo và đồng ý xử lý dữ liệu sàng lọc',
        content:
          'MentalBridge xử lý các câu trả lời PHQ-9 hoặc GAD-7 và kết quả sàng lọc được tính từ các câu trả lời đó nhằm cung cấp chức năng sàng lọc sức khỏe tâm lý. Đối với người dùng đã đăng nhập, MentalBridge có thể lưu kết quả sàng lọc cùng thông tin cần thiết của tài khoản để hiển thị lịch sử và hỗ trợ bạn thực hiện lại bài sàng lọc. Đối với phiên ẩn danh, dữ liệu chỉ được xử lý trong phạm vi của phiên ẩn danh theo chính sách hiện hành và không tự động được gắn vào tài khoản được tạo sau đó. Kết quả PHQ-9 và GAD-7 chỉ mang tính sàng lọc, không phải chẩn đoán y khoa và không thay thế đánh giá hoặc tư vấn của chuyên gia. Sự đồng ý này chỉ áp dụng cho việc xử lý dữ liệu cần thiết để thực hiện và lưu kết quả bài sàng lọc. Sự đồng ý này không bao gồm xử lý dữ liệu bằng AI, sử dụng dữ liệu cho nghiên cứu, tiếp thị hoặc chia sẻ dữ liệu với chuyên gia. Các mục đích đó, nếu được triển khai, phải có quyết định đồng ý riêng. Bạn có thể rút lại sự đồng ý đối với các hoạt động xử lý mới trong tương lai. Việc rút lại sự đồng ý không tự động xóa dữ liệu đã được lưu trước đó; yêu cầu xóa dữ liệu là một quy trình riêng theo chính sách hiện hành.',
        capstoneOnly: true,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/consents') {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const decision = careConsents.get(actor.accountId)
      json(response, 200, { decisions: decision ? [decision] : [] })
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/consent-decisions'
    ) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const body = await readBody(request)
      const decision = {
        decisionId: crypto.randomUUID(),
        consentType: 'PRIVACY_POLICY',
        policyVersion: 'privacy-capstone-v3',
        granted: body.granted === true,
        decidedAt: new Date().toISOString(),
      }
      careConsents.set(actor.accountId, decision)
      json(response, 201, decision)
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/__test/care/initial-check-fault'
    ) {
      const mode = url.searchParams.get('mode')
      if (mode !== 'GAD_UNAVAILABLE') {
        problem(response, 400, 'VALIDATION_FAILED', 'Unsupported fault mode')
        return
      }
      questionnaireFault = mode
      response.writeHead(204)
      response.end()
      return
    }

    const currentQuestionnaireGet = url.pathname.match(
      /^\/api\/v1\/questionnaires\/(PHQ9|GAD7)\/current$/,
    )
    if (request.method === 'GET' && currentQuestionnaireGet) {
      if (url.searchParams.get('locale') !== 'vi-VN') {
        problem(
          response,
          404,
          'QUESTIONNAIRE_NOT_FOUND',
          'Questionnaire not found',
        )
        return
      }
      if (
        currentQuestionnaireGet[1] === 'GAD7' &&
        questionnaireFault === 'GAD_UNAVAILABLE'
      ) {
        questionnaireFault = null
        problem(
          response,
          503,
          'QUESTIONNAIRE_UNAVAILABLE',
          'GAD-7 is unavailable',
        )
        return
      }
      state.questionnaireCount += 1
      json(
        response,
        200,
        currentQuestionnaireGet[1] === 'GAD7'
          ? gadQuestionnaire
          : careQuestionnaire,
      )
      return
    }

    const questionnaireDefinitionGet = url.pathname.match(
      /^\/api\/v1\/questionnaires\/definitions\/([^/]+)$/,
    )
    if (request.method === 'GET' && questionnaireDefinitionGet) {
      const questionnaire = careQuestionnaires.get(
        questionnaireDefinitionGet[1],
      )
      if (!questionnaire) {
        problem(
          response,
          404,
          'QUESTIONNAIRE_NOT_FOUND',
          'Questionnaire not found',
        )
        return
      }
      json(response, 200, questionnaire)
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/anonymous-assessment-sessions'
    ) {
      const sessionId = crypto.randomUUID()
      const sessionToken = `synthetic-anonymous-${'a'.repeat(43)}`
      const expiresAt = '2099-01-01T00:30:00Z'
      anonymousCareSessions.set(sessionId, { sessionToken, expiresAt })
      json(response, 201, { sessionId, sessionToken, expiresAt })
      return
    }

    const anonymousSubmit = url.pathname.match(
      /^\/api\/v1\/anonymous-assessment-sessions\/([^/]+)\/assessments$/,
    )
    if (request.method === 'POST' && anonymousSubmit) {
      const sessionId = anonymousSubmit[1]
      const session = anonymousCareSessions.get(sessionId)
      if (
        !session ||
        request.headers['x-anonymous-session-token'] !== session.sessionToken
      ) {
        problem(response, 401, 'INVALID_ANONYMOUS_SESSION', 'Invalid session')
        return
      }
      const body = await readBody(request)
      const questionnaire = careQuestionnaires.get(
        body.questionnaireDefinitionId,
      )
      if (
        questionnaire?.instrument !== 'PHQ9' ||
        body.privacyPolicyVersion !== 'privacy-capstone-v3' ||
        body.privacyDisclosureAcknowledged !== true ||
        Object.hasOwn(body, 'totalScore')
      ) {
        problem(response, 400, 'VALIDATION_FAILED', 'Invalid submission')
        return
      }
      const assessmentId = crypto.randomUUID()
      const assessment = careAssessment(assessmentId, body, session.expiresAt)
      anonymousAssessments.set(`${sessionId}:${assessmentId}`, assessment)
      state.anonymousAssessmentCount += 1
      json(response, 201, assessment)
      return
    }

    const anonymousGet = url.pathname.match(
      /^\/api\/v1\/anonymous-assessment-sessions\/([^/]+)\/assessments\/([^/]+)$/,
    )
    if (request.method === 'GET' && anonymousGet) {
      const [, sessionId, assessmentId] = anonymousGet
      const session = anonymousCareSessions.get(sessionId)
      const assessment = anonymousAssessments.get(
        `${sessionId}:${assessmentId}`,
      )
      if (
        !session ||
        request.headers['x-anonymous-session-token'] !== session.sessionToken
      ) {
        problem(response, 401, 'INVALID_ANONYMOUS_SESSION', 'Invalid session')
        return
      }
      if (!assessment) {
        problem(response, 404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found')
        return
      }
      json(response, 200, assessment)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/assessments') {
      const accessToken = bearerToken(request)
      const actor = accessSessions.get(accessToken)
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const body = await readBody(request)
      const questionnaire = careQuestionnaires.get(
        body.questionnaireDefinitionId,
      )
      if (
        !questionnaire ||
        body.privacyPolicyVersion !== 'privacy-capstone-v3' ||
        body.privacyDisclosureAcknowledged !== true ||
        careConsents.get(actor.accountId)?.granted !== true
      ) {
        problem(
          response,
          409,
          'PRIVACY_DISCLOSURE_REQUIRED',
          'Privacy disclosure required',
        )
        return
      }
      const assessmentId = crypto.randomUUID()
      const assessment = careAssessment(assessmentId, body)
      authenticatedAssessments.set(
        `${actor.accountId}:${assessmentId}`,
        assessment,
      )
      state.authenticatedAssessmentCount += 1
      json(response, 201, assessment)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/assessments') {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const items = [...authenticatedAssessments.entries()]
        .filter(([key]) => key.startsWith(`${actor.accountId}:`))
        .map(([, assessment]) => assessment)
        .sort(
          (left, right) =>
            right.submittedAt.localeCompare(left.submittedAt) ||
            right.assessmentId.localeCompare(left.assessmentId),
        )
      json(response, 200, { items, nextCursor: null, hasMore: false })
      return
    }

    if (
      url.pathname === '/api/v1/profile' &&
      (request.method === 'GET' || request.method === 'PUT')
    ) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      if (request.method === 'GET') {
        const profile = careProfiles.get(actor.accountId)
        if (!profile) {
          problem(response, 404, 'PROFILE_NOT_FOUND', 'Profile not found')
          return
        }
        json(response, 200, profile)
        return
      }
      const body = await readBody(request)
      const existing = careProfiles.get(actor.accountId)
      const profile = {
        accountId: actor.accountId,
        ...body,
        locale: body.locale ?? existing?.locale ?? 'vi-VN',
        timezone: body.timezone ?? existing?.timezone ?? 'Asia/Ho_Chi_Minh',
        reminderEnabled:
          body.reminderEnabled ?? existing?.reminderEnabled ?? false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (existing?.version ?? -1) + 1,
      }
      careProfiles.set(actor.accountId, profile)
      json(response, existing ? 200 : 201, profile)
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/__test/care/clock/advance'
    ) {
      if (!accessSessions.has(bearerToken(request))) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      if (url.searchParams.get('duration') !== 'PT1H') {
        problem(response, 400, 'VALIDATION_FAILED', 'Unsupported duration')
        return
      }
      careNow = new Date(careNow.getTime() + 60 * 60 * 1000)
      response.writeHead(204)
      response.end()
      return
    }

    const scoringVersionControl = url.pathname.match(
      /^\/__test\/care\/assessments\/([^/]+)\/scoring-version$/,
    )
    if (request.method === 'POST' && scoringVersionControl) {
      const actor = accessSessions.get(bearerToken(request))
      const assessment = actor
        ? authenticatedAssessments.get(
            `${actor.accountId}:${scoringVersionControl[1]}`,
          )
        : null
      const value = url.searchParams.get('value')
      if (!assessment || !value) {
        problem(response, 404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found')
        return
      }
      assessment.result.scoringVersion = value
      response.writeHead(204)
      response.end()
      return
    }

    const voidControl = url.pathname.match(
      /^\/__test\/care\/assessments\/([^/]+)\/(void|restore)$/,
    )
    if (request.method === 'POST' && voidControl) {
      const actor = accessSessions.get(bearerToken(request))
      const assessment = actor
        ? authenticatedAssessments.get(`${actor.accountId}:${voidControl[1]}`)
        : null
      if (!assessment) {
        problem(response, 404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found')
        return
      }
      assessment.voidedAt =
        voidControl[2] === 'void' ? careNow.toISOString() : null
      response.writeHead(204)
      response.end()
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/__test/care/progress-fault'
    ) {
      if (!accessSessions.has(bearerToken(request))) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      progressFault = url.searchParams.get('mode')
      response.writeHead(204)
      response.end()
      return
    }

    const progressGet = url.pathname.match(
      /^\/api\/v1\/assessments\/([^/]+)\/progress$/,
    )
    if (request.method === 'GET' && progressGet) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const current = authenticatedAssessments.get(
        `${actor.accountId}:${progressGet[1]}`,
      )
      if (!current || current.voidedAt) {
        problem(response, 404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found')
        return
      }

      const fault = progressFault
      progressFault = null
      if (fault === 'TIMEOUT') {
        await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 4000))
      } else if (fault === 'UNAVAILABLE') {
        problem(response, 503, 'CARE_UNAVAILABLE', 'Care is unavailable')
        return
      } else if (fault === 'MALFORMED') {
        json(response, 200, { instrument: 'PHQ9' })
        return
      }

      const previous = [...authenticatedAssessments.entries()]
        .filter(
          ([key, assessment]) =>
            key.startsWith(`${actor.accountId}:`) &&
            assessment.assessmentId !== current.assessmentId &&
            assessment.voidedAt === null &&
            assessment.instrument === current.instrument &&
            assessment.result.scoringVersion ===
              current.result.scoringVersion &&
            (assessment.submittedAt < current.submittedAt ||
              (assessment.submittedAt === current.submittedAt &&
                assessment.assessmentId < current.assessmentId)),
        )
        .map(([, assessment]) => assessment)
        .sort(
          (left, right) =>
            right.submittedAt.localeCompare(left.submittedAt) ||
            right.assessmentId.localeCompare(left.assessmentId),
        )[0]
      if (!previous) {
        problem(
          response,
          409,
          'INSUFFICIENT_COMPARABLE_DATA',
          'Comparable assessment is unavailable',
        )
        return
      }

      const rawDelta = current.result.totalScore - previous.result.totalScore
      const elapsedHours = Math.floor(
        (Date.parse(current.submittedAt) - Date.parse(previous.submittedAt)) /
          (60 * 60 * 1000),
      )
      const point = (assessment) => ({
        assessmentId: assessment.assessmentId,
        questionnaireVersion: assessment.questionnaireVersion,
        submittedAt: assessment.submittedAt,
        totalScore: assessment.result.totalScore,
        screeningLevel: assessment.result.screeningLevel,
      })
      json(response, 200, {
        instrument: current.instrument,
        scoringVersion: current.result.scoringVersion,
        previous: point(previous),
        current: point(current),
        rawDelta,
        scoreDirection:
          rawDelta > 0 ? 'INCREASED' : rawDelta < 0 ? 'DECREASED' : 'UNCHANGED',
        bandTransition: {
          previous: previous.result.screeningLevel,
          current: current.result.screeningLevel,
        },
        elapsedDuration: elapsedHours > 0 ? `PT${elapsedHours}H` : 'PT0S',
      })
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/support-evaluations'
    ) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const body = await readBody(request)
      const phq9 = authenticatedAssessments.get(
        `${actor.accountId}:${body.phq9AssessmentId}`,
      )
      const gad7 = authenticatedAssessments.get(
        `${actor.accountId}:${body.gad7AssessmentId}`,
      )
      if (!phq9 || !gad7) {
        problem(
          response,
          404,
          'ASSESSMENT_NOT_FOUND',
          'Screening evidence was not found for the authenticated user',
        )
        return
      }
      if (
        phq9.voidedAt ||
        gad7.voidedAt ||
        phq9.instrument !== 'PHQ9' ||
        gad7.instrument !== 'GAD7'
      ) {
        problem(
          response,
          409,
          'SUPPORT_EVIDENCE_INCOMPATIBLE',
          'Support evidence is incompatible',
        )
        return
      }
      const pairKey = `${actor.accountId}:${phq9.assessmentId}:${gad7.assessmentId}`
      let evaluationId = supportEvaluationByPair.get(pairKey)
      let evaluation = evaluationId
        ? supportEvaluations.get(`${actor.accountId}:${evaluationId}`)
        : null
      if (!evaluation) {
        evaluation = supportEvaluation(phq9, gad7)
        evaluationId = evaluation.supportEvaluationId
        supportEvaluationByPair.set(pairKey, evaluationId)
        supportEvaluations.set(`${actor.accountId}:${evaluationId}`, evaluation)
      }
      json(response, 201, evaluation)
      return
    }

    const supportEvaluationGet = url.pathname.match(
      /^\/api\/v1\/support-evaluations\/([^/]+)$/,
    )
    if (request.method === 'GET' && supportEvaluationGet) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const evaluation = supportEvaluations.get(
        `${actor.accountId}:${supportEvaluationGet[1]}`,
      )
      if (!evaluation) {
        problem(
          response,
          404,
          'SUPPORT_EVALUATION_NOT_FOUND',
          'Support evaluation not found',
        )
        return
      }
      json(response, 200, evaluation)
      return
    }

    const authenticatedGet = url.pathname.match(
      /^\/api\/v1\/assessments\/([^/]+)$/,
    )
    if (request.method === 'GET' && authenticatedGet) {
      const actor = accessSessions.get(bearerToken(request))
      if (!actor || actor.expired || !actor.roles.includes('USER')) {
        problem(response, 401, 'UNAUTHENTICATED', 'Authentication is required')
        return
      }
      const assessment = authenticatedAssessments.get(
        `${actor.accountId}:${authenticatedGet[1]}`,
      )
      if (!assessment) {
        problem(response, 404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found')
        return
      }
      json(response, 200, assessment)
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/auth/email-verifications'
    ) {
      const body = await readBody(request)
      if (typeof body.challenge !== 'string' || body.challenge.length < 32) {
        problem(response, 400, 'INVALID_CHALLENGE', 'Challenge is invalid')
        return
      }
      const actor = actors.get('user@example.com')
      json(response, 200, {
        accountId: actor.accountId,
        status: 'ACTIVE',
        roles: actor.roles,
        emailVerified: true,
      })
      return
    }

    if (
      request.method === 'POST' &&
      (url.pathname === '/api/v1/auth/email-verification-requests' ||
        url.pathname === '/api/v1/auth/password-recovery-requests')
    ) {
      const body = await readBody(request)
      if (typeof body.email !== 'string' || !body.email.includes('@')) {
        problem(response, 400, 'VALIDATION_FAILED', 'Request validation failed')
        return
      }
      if (url.pathname.endsWith('email-verification-requests')) {
        state.verificationRequestCount += 1
      } else {
        state.passwordRecoveryRequestCount += 1
      }
      response.writeHead(202, { 'X-Correlation-Id': correlationId })
      response.end()
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/auth/password-resets'
    ) {
      const body = await readBody(request)
      if (
        typeof body.challenge !== 'string' ||
        body.challenge.length < 32 ||
        typeof body.newPassword !== 'string' ||
        body.newPassword.length < 12
      ) {
        problem(response, 400, 'INVALID_CHALLENGE', 'Challenge is invalid')
        return
      }
      state.passwordResetCount += 1
      response.writeHead(204, { 'X-Correlation-Id': correlationId })
      response.end()
      return
    }

    if (
      request.method === 'PUT' &&
      url.pathname === '/api/v1/account/password'
    ) {
      const accessToken = bearerToken(request)
      const actor = accessSessions.get(accessToken)
      const body = await readBody(request)
      if (
        !actor ||
        typeof body.currentPassword !== 'string' ||
        typeof body.newPassword !== 'string' ||
        body.newPassword.length < 12
      ) {
        problem(response, 401, 'INVALID_CREDENTIALS', 'Credentials are invalid')
        return
      }
      for (const [token, session] of accessSessions) {
        if (session.accountId === actor.accountId) accessSessions.delete(token)
      }
      for (const [token, session] of refreshSessions) {
        if (session.accountId === actor.accountId) refreshSessions.delete(token)
      }
      state.passwordChangeCount += 1
      response.writeHead(204, { 'X-Correlation-Id': correlationId })
      response.end()
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      const body = await readBody(request)
      const actor = actors.get(body.email)

      if (!actor || body.password !== 'synthetic-e2e-password') {
        problem(response, 401, 'AUTHENTICATION_FAILED', 'Authentication failed')
        return
      }

      state.loginCount += 1
      const tokens = tokenPair(actor, `${actor.accountId}-initial`)
      if (actor.initialAccessExpired) {
        accessSessions.set(tokens.accessToken, { ...actor, expired: true })
      }
      json(response, 200, tokens)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
      const body = await readBody(request)
      const actor = refreshSessions.get(body.refreshToken)

      if (!actor) {
        problem(response, 401, 'INVALID_SESSION', 'Session is invalid')
        return
      }

      for (const [token, session] of accessSessions) {
        if (session.accountId === actor.accountId) accessSessions.delete(token)
      }
      refreshSessions.delete(body.refreshToken)
      state.refreshCount += 1
      json(response, 200, tokenPair(actor, `${actor.accountId}-rotated`))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/account') {
      const session = accessSessions.get(bearerToken(request))
      state.accountCount += 1

      if (!session || session.expired) {
        problem(response, 401, 'UNAUTHORIZED', 'Authentication is required')
        return
      }

      json(response, 200, account(session))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
      const accessToken = bearerToken(request)
      const session = accessSessions.get(accessToken)
      const body = await readBody(request)
      const refreshSession = refreshSessions.get(body.refreshToken)

      if (!session || refreshSession?.accountId !== session.accountId) {
        problem(response, 401, 'UNAUTHORIZED', 'Authentication is required')
        return
      }

      accessSessions.delete(accessToken)
      refreshSessions.delete(body.refreshToken)
      state.logoutCount += 1
      response.writeHead(204, { 'X-Correlation-Id': correlationId })
      response.end()
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/v1/auth/logout-all'
    ) {
      const session = accessSessions.get(bearerToken(request))
      if (!session) {
        problem(response, 401, 'UNAUTHORIZED', 'Authentication is required')
        return
      }

      for (const [token, actor] of accessSessions) {
        if (actor.accountId === session.accountId) accessSessions.delete(token)
      }
      for (const [token, actor] of refreshSessions) {
        if (actor.accountId === session.accountId) refreshSessions.delete(token)
      }
      state.logoutAllCount += 1
      response.writeHead(204, { 'X-Correlation-Id': correlationId })
      response.end()
      return
    }

    problem(response, 404, 'NOT_FOUND', 'Resource not found')
  } catch {
    problem(response, 400, 'VALIDATION_FAILED', 'Request validation failed')
  }
})

reset()
server.listen(port, host)

function shutdown() {
  server.close(() => process.exit(0))
  server.closeAllConnections?.()
  setTimeout(() => process.exit(0), 1000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
