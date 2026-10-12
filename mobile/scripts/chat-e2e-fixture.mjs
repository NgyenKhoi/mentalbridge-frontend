import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { io } from 'socket.io-client'

if (
  process.env.CI !== 'true' ||
  process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract' ||
  process.env.MOBILE_EVIDENCE_FEATURE !== 'chat' ||
  !process.env.GITHUB_ENV
)
  throw new Error('Only disposable protected chat services are supported.')
const mode = process.argv[2]
if (!['prepare', 'activate', 'close', 'peer', 'verify'].includes(mode))
  throw new Error('Explicit fixture operation required.')
const uuid = (value) => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error('Invalid fixture identity.')
  return value
}
async function json(port, path, headers = {}, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined
      ? { method: 'POST', body: JSON.stringify(body) }
      : {}),
  })
  if (!response.ok)
    throw new Error(
      `Protected contract operation failed: HTTP ${response.status}`,
    )
  return { body: await response.json(), etag: response.headers.get('etag') }
}
async function login(email, role) {
  const result = await json(
    8080,
    '/api/v1/auth/login',
    {},
    { email, password: process.env.MAESTRO_MB_USER_PASSWORD },
  )
  const headers = { Authorization: `Bearer ${result.body.accessToken}` }
  const account = (await json(8080, '/api/v1/account', headers)).body
  if (
    account.roles?.length !== 1 ||
    account.roles[0] !== role ||
    account.status !== 'ACTIVE' ||
    !account.emailVerified
  )
    throw new Error('Dedicated role verification failed.')
  return { headers, id: uuid(account.accountId) }
}
const user = await login('e2e-user-a@synthetic.invalid', 'USER')
const specialist = await login('e2e-user-b@synthetic.invalid', 'SPECIALIST')
let appointmentId = process.env.MAESTRO_MB_CHAT_APPOINTMENT_ID
const slotId = uuid(process.env.MAESTRO_MB_DISCOVERY_SLOT_ID)
if (mode === 'prepare') {
  const requested = await json(
    8082,
    '/api/v1/appointments',
    { ...user.headers, 'Idempotency-Key': randomUUID() },
    { slotId, modality: 'IN_APP_CHAT' },
  )
  const accepted = await json(
    8082,
    `/api/v1/specialist/appointments/${uuid(requested.body.id)}/accept`,
    {
      ...specialist.headers,
      'If-Match': requested.etag ?? `"${requested.body.version}"`,
      'Idempotency-Key': randomUUID(),
    },
    {},
  )
  if (
    accepted.body.status !== 'CONFIRMED' ||
    accepted.body.creditState !== 'HELD'
  )
    throw new Error('Public confirmation failed.')
  appointmentId = uuid(accepted.body.id)
  appendFileSync(
    process.env.GITHUB_ENV,
    `MAESTRO_MB_CHAT_APPOINTMENT_ID=${appointmentId}\n`,
  )
  console.log(
    'Real public request and assigned SPECIALIST acceptance verified. No completion/ledger fixture facts.',
  )
} else {
  appointmentId = uuid(appointmentId)
  const list = (await json(8082, '/api/v1/appointments', user.headers)).body
  const appointment = list.items.find(
    (item) =>
      item.id === appointmentId &&
      item.slotId === slotId &&
      item.specialistAccountId === specialist.id,
  )
  if (!appointment)
    throw new Error('Dedicated appointment ownership verification failed.')
  if (mode === 'activate' || mode === 'close') {
    // Test-only time compression after public booking/confirmation. Do not seed
    // status, evidence, clinical outcome, credit transitions, or payout facts.
    // Both exact intervals stay 60 minutes; real Consultation evaluates its clock.
    const start = new Date(
      Date.now() - (mode === 'activate' ? 60_000 : 3_660_000),
    ).toISOString()
    const end = new Date(Date.parse(start) + 3_600_000).toISOString()
    const sql = `begin; update appointment set scheduled_start_at='${start}',scheduled_end_at='${end}',requested_at='${start}'::timestamptz-interval '2 hours',decision_deadline_at='${start}'::timestamptz-interval '1 hour' where id='${appointmentId}' and user_account_id='${user.id}' and specialist_account_id='${specialist.id}' and availability_slot_id='${slotId}' and status in ('CONFIRMED','IN_PROGRESS'); update availability_slot set start_at='${start}',end_at='${end}' where id='${slotId}' and specialist_account_id='${specialist.id}'; commit;`
    const result = spawnSync(
      'docker',
      [
        'compose',
        '--project-name',
        'mentalbridge-controlled-e2e',
        '--env-file',
        '.env.mobile-resources-e2e',
        '-f',
        'docker-compose.local.yml',
        '-f',
        'docker-compose.e2e.yml',
        '-f',
        'docker-compose.e2e.local.yml',
        '-f',
        '../mobile/ci/docker-compose.mobile-resources-e2e.yml',
        '-f',
        '../mobile/ci/docker-compose.mobile-discovery-e2e.yml',
        '-f',
        '../mobile/ci/docker-compose.mobile-chat-e2e.yml',
        'exec',
        '-T',
        'consultation-postgres',
        'psql',
        '-U',
        'mentalbridge_consultation',
        '-d',
        'mentalbridge_consultation',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { cwd: resolve('..', 'backend-provider'), input: sql, encoding: 'utf8' },
    )
    if (result.status !== 0)
      throw new Error('Disposable appointment interval fixture failed.')
    const decision = (
      await json(
        8082,
        `/internal/v1/appointments/${appointmentId}/chat-eligibility?operation=SEND`,
        user.headers,
      )
    ).body
    if (
      mode === 'activate'
        ? decision.phase !== 'ACTIVE' || !decision.sendAllowed
        : decision.sendAllowed ||
          decision.subscribeAllowed ||
          !decision.historyAllowed
    )
      throw new Error('Real authoritative time-window decision failed.')
    console.log(
      `${mode === 'activate' ? 'ACTIVE' : 'CLOSED'} confirmed by real Consultation eligibility; interval-only disposable fixture, no invented outcome.`,
    )
  } else if (mode === 'peer') {
    const credential = (
      await json(
        3004,
        '/internal/v1/socket-credentials',
        specialist.headers,
        {},
      )
    ).body
    const socket = io('http://127.0.0.1:8088/realtime', {
      auth: {
        schemaVersion: 1,
        accessToken: credential.accessToken,
        correlationId: randomUUID(),
      },
      transports: ['websocket'],
      reconnection: false,
    })
    const command = (commandType, payload) =>
      new Promise((resolve, reject) => {
        const commandId = randomUUID()
        const correlationId = randomUUID()
        socket.timeout(5000).emit(
          'realtime.command',
          {
            schemaVersion: 1,
            commandId,
            correlationId,
            commandType,
            sentAt: new Date().toISOString(),
            payload,
          },
          (error, result) => {
            if (
              error ||
              !['accepted', 'duplicate'].includes(result?.status) ||
              result.commandId !== commandId ||
              result.correlationId !== correlationId
            )
              reject(new Error('Protected peer command failed.'))
            else resolve(result)
          },
        )
      })
    socket.on('connect_error', () => {
      console.error('Protected peer connection failed.')
      process.exitCode = 1
      socket.disconnect()
    })
    socket.once('realtime.event', async (event) => {
      try {
        if (
          event.eventType !== 'connection.ready' ||
          event.payload.accountId !== specialist.id ||
          event.payload.role !== 'SPECIALIST'
        )
          throw new Error('Peer identity mismatch.')
        await command('conversation.subscribe', {
          conversationId: appointmentId,
        })
        await command('conversation.check-in', {
          conversationId: appointmentId,
        })
        await command('message.send', {
          conversationId: appointmentId,
          clientMessageId: randomUUID(),
          type: 'TEXT',
          content: 'MB631 synthetic peer message',
        })
        console.log(
          'Assigned SPECIALIST subscribe, explicit check-in and durable message accepted; no raw frame retained.',
        )
      } catch {
        console.error('Protected peer protocol failed.')
        process.exitCode = 1
        socket.disconnect()
      }
    })
    process.on('SIGTERM', () => {
      socket.disconnect()
      process.exit()
    })
  } else {
    const decision = (
      await json(
        8082,
        `/internal/v1/appointments/${appointmentId}/chat-eligibility?operation=HISTORY`,
        user.headers,
      )
    ).body
    const messages = (
      await json(
        3004,
        `/api/v1/conversations/${appointmentId}/messages`,
        user.headers,
      )
    ).body.items
    if (
      decision.sendAllowed ||
      decision.subscribeAllowed ||
      !decision.historyAllowed ||
      messages.length !== 2 ||
      new Set(messages.map((item) => item.clientMessageId)).size !== 2 ||
      !messages.some(
        (item) =>
          item.senderId === user.id &&
          item.content === 'MB631 synthetic user message',
      ) ||
      !messages.some(
        (item) =>
          item.senderId === specialist.id &&
          item.content === 'MB631 synthetic peer message',
      )
    )
      throw new Error(
        'Durable conversation/authoritative closure evidence failed.',
      )
    console.log(
      'Real history verifies exactly two accepted synthetic participant messages after reconnect/restart. Consultation independently denies subscribe/send and retains history. No payload/identifier retained.',
    )
  }
}
