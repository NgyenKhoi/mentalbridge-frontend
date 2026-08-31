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
])

const accessSessions = new Map()
const refreshSessions = new Map()
const state = {
  loginCount: 0,
  accountCount: 0,
  refreshCount: 0,
  logoutCount: 0,
  logoutAllCount: 0,
}

function reset() {
  accessSessions.clear()
  refreshSessions.clear()
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
        activeAccessSessionCount: accessSessions.size,
        activeRefreshSessionCount: refreshSessions.size,
      })
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

server.listen(port, host)
