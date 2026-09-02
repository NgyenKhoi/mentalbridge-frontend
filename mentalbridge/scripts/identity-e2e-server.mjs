import { createServer } from 'node:http'

const host = '127.0.0.1'
const port = Number.parseInt(process.env.IDENTITY_E2E_PORT ?? '3201', 10)
const correlationId = '62cda42f-b286-43c6-aa48-88ef64ff3361'
const timestamps = {
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}

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
])

const accessSessions = new Map()
const refreshSessions = new Map()
const anonymousCareSessions = new Map()
const anonymousAssessments = new Map()
const authenticatedAssessments = new Map()
const careProfiles = new Map()
const careConsents = new Map()
const careAccessToken = 'synthetic-care-e2e-access'
const careActor = actors.get('care-e2e@example.com')
accessSessions.set(careAccessToken, careActor)
const state = {
  loginCount: 0,
  accountCount: 0,
  refreshCount: 0,
  logoutCount: 0,
  logoutAllCount: 0,
  questionnaireCount: 0,
  anonymousAssessmentCount: 0,
  authenticatedAssessmentCount: 0,
}

function reset() {
  accessSessions.clear()
  refreshSessions.clear()
  accessSessions.set(careAccessToken, careActor)
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

const careDefinitionId = '20000000-0000-4000-8000-000000000001'
const careQuestionIds = Array.from(
  { length: 9 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
)
const careQuestionPrompts = [
  'Ít quan tâm hoặc niềm vui khi làm việc',
  'Cảm thấy chán nản, chán nản hoặc tuyệt vọng',
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
  questions: careQuestionPrompts.map((prompt, index) => ({
    questionId: careQuestionIds[index],
    itemNumber: index + 1,
    prompt,
  })),
}

function careAssessment(assessmentId, body, expiresAt) {
  const totalScore = body.answers.reduce((sum, answer) => sum + answer.value, 0)
  const safetyAnswer = body.answers.find(
    (answer) => answer.questionId === careQuestionIds[8],
  )
  return {
    assessmentId,
    questionnaireDefinitionId: careDefinitionId,
    instrument: 'PHQ9',
    questionnaireVersion: careQuestionnaire.version,
    privacyPolicyVersion: 'privacy-capstone-v1',
    submittedAt: '2026-09-01T00:00:00Z',
    voidedAt: null,
    result: {
      totalScore,
      screeningLevel: 'MINIMAL',
      scoringVersion: 'phq9-standard-bands-v1',
      safetyStatus:
        safetyAnswer?.value >= 1
          ? 'POSITIVE_SAFETY_SCREEN'
          : 'NEGATIVE_SAFETY_SCREEN',
      safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
    ...(expiresAt ? { expiresAt } : {}),
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, { status: 'UP' })
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
          (token) => token !== careAccessToken,
        ).length,
        activeRefreshSessionCount: refreshSessions.size,
      })
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/api/v1/privacy-disclosures/current'
    ) {
      json(response, 200, {
        consentType: 'PRIVACY_POLICY',
        version: 'privacy-capstone-v1',
        locale: 'vi-VN',
        title: 'Thông báo xử lý dữ liệu cho bản Capstone',
        content:
          'MentalBridge lưu hồ sơ Care, câu trả lời PHQ-9 và kết quả do backend tính cho controlled test/demo. Đây không phải chẩn đoán và không cho phép AI, nghiên cứu, marketing hoặc chia sẻ specialist.',
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
        policyVersion: 'privacy-capstone-v1',
        granted: body.granted === true,
        decidedAt: new Date().toISOString(),
      }
      careConsents.set(actor.accountId, decision)
      json(response, 201, decision)
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/api/v1/questionnaires/PHQ9/current'
    ) {
      if (url.searchParams.get('locale') !== 'vi-VN') {
        problem(
          response,
          404,
          'QUESTIONNAIRE_NOT_FOUND',
          'Questionnaire not found',
        )
        return
      }
      state.questionnaireCount += 1
      json(response, 200, careQuestionnaire)
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
      if (
        body.questionnaireDefinitionId !== careDefinitionId ||
        body.privacyPolicyVersion !== 'privacy-capstone-v1' ||
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
      if (
        body.privacyPolicyVersion !== 'privacy-capstone-v1' ||
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
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (existing?.version ?? -1) + 1,
      }
      careProfiles.set(actor.accountId, profile)
      json(response, existing ? 200 : 201, profile)
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
