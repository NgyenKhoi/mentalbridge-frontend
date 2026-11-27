import {
  expect,
  test,
  type APIResponse,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { io, type Socket } from 'socket.io-client'

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected object')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string')
  return value
}
function items(value: unknown): Record<string, unknown>[] {
  const array = object(value).items
  if (!Array.isArray(array)) throw new Error('Expected items')
  return array.map(object)
}
async function json(
  response: Pick<APIResponse, 'status' | 'json'>,
  status = 200,
) {
  expect(response.status()).toBe(status)
  return object(await response.json())
}
type RequestOptions = { headers?: Record<string, string>; data?: unknown }
function api(context: BrowserContext) {
  async function invoke(
    method: string,
    path: string,
    options: RequestOptions = {},
  ) {
    if (!path.startsWith('/'))
      return context.request.fetch(path, { method, ...options })
    const page = context.pages()[0]
    if (!page) throw new Error('Authenticated browser page unavailable')
    const result = await page.evaluate(
      async ({ method, path, headers, data }) => {
        const response = await fetch(path, {
          method,
          credentials: 'same-origin',
          headers: {
            ...(data !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
            ...headers,
          },
          body: data === undefined ? undefined : JSON.stringify(data),
        })
        return { status: response.status, body: await response.text() }
      },
      { method, path, headers: options.headers, data: options.data },
    )
    return {
      status: () => result.status,
      json: async (): Promise<unknown> => JSON.parse(result.body),
    }
  }
  return {
    get: (path: string, options?: RequestOptions) =>
      invoke('GET', path, options),
    post: (path: string, options?: RequestOptions) =>
      invoke('POST', path, options),
    put: (path: string, options?: RequestOptions) =>
      invoke('PUT', path, options),
  }
}
const web = process.env.MB693_WEB_URL ?? ''
if (
  process.env.MB693_ISOLATED_RUN !== 'true' ||
  new URL(web).hostname !== '127.0.0.1'
) {
  throw new Error('Use the disposable run-community-safety-e2e.mjs runner')
}
const identity = process.env.MB693_IDENTITY_URL ?? ''
const realtime = process.env.MB693_REALTIME_URL ?? ''
const root = '/api/community/chat'
const canary = 'MB693_PRIVATE_CANARY'
const groupName = 'MB693 Góc thực hành'
const sockets: Array<{ socket: Socket; events: Record<string, unknown>[] }> = []
let a: BrowserContext
let a2: BrowserContext
let b: BrowserContext
let pageA: Page
let pageB: Page
let ap: string
let bp: string
let direct: string
let group: string
let oldCursor: string
let firstMessage: string
let afterRemovalMessage: string
let probes: typeof sockets
let senderProbe: (typeof sockets)[number]

test.describe.configure({ mode: 'serial' })

async function login(context: BrowserContext, email: string) {
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(process.env.MB693_PASSWORD ?? '')
  const response = page.waitForResponse(
    (value) =>
      value.url().endsWith('/api/identity/login') &&
      value.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  expect((await response).status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  return page
}
async function send(
  context: BrowserContext,
  conversation: string,
  content: string,
) {
  const clientMessageId = randomUUID()
  const result = await json(
    await api(context).post(`${root}/conversations/${conversation}/messages`, {
      headers: { 'Idempotency-Key': clientMessageId },
      data: { clientMessageId, content },
    }),
    201,
  )
  expect(result.persistence).toBe('SAVED')
  expect(result.delivery).toBe('UNCONFIRMED')
  return object(result.message)
}
async function notice(
  context: BrowserContext,
  kind: string,
  targetId?: string,
) {
  let found: Record<string, unknown> | undefined
  await expect
    .poll(
      async () => {
        const page = await json(
          await api(context).get('/api/notifications?limit=50'),
        )
        found = items(page).find(
          (value) =>
            value.kind === kind &&
            (!targetId || object(value.action).targetId === targetId),
        )
        return Boolean(found)
      },
      { timeout: 25_000 },
    )
    .toBe(true)
  if (!found) throw new Error('Notice unavailable')
  expect(string(found.body)).not.toContain(canary)
  expect(string(found.body)).not.toContain(groupName)
  return found
}
async function inviteFromUI() {
  await pageA
    .getByRole('combobox', { name: 'Chọn người từ trò chuyện riêng' })
    .click()
  await pageA.getByRole('option', { name: 'MB693 Mầm' }).click()
  await pageA
    .getByRole('button', { name: 'Mời thành viên', exact: true })
    .click()
  await expect(pageA.getByText(/Người nhận phải tự chấp thuận/)).toBeVisible()
}
async function connect(email: string) {
  const response = await api(a).post(`${identity}/api/v1/auth/login`, {
    data: {
      email,
      password: process.env.MB693_PASSWORD,
      deviceLabel: 'MB693 transport probe',
    },
  })
  expect(response.status()).toBe(200)
  const token = string(object(await response.json()).accessToken)
  const ticket = await json(
    await api(a).post(`${realtime}/api/v1/community/socket-credentials`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    }),
  )
  const socket = io(`${realtime}/community`, {
    auth: { schemaVersion: 1, credential: string(ticket.credential) },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    autoConnect: false,
    timeout: 5000,
  })
  const probe = { socket, events: [] as Record<string, unknown>[] }
  sockets.push(probe)
  socket.on('community.event', (value: unknown) =>
    probe.events.push(object(value)),
  )
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
    socket.connect()
  })
  const ack: unknown = await socket
    .timeout(10_000)
    .emitWithAck('community.command', {
      schemaVersion: 1,
      commandId: randomUUID(),
      correlationId: randomUUID(),
      commandType: 'community.conversation.subscribe',
      payload: { conversationId: group },
    })
  expect(object(ack).eventType).toBe('community.command.ack')
  return probe
}
function delivered(probe: (typeof sockets)[number]) {
  return probe.events
    .filter((event) => event.eventType === 'community.message.created')
    .map((event) => object(object(event.payload).message))
}
async function management() {
  await pageA.goto(`/community/messages/${group}`)
  await pageA.getByRole('button', { name: /Thành viên · Chủ nhóm/ }).click()
}
async function removeFromUI() {
  await pageA
    .getByRole('button', { name: 'Xóa khỏi nhóm', exact: true })
    .click()
  await pageA
    .getByRole('dialog')
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .click()
}

test.beforeAll(async ({ browser }) => {
  a = await browser.newContext({
    baseURL: web,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  b = await browser.newContext({
    baseURL: web,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  })
  a2 = await browser.newContext({ baseURL: web })
  pageA = await login(a, process.env.MB693_USER_A ?? '')
  pageB = await login(b, process.env.MB693_USER_B ?? '')
  await login(a2, process.env.MB693_USER_A ?? '')
  ap = string(
    (
      await json(
        await api(a).put('/api/community/profile', {
          data: { displayName: 'MB693 Lá', avatarPreset: 'SPROUT' },
        }),
        201,
      )
    ).communityProfileId,
  )
  bp = string(
    (
      await json(
        await api(b).put('/api/community/profile', {
          data: { displayName: 'MB693 Mầm', avatarPreset: 'SPROUT' },
        }),
        201,
      )
    ).communityProfileId,
  )
})
test.afterAll(async () => {
  for (const { socket } of sockets) socket.disconnect()
  await Promise.all([a?.close(), a2?.close(), b?.close()])
})

test('direct consent, generic notification link and response-loss retry use the real owner', async () => {
  const pending = await json(
    await api(a).post(`${root}/direct-conversations`, {
      headers: { 'Idempotency-Key': randomUUID() },
      data: { recipientCommunityProfileId: bp },
    }),
    201,
  )
  expect(pending.state).toBe('PENDING')
  expect(pending).not.toHaveProperty('conversationId')
  const requestId = string(pending.requestId)
  const requestNotice = await notice(b, 'COMMUNITY_REQUEST', requestId)
  await pageB.goto(string(object(requestNotice.action).href))
  await expect(pageB.getByRole('tab', { name: /Lời mời/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(
    pageB.getByRole('textbox', { name: 'Tin nhắn', exact: true }),
  ).toHaveCount(0)
  await pageB.getByRole('button', { name: 'Chấp thuận', exact: true }).click()
  await expect(pageB).toHaveURL(/\/community\/messages\/[\da-f-]{36}$/)
  direct = pageB.url().split('/').at(-1) ?? ''
  await pageA.goto(`/community/messages/${direct}`)
  const keys: string[] = []
  await pageA.route(
    `**${root}/conversations/${direct}/messages`,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      keys.push(route.request().headers()['idempotency-key'])
      if (keys.length === 1) {
        expect((await route.fetch()).status()).toBe(201)
        return route.abort('failed')
      }
      return route.continue()
    },
  )
  await pageA
    .getByRole('textbox', { name: 'Tin nhắn', exact: true })
    .fill(`${canary} direct`)
  await pageA.getByRole('button', { name: 'Gửi', exact: true }).click()
  await pageA.getByRole('button', { name: 'Gửi lại', exact: true }).click()
  await expect(
    pageA.getByText(`${canary} direct`, { exact: true }),
  ).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
  const history = await json(
    await api(b).get(`${root}/conversations/${direct}/messages`),
  )
  expect(
    items(history).filter((message) => message.content === `${canary} direct`),
  ).toHaveLength(1)
  await notice(b, 'COMMUNITY_MESSAGE', direct)
  await pageB.goto('/notifications')
  await pageB.getByText('Bạn có tin nhắn mới.', { exact: true }).click()
  await expect(pageB).toHaveURL(new RegExp(`/community/messages/${direct}$`))
  await expect(
    pageB.getByText(`${canary} direct`, { exact: true }),
  ).toBeVisible()
})

test('group consent, two transport devices, stale revision and removal stay owner-authorized', async () => {
  await pageA.goto('/community/messages')
  await pageA.getByRole('button', { name: /Tạo nhóm riêng/ }).click()
  await pageA.getByLabel('Tên nhóm', { exact: true }).fill(groupName)
  await pageA
    .getByRole('dialog')
    .getByRole('button', { name: 'Tạo nhóm', exact: true })
    .click()
  await expect(pageA).toHaveURL(/\/community\/messages\/[\da-f-]{36}$/)
  group = pageA.url().split('/').at(-1) ?? ''
  await send(a, group, `${canary} before invitation`)
  await pageA.getByRole('button', { name: /Thành viên · Chủ nhóm/ }).click()
  await inviteFromUI()
  expect(
    (await api(b).get(`${root}/conversations/${group}/messages`)).status(),
  ).toBe(404)
  expect((await api(b).get(`${root}/groups/${group}/members`)).status()).toBe(
    404,
  )
  const invitation = await notice(b, 'COMMUNITY_INVITATION')
  await pageB.goto('/notifications')
  await pageB
    .getByText('Bạn có lời mời vào nhóm riêng.', { exact: true })
    .click()
  await expect(pageB.getByRole('tab', { name: /Lời mời/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(
    pageB.getByRole('textbox', { name: 'Tin nhắn', exact: true }),
  ).toHaveCount(0)
  expect(pageB.url()).toContain(
    `invitationId=${string(object(invitation.action).targetId)}`,
  )
  await pageB.getByRole('button', { name: 'Tham gia', exact: true }).click()
  await expect(pageB).toHaveURL(new RegExp(`/community/messages/${group}$`))
  await expect(
    pageB.getByText(`${canary} before invitation`, { exact: true }),
  ).toHaveCount(0)

  probes = await Promise.all([
    connect(process.env.MB693_USER_B ?? ''),
    connect(process.env.MB693_USER_B ?? ''),
  ])
  senderProbe = await connect(process.env.MB693_USER_A ?? '')
  firstMessage = string(
    (await send(a, group, `${canary} current epoch one`)).messageId,
  )
  await expect
    .poll(
      () =>
        probes.map((probe) =>
          delivered(probe).some(
            (message) => message.messageId === firstMessage,
          ),
        ),
      { timeout: 25_000 },
    )
    .toEqual([true, true])
  await send(a, group, `${canary} current epoch two`)
  const page = await json(
    await api(b).get(`${root}/conversations/${group}/messages?limit=1`),
  )
  oldCursor = string(page.nextCursor)
  await pageB.reload()
  await expect(
    pageB.getByText(`${canary} current epoch one`, { exact: true }),
  ).toBeVisible()
  await expect(
    pageB.getByText(`${canary} before invitation`, { exact: true }),
  ).toHaveCount(0)
  await pageB.screenshot({
    path: 'docs/evidence/mb-693-group-authorized.png',
    fullPage: true,
  })

  await management()
  const fresh = await json(await api(a2).get(`${root}/conversations/${group}`))
  await json(
    await api(a2).put(`${root}/groups/${group}/members/${bp}/role`, {
      headers: { 'If-Match': `"${string(fresh.version)}"` },
      data: { role: 'ADMIN' },
    }),
  )
  await removeFromUI()
  await expect(
    pageA.getByText(
      'Nhóm vừa thay đổi ở nơi khác. Hãy tải lại trước khi thử lại.',
    ),
  ).toBeVisible()
  expect(
    (await api(b).get(`${root}/conversations/${group}/messages`)).status(),
  ).toBe(200)
  await management()
  await removeFromUI()
  await expect(pageA.getByText('Đã xóa thành viên khỏi nhóm.')).toBeVisible()
  await expect
    .poll(
      () =>
        probes.every((probe) =>
          probe.events.some(
            (event) => event.eventType === 'community.conversation.invalidated',
          ),
        ),
      { timeout: 25_000 },
    )
    .toBe(true)
  afterRemovalMessage = string(
    (await send(a, group, `${canary} after removal`)).messageId,
  )
  await expect
    .poll(
      () =>
        delivered(senderProbe).some(
          (message) => message.messageId === afterRemovalMessage,
        ),
      { timeout: 25_000 },
    )
    .toBe(true)
  for (const probe of probes)
    expect(
      delivered(probe).some(
        (message) => message.messageId === afterRemovalMessage,
      ),
    ).toBe(false)
  for (const url of [
    `${root}/conversations/${group}`,
    `${root}/conversations/${group}/messages`,
    `${root}/groups/${group}/members`,
  ]) {
    expect((await api(b).get(url)).status()).toBe(404)
  }
  expect(
    (
      await api(b).put(`${root}/conversations/${group}/read-cursor`, {
        data: { lastReadMessageId: firstMessage },
      })
    ).status(),
  ).toBe(404)
  expect(
    (
      await api(b).post(`${root}/reports`, {
        headers: { 'Idempotency-Key': randomUUID() },
        data: { messageId: firstMessage, reasonCode: 'SPAM' },
      })
    ).status(),
  ).toBe(404)
  const deniedId = randomUUID()
  expect(
    (
      await api(b).post(`${root}/conversations/${group}/messages`, {
        headers: { 'Idempotency-Key': deniedId },
        data: { clientMessageId: deniedId, content: `${canary} denied` },
      })
    ).status(),
  ).toBe(404)
  await pageB.goto(`/community/chat/conversations/${group}`)
  await expect(
    pageB.getByText('Cuộc trò chuyện này không còn khả dụng.', { exact: true }),
  ).toBeVisible()
  await expect(pageB.getByText(groupName, { exact: true })).toHaveCount(0)
  await expect(pageB.getByText(new RegExp(canary))).toHaveCount(0)
  await pageB.screenshot({
    path: 'docs/evidence/mb-693-group-revoked.png',
    fullPage: true,
  })
})

test('rejoin never revives an old epoch, reports stay exact and direct block wins', async () => {
  await management()
  await inviteFromUI()
  const pending = await json(await api(b).get(`${root}/invitations`))
  const invitation = items(pending).find((item) => item.state === 'PENDING')
  if (!invitation) throw new Error('Rejoin invitation unavailable')
  await pageB.goto(
    `/community/chat/invitations/${string(invitation.invitationId)}`,
  )
  await pageB.getByRole('button', { name: 'Tham gia', exact: true }).click()
  await expect(pageB).toHaveURL(new RegExp(`/community/messages/${group}$`))
  expect(
    (
      await api(b).get(
        `${root}/conversations/${group}/messages?cursor=${encodeURIComponent(oldCursor)}`,
      )
    ).status(),
  ).toBe(404)
  const history = await json(
    await api(b).get(`${root}/conversations/${group}/messages`),
  )
  expect(items(history)).toHaveLength(0)
  const current = await send(a, group, `${canary} rejoined epoch`)
  await pageB.reload()
  await expect(
    pageB.getByText(`${canary} rejoined epoch`, { exact: true }),
  ).toBeVisible()
  await expect(
    pageB.getByText(`${canary} after removal`, { exact: true }),
  ).toHaveCount(0)
  await pageB.getByRole('button', { name: /Báo cáo tin nhắn:/ }).click()
  await pageB
    .getByRole('button', { name: 'Xác nhận gửi báo cáo', exact: true })
    .click()
  await expect(
    pageB.getByText('Đã gửi báo cáo cho riêng tin nhắn đã chọn.'),
  ).toBeVisible()
  const reportKey = randomUUID()
  const report = {
    headers: { 'Idempotency-Key': reportKey },
    data: { messageId: string(current.messageId), reasonCode: 'HARASSMENT' },
  }
  const first = await json(await api(b).post(`${root}/reports`, report), 201)
  const retry = await json(await api(b).post(`${root}/reports`, report), 201)
  expect(first.caseId).toBe(retry.caseId)
  expect(Object.keys(first).sort()).toEqual(['caseId', 'state'])
  await pageB.setViewportSize({ width: 390, height: 844 })
  expect(
    await pageB.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await pageB.screenshot({
    path: 'docs/evidence/mb-693-group-rejoined-mobile.png',
    fullPage: true,
  })

  await management()
  await pageA
    .getByRole('button', { name: 'Thăng cấp quản trị', exact: true })
    .click()
  await expect(pageA.getByText('Đã cập nhật vai trò thành viên.')).toBeVisible()
  await pageA
    .getByRole('button', { name: 'Chuyển quyền chủ nhóm', exact: true })
    .click()
  await pageA
    .getByRole('dialog')
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .click()
  await expect(pageA.getByText('Đã chuyển quyền chủ nhóm.')).toBeVisible()
  await expect(
    pageA.getByRole('button', { name: 'Lưu trữ nhóm', exact: true }),
  ).toHaveCount(0)

  expect((await api(b).put(`/api/community/blocks/${ap}`)).status()).toBe(204)
  for (const context of [a, a2, b])
    expect(
      (
        await api(context).get(`${root}/conversations/${direct}/messages`)
      ).status(),
    ).toBe(404)
  expect(
    (
      await api(b).post(`${root}/reports`, {
        headers: { 'Idempotency-Key': randomUUID() },
        data: { messageId: string(current.messageId), reasonCode: 'SPAM' },
      })
    ).status(),
  ).toBe(404)
  await pageB.goto(`/community/chat/conversations/${direct}`)
  await expect(
    pageB.getByText('Cuộc trò chuyện này không còn khả dụng.', { exact: true }),
  ).toBeVisible()
  for (const page of [pageA, pageB]) {
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }))
    expect(JSON.stringify(storage)).not.toMatch(
      /Bearer |eyJ[\w-]+\.[\w-]+\.[\w-]+|MB693_PRIVATE_CANARY/,
    )
  }
})
