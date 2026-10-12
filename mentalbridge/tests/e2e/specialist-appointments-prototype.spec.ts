import { expect, type Page, type TestInfo } from '@playwright/test'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type { AppointmentChatEligibility } from '@/lib/consultation/consultation-validation'
import type { ChatMessage } from '@/features/appointments/api/chat-browser-client'
import type { CommandEnvelopeV1, ServerEventV1 } from '@/lib/realtime'
import type { SessionSummary } from '@/lib/consultation/session-summary-validation'
import type { SpecialistClientContinuityItem } from '@/features/appointments/api/consultation-brief-contract'
import { approvedProfile } from '../fixtures/profile-amendment'
import { test } from './test-fixtures'

test.use({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok' })
test.beforeEach(async ({ request }) => {
  expect(
    (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
  ).toBe(204)
})
const generatedAt = '2026-10-09T03:00:00Z'
const id = (index: number) =>
  `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`
function appointment(
  index: number,
  status: Appointment['status'],
): Appointment {
  return {
    id: id(index),
    slotId: id(index + 100),
    specialistAccountId: approvedProfile.accountId,
    specialistDisplayName: approvedProfile.displayName,
    status,
    modality: 'IN_APP_CHAT',
    scheduledStartAt:
      status === 'COMPLETED' ? '2026-10-08T02:00:00Z' : '2026-10-10T02:00:00Z',
    scheduledEndAt:
      status === 'COMPLETED' ? '2026-10-08T03:00:00Z' : '2026-10-10T03:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    requestedAt: generatedAt,
    decisionDeadlineAt: '2026-10-09T10:00:00Z',
    heldCreditId: id(index + 200),
    replacesAppointmentId: null,
    replacedByAppointmentId: null,
    decidedAt: status === 'REQUESTED' ? null : generatedAt,
    decisionReason: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationActor: null,
    cancellationCreditOutcome: null,
    sessionOutcome: status === 'COMPLETED' ? 'COMPLETED' : null,
    sessionOutcomeReason: null,
    sessionPolicyVersion: null,
    sessionEndedAt: null,
    sessionSettledAt: null,
    completionFactId: null,
    creditState:
      status === 'COMPLETED'
        ? 'CONSUMED'
        : status === 'REJECTED'
          ? 'AVAILABLE'
          : 'HELD',
    history: [],
    version: 0,
  }
}
async function enter(page: Page) {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/appointments')
  await expect(
    page.getByRole('heading', { name: 'Phản hồi yêu cầu lịch hẹn' }),
  ).toBeVisible()
}
async function capture(
  page: Page,
  info: TestInfo,
  name: string,
  journey = 'appointments',
) {
  for (const close of await page
    .getByRole('button', { name: 'Đóng thông báo', exact: true })
    .all())
    await close.click()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
  expect(
    await page.locator(`[data-specialist-journey="${journey}"]`).innerText(),
  ).not.toMatch(
    /\uFFFD|Ã[\u0080-\u00BF]|Ä[\u0080-\u00BF]|Æ[\u0080-\u00BF]|á[º»]/,
  )
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({
    path,
    fullPage: !(await page.getByRole('dialog').isVisible()),
    animations: 'disabled',
  })
  await info.attach(name, { path, contentType: 'image/png' })
}

test('specialist appointment decisions, filters, permission disclosure, summary cancel/amend and responsive UI', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let items = [
    appointment(1, 'REQUESTED'),
    appointment(2, 'CONFIRMED'),
    appointment(3, 'COMPLETED'),
    appointment(4, 'REJECTED'),
  ]
  let summaries: SessionSummary[] = []
  let mutations = 0
  let denied = false
  await page.route(
    '**/api/consultation/specialist/appointments**',
    async (route) => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname.endsWith('/session-summaries')) {
        if (route.request().method() === 'POST') {
          const input = route.request().postDataJSON()
          const saved: SessionSummary = {
            id: id(500 + summaries.length),
            appointmentId: id(3),
            userAccountId: id(900),
            specialistAccountId: approvedProfile.accountId,
            version: summaries.length + 1,
            schemaVersion: 'session-summary-v1',
            ...input,
            agreedNextSteps: input.agreedNextSteps.map(
              (
                step: { type: string; title: string; details: string | null },
                index: number,
              ) => ({
                ...step,
                id: id(600 + index),
                hidden: false,
                state: null,
                stateVersion: null,
                stateUpdatedAt: null,
              }),
            ),
            amendsSummaryId: summaries[0]?.id ?? null,
            publishedAt: generatedAt,
            reuseConsent: null,
          }
          mutations++
          summaries = [saved, ...summaries]
          return route.fulfill({ json: saved, status: 201 })
        }
        return route.fulfill({
          json: { items: summaries, count: summaries.length, generatedAt },
        })
      }
      const decision = pathname.match(/\/(accept|reject)$/)?.[1]
      if (decision) {
        expect(route.request().headers()['if-match']).toBe('"0"')
        expect(route.request().headers()['idempotency-key']).toMatch(
          /^[0-9a-f-]{36}$/,
        )
        const old = items.find((item) => pathname.includes(item.id))!
        const updated: Appointment = {
          ...old,
          status: decision === 'accept' ? 'CONFIRMED' : 'REJECTED',
          creditState: decision === 'accept' ? 'HELD' : 'AVAILABLE',
          version: 1,
        }
        items = items.map((item) => (item.id === old.id ? updated : item))
        return route.fulfill({ json: updated })
      }
      return route.fulfill({
        json: { items, count: items.length, generatedAt },
      })
    },
  )
  await page.route('**/api/care/specialist/consultation-briefs/**', (route) =>
    denied
      ? route.fulfill({
          status: 403,
          json: {
            type: 'about:blank',
            correlationId: 'synthetic-appointment-permission',
            code: 'CONSULTATION_BRIEF_ACCESS_DENIED',
            status: 403,
            title: 'Không có quyền truy cập',
          },
        })
      : route.fulfill({
          json: {
            snapshotId: id(700),
            appointmentId: id(2),
            supportEvaluationId: id(701),
            currentSituation: 'Nội dung mẫu người dùng đã phê duyệt.',
            userGoals: ['Trao đổi về nhịp sinh hoạt'],
            screeningContext: [],
            snapshotVersion: 1,
            approvedAt: generatedAt,
            accessStartAt: generatedAt,
            accessEndAt: '2026-10-10T03:00:00Z',
            sourceType: 'CONSULTATION_BRIEF',
          },
        }),
  )
  await page.route('**/api/resources**', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await expect(
    page.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).toBeVisible()
  await capture(page, info, '01-mixed-1440')
  const acceptColor = await page
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(acceptColor).not.toBe('rgba(0, 0, 0, 0)')
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await capture(page, info, '02-reject-confirmation')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Từ chối', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).not.toBeVisible()
  await capture(page, info, '03-accepted')
  const completed = page.locator('li[data-status="COMPLETED"]')
  await completed.getByText('Tóm tắt sau phiên', { exact: true }).click()
  await completed
    .getByRole('button', { name: 'Tạo bản tóm tắt', exact: true })
    .click()
  await completed.getByLabel(/Nội dung đã trao đổi/).fill('Nháp không xuất bản')
  await capture(page, info, '04-summary-draft')
  await completed.getByRole('button', { name: 'Hủy bỏ', exact: true }).click()
  expect(mutations).toBe(0)
  await completed
    .getByRole('button', { name: 'Tạo bản tóm tắt', exact: true })
    .click()
  await expect(completed.getByLabel(/Nội dung đã trao đổi/)).toHaveValue('')
  await completed
    .getByLabel(/Nội dung đã trao đổi/)
    .fill('Nội dung đã thống nhất')
  await completed
    .getByLabel('Tên bước 1', { exact: true })
    .fill('Một bước nhỏ cho tuần tới')
  await completed
    .getByRole('button', { name: 'Xuất bản cho người dùng', exact: true })
    .click()
  await expect(
    completed.getByText('Phiên bản 1', { exact: true }),
  ).toBeVisible()
  await capture(page, info, '05-published-summary')
  await completed
    .getByRole('button', { name: 'Đính chính bản tóm tắt', exact: true })
    .click()
  await completed
    .getByLabel(/Nội dung đã trao đổi/)
    .fill('Đính chính chưa xuất bản')
  await capture(page, info, '06-amendment')
  await completed.getByRole('button', { name: 'Hủy bỏ', exact: true }).click()
  expect(mutations).toBe(1)
  await expect(
    completed.getByText('Nội dung đã thống nhất', { exact: true }),
  ).toBeVisible()
  const disclosure = page
    .getByRole('button', { name: 'Xem tóm tắt', exact: true })
    .first()
  await disclosure.click()
  await expect(
    page.getByText('Nội dung mẫu người dùng đã phê duyệt.'),
  ).toBeVisible()
  await capture(page, info, '07-approved-preparation')
  denied = true
  await page
    .getByRole('button', { name: 'Thu gọn tóm tắt', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Xem tóm tắt', exact: true })
    .first()
    .click()
  await expect(page.getByText(/chưa phê duyệt hoặc đã thu hồi/)).toBeVisible()
  await expect(
    page.getByText('Nội dung mẫu người dùng đã phê duyệt.'),
  ).not.toBeVisible()
  for (const width of [1280, 768, 375, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 400 : 900 })
    await capture(page, info, `08-responsive-${width}`)
  }
  await page
    .getByRole('group', { name: 'Lọc lịch hẹn' })
    .getByRole('button', { name: 'Lịch sử', exact: true })
    .click()
  await expect(page.locator('li[data-status="CONFIRMED"]')).toHaveCount(0)
  await expect(completed).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await capture(page, info, '09-history-mobile-reduced-motion')
  expect(errors).toEqual([])
})

test('messages: API phases, acknowledged realtime send, check-in, responsive inbox and keyboard information drawer', async ({
  page,
}, info) => {
  const appointments = [
    appointment(11, 'IN_PROGRESS'),
    appointment(12, 'CONFIRMED'),
    appointment(13, 'CONFIRMED'),
    appointment(14, 'COMPLETED'),
    appointment(15, 'SESSION_ENDED'),
    appointment(16, 'SESSION_ENDED'),
  ]
  const phases: AppointmentChatEligibility['phase'][] = [
    'ACTIVE',
    'WAITING',
    'TOO_EARLY',
    'COMPLETED',
    'ENDED_PROCESSING',
    'USER_NO_SHOW',
  ]
  const checkedIn = new Set<string>()
  const commands: CommandEnvelopeV1[] = []
  const histories = new Map<string, ChatMessage[]>(
    appointments.map((item, index) => [
      item.id,
      index === 2
        ? []
        : [
            {
              messageId: id(500 + index),
              conversationId: item.id,
              senderId: id(901),
              clientMessageId: id(600 + index),
              type: 'TEXT',
              content: `Tin nhắn thử nghiệm cho phiên ${index + 1} có tiếng Việt rõ ràng.`,
              sentAt: generatedAt,
              schemaVersion: 1,
            },
          ],
    ]),
  )
  let denyHistory = false
  await page.route('**/api/consultation/specialist/appointments**', (route) =>
    route.fulfill({
      json: { items: appointments, count: appointments.length, generatedAt },
    }),
  )
  await page.route(
    '**/api/consultation/appointments/*/chat-eligibility**',
    (route) => {
      const appointmentId = new URL(route.request().url()).pathname
        .split('/')
        .at(-2)!
      const index = appointments.findIndex((item) => item.id === appointmentId)
      const item = appointments[index]
      const phase = phases[index]
      const decision: AppointmentChatEligibility = {
        conversationId: item.id,
        appointmentId: item.id,
        userAccountId: id(901),
        specialistAccountId: approvedProfile.accountId,
        phase,
        reasonCode: 'SYNTHETIC_UI_FIXTURE',
        subscribeAllowed: !denyHistory && ['ACTIVE', 'WAITING'].includes(phase),
        sendAllowed: !denyHistory && phase === 'ACTIVE',
        historyAllowed: !denyHistory && phase !== 'TOO_EARLY',
        checkInAllowed: !denyHistory && ['ACTIVE', 'WAITING'].includes(phase),
        participantCheckedIn: checkedIn.has(item.id),
        sessionOutcome: item.sessionOutcome,
        creditState: item.creditState,
        scheduledStartAt: item.scheduledStartAt,
        scheduledEndAt: item.scheduledEndAt,
        serverTime: generatedAt,
      }
      return route.fulfill({ json: decision })
    },
  )
  await page.route('**/api/realtime/conversations/*/messages**', (route) => {
    const appointmentId = new URL(route.request().url()).pathname
      .split('/')
      .at(-2)!
    return route.fulfill({
      json: {
        items: histories.get(appointmentId) ?? [],
        hasMore: false,
        nextCursor: null,
      },
    })
  })
  await page.route('**/api/realtime/socket-credentials', (route) =>
    route.fulfill({
      json: {
        accessToken: 'synthetic-browser-credential'.repeat(3),
        expiresAt: '2099-10-09T03:10:00Z',
        endpoint: 'http://127.0.0.1:3999/',
      },
    }),
  )
  await page.routeWebSocket(
    /ws:\/\/127\.0\.0\.1:3999\/socket\.io\//,
    (socket) => {
      socket.send(
        '0' +
          JSON.stringify({
            sid: 'isolated-ui-fixture',
            upgrades: [],
            pingInterval: 25000,
            pingTimeout: 20000,
            maxPayload: 1000000,
          }),
      )
      const event = (
        eventType: ServerEventV1['eventType'],
        payload: ServerEventV1['payload'],
        index: number,
      ) =>
        socket.send(
          '42/realtime,' +
            JSON.stringify([
              'realtime.event',
              {
                schemaVersion: 1,
                eventId: id(index),
                eventType,
                correlationId: 'synthetic-browser-fixture',
                occurredAt: generatedAt,
                payload,
              },
            ]),
        )
      socket.onMessage((packet) => {
        const text = String(packet)
        if (text.startsWith('40/realtime,')) {
          socket.send(
            '40/realtime,' + JSON.stringify({ sid: 'isolated-namespace' }),
          )
          event(
            'connection.ready',
            {
              accountId: approvedProfile.accountId,
              role: 'SPECIALIST',
              presence: 'connected',
            },
            700 + commands.length,
          )
          return
        }
        const match = text.match(/^42\/realtime,(\d+)(\[.*)$/)
        if (!match) return
        const [, command] = JSON.parse(match[2]) as [string, CommandEnvelopeV1]
        commands.push(command)
        if (command.commandType === 'conversation.check-in')
          checkedIn.add(command.payload.conversationId)
        if (command.commandType === 'message.send') {
          const message: ChatMessage = {
            messageId: id(800 + commands.length),
            conversationId: command.payload.conversationId,
            senderId: approvedProfile.accountId,
            clientMessageId: command.payload.clientMessageId,
            type: 'TEXT',
            content: command.payload.content,
            sentAt: generatedAt,
            schemaVersion: 1,
          }
          histories.get(message.conversationId)?.push(message)
          event('message.created', message, 900 + commands.length)
        }
        socket.send(
          `43/realtime,${match[1]}` +
            JSON.stringify([
              {
                schemaVersion: 1,
                commandId: command.commandId,
                correlationId: command.correlationId,
                status: 'accepted',
                acknowledgedAt: generatedAt,
                liveDelivery: 'not_applicable',
              },
            ]),
        )
      })
    },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await page.goto(`/specialist/messages?appointmentId=${id(11)}`)
  const root = page.locator('[data-specialist-journey="messages"]')
  await expect(
    root.getByText('Tin nhắn thử nghiệm cho phiên 1 có tiếng Việt rõ ràng.'),
  ).toBeVisible()
  await expect
    .poll(() =>
      commands.some(
        (command) => command.commandType === 'conversation.subscribe',
      ),
    )
    .toBe(true)
  await capture(page, info, 'messages-01-active-desktop', 'messages')
  await root
    .getByRole('button', { name: 'Xác nhận tham gia', exact: true })
    .click()
  await expect(
    root.getByRole('button', { name: 'Đã điểm danh', exact: true }),
  ).toBeDisabled()
  const input = root.getByRole('textbox', { name: 'Tin nhắn', exact: true })
  await input.fill('Gõ tiếng Việt\nKhông mất bản nháp')
  await input.press('Shift+Enter')
  expect(
    commands.filter((command) => command.commandType === 'message.send'),
  ).toHaveLength(0)
  await input.press('Enter')
  await expect(root.getByLabel('Tin nhắn của bạn')).toContainText(
    'Gõ tiếng Việt',
  )
  await expect(input).toHaveValue('')
  expect(
    commands.filter((command) => command.commandType === 'message.send'),
  ).toHaveLength(1)
  await capture(page, info, 'messages-02-confirmed-send', 'messages')
  for (const [index, label] of [
    [12, 'Phòng chờ'],
    [13, 'Sắp diễn ra'],
    [14, 'Đã hoàn thành'],
    [15, 'Đang xử lý'],
    [16, 'Người dùng vắng mặt'],
  ] as const) {
    await page.goto(`/specialist/messages?appointmentId=${id(index)}`)
    await expect(root.locator('[data-phase]').first()).toHaveAttribute(
      'data-phase',
      phases[index - 11],
    )
    await expect(
      root.getByRole('textbox', { name: 'Tin nhắn', exact: true }),
    ).toHaveCount(0)
    await expect(
      root.getByText('Cuộc trò chuyện hiện ở chế độ chỉ đọc.'),
    ).toBeVisible()
    await capture(page, info, `messages-03-${index}-${label}`, 'messages')
  }
  await page.goto(`/specialist/messages?appointmentId=${id(11)}`)
  await expect(input).toBeVisible()
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await capture(page, info, `messages-04-chat-${width}`, 'messages')
  }
  const infoButton = root.getByRole('button', {
    name: 'Hiện thông tin buổi hẹn',
    exact: true,
  })
  await infoButton.click()
  const drawer = root.getByRole('dialog', {
    name: 'Thông tin buổi hẹn',
    exact: true,
  })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('Múi giờ: Asia/Ho_Chi_Minh')
  await expect(drawer).toContainText('Điểm danh của bạn')
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(
      await drawer.evaluate((e) => e.contains(document.activeElement)),
    ).toBe(true)
  }
  await capture(page, info, 'messages-05-mobile-info-drawer', 'messages')
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(infoButton).toBeFocused()
  await root
    .getByRole('button', { name: 'Quay lại hộp thư', exact: true })
    .click()
  await expect(
    root.getByRole('heading', { name: 'Hộp thư', exact: true }),
  ).toBeVisible()
  await expect(
    root.getByRole('button', { name: 'Quay lại hộp thư', exact: true }),
  ).not.toBeVisible()
  await capture(page, info, 'messages-06-mobile-inbox', 'messages')
  await root
    .getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' })
    .fill('không tồn tại')
  await expect(
    root.getByText('Không tìm thấy cuộc trò chuyện phù hợp'),
  ).toBeVisible()
  await root.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await root.getByRole('button', { name: /Khách hàng.*Đang diễn ra/ }).click()
  denyHistory = true
  await root.getByRole('button', { name: 'Tải lại phòng chat' }).click()
  await expect(
    root.getByText('Tin nhắn thử nghiệm cho phiên 1 có tiếng Việt rõ ràng.'),
  ).toHaveCount(0)
  await expect(
    root.getByRole('textbox', { name: 'Tin nhắn', exact: true }),
  ).toHaveCount(0)
  await capture(page, info, 'messages-07-permission-denied', 'messages')
})

test('appointment initial error/retry, source empty and filter empty retain the proper context', async ({
  page,
}, info) => {
  let failed = true
  let items: Appointment[] = []
  await page.route('**/api/consultation/specialist/appointments', (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: {
            type: 'about:blank',
            correlationId: 'synthetic-appointment-load-error',
            code: 'DEPENDENCY_UNAVAILABLE',
            status: 503,
            title: 'Không tải được dữ liệu',
          },
        })
      : route.fulfill({ json: { items, count: items.length, generatedAt } }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await expect(
    page.locator('[data-specialist-journey="appointments"]').getByRole('alert'),
  ).toContainText('Chưa thể tải lịch hẹn')
  await expect(page.getByText('Chưa có yêu cầu lịch hẹn')).not.toBeVisible()
  await capture(page, info, '10-error')
  failed = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Chưa có yêu cầu lịch hẹn')).toBeVisible()
  await capture(page, info, '11-source-empty')
  items = [appointment(1, 'REQUESTED')]
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('group', { name: 'Lọc lịch hẹn' })
    .getByRole('button', { name: 'Lịch sử', exact: true })
    .click()
  await expect(page.getByText('Không có lịch hẹn trong nhóm này')).toBeVisible()
  await capture(page, info, '12-filter-empty')
  await page
    .getByRole('button', { name: 'Xem tất cả lịch hẹn', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).toBeVisible()
})

test('clients: selected session, keyboard tabs, search recovery, revoked permission and mobile master/detail', async ({
  page,
}, info) => {
  const first: SpecialistClientContinuityItem = {
    appointmentId: id(1),
    userAccountId: id(901),
    userDisplayName: 'Khách hàng thử nghiệm có tên dài',
    status: 'CONFIRMED',
    modality: 'IN_APP_CHAT',
    scheduledStartAt: '2026-10-10T02:00:00Z',
    scheduledEndAt: '2026-10-10T03:00:00Z',
    appointmentVersion: 1,
    briefAccessState: 'AVAILABLE',
    briefSnapshotVersion: 1,
    briefAccessStartAt: generatedAt,
    briefAccessEndAt: '2026-10-10T03:00:00Z',
  }
  let items: SpecialistClientContinuityItem[] = [
    first,
    {
      ...first,
      appointmentId: id(2),
      status: 'COMPLETED',
      briefAccessState: 'EXPIRED',
      scheduledStartAt: '2026-10-08T02:00:00Z',
      scheduledEndAt: '2026-10-08T03:00:00Z',
    },
  ]
  await page.route('**/api/care/specialist/client-continuity', (route) =>
    route.fulfill({
      json: {
        items,
        count: items.length,
        generatedAt,
        recentSince: '2026-07-09T00:00:00Z',
        policyVersion: 'specialist-client-continuity-v1',
      },
    }),
  )
  await page.route('**/api/consultation/specialist/appointments**', (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith(
        'session-summaries',
      )
        ? { items: [], count: 0, generatedAt }
        : { items: [], count: 0, generatedAt },
    }),
  )
  await page.route('**/api/resources**', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await page.goto(`/specialist/clients?appointmentId=${id(1)}`)
  const root = page.locator('[data-specialist-journey="clients"]')
  await expect(root.getByText(first.userDisplayName).last()).toBeVisible()
  const shot = async (name: string) => {
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo({ top: 0, behavior: 'instant' })
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      )
    })
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    const path = info.outputPath(`${name}.png`)
    await page.screenshot({ path, fullPage: true, animations: 'disabled' })
    await info.attach(name, { path, contentType: 'image/png' })
  }
  await shot('clients-01-desktop')
  await root.getByRole('tab', { name: 'Chuẩn bị phiên' }).focus()
  await page.keyboard.press('End')
  await expect(
    root.getByRole('tab', { name: 'Phạm vi truy cập' }),
  ).toBeFocused()
  await expect(root.getByRole('tabpanel')).toContainText('Thời gian được xem:')
  await expect(root.getByRole('tabpanel')).not.toContainText(id(1))
  await shot('clients-02-access-scope')
  await root
    .getByRole('textbox', { name: 'Tìm khách hàng' })
    .fill('không có tên này')
  await expect(
    root.getByText('Không tìm thấy khách hàng phù hợp.'),
  ).toBeVisible()
  await root
    .getByRole('button', { name: 'Xóa tìm kiếm', exact: true })
    .first()
    .click()
  await expect(
    root.getByRole('textbox', { name: 'Tìm khách hàng' }),
  ).toHaveValue('')
  items = items.map((item) => ({ ...item, briefAccessState: 'REVOKED' }))
  await root.getByRole('button', { name: 'Tải lại khách hàng' }).click()
  await root.getByRole('tab', { name: 'Chuẩn bị phiên' }).click()
  await expect(
    root.getByText('Quyền đã được thu hồi', { exact: true }).last(),
  ).toBeVisible()
  await expect(
    root.getByRole('button', { name: 'Xem tóm tắt', exact: true }),
  ).toHaveCount(0)
  await shot('clients-03-revoked')
  await root.getByRole('button', { name: /Thứ Năm, 08\/10\/2026/ }).click()
  await expect(
    root.getByRole('tab', { name: 'Tổng kết phiên' }),
  ).toHaveAttribute('aria-selected', 'true')
  await root.getByText('Tóm tắt sau phiên', { exact: true }).click()
  await expect(
    root.getByRole('button', { name: 'Tạo bản tóm tắt', exact: true }),
  ).toBeVisible()
  await shot('clients-04-completed')
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await shot(`clients-05-responsive-${width}`)
  }
  await root
    .getByRole('button', { name: 'Danh sách khách hàng', exact: true })
    .click()
  await expect(
    root.getByRole('textbox', { name: 'Tìm khách hàng' }),
  ).toBeVisible()
  await shot('clients-06-mobile-list')
  await root
    .getByRole('button', { name: new RegExp(first.userDisplayName) })
    .click()
  await expect(
    root.getByRole('button', { name: 'Danh sách khách hàng', exact: true }),
  ).toBeVisible()
  await shot('clients-07-mobile-detail')
})

test('follow-up: immutable versions, correct appointment links, permission recovery and mobile master/detail', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const first = appointment(31, 'COMPLETED')
  const second = {
    ...appointment(32, 'COMPLETED'),
    scheduledStartAt: '2026-10-07T02:00:00Z',
    scheduledEndAt: '2026-10-07T03:00:00Z',
  }
  const third = {
    ...appointment(33, 'COMPLETED'),
    scheduledStartAt: '2026-10-06T02:00:00Z',
    scheduledEndAt: '2026-10-06T03:00:00Z',
  }
  let items = [first, second, third, appointment(34, 'CONFIRMED')]
  const original: SessionSummary = {
    id: id(531),
    appointmentId: first.id,
    userAccountId: id(931),
    specialistAccountId: approvedProfile.accountId,
    version: 3,
    schemaVersion: 'session-summary-v1',
    topicsDiscussed: ['Giấc ngủ và nhịp sinh hoạt'],
    progressSummary: 'Nội dung bản xuất bản trước, không bị sửa bởi bản mới.',
    specialistNoteForUser: 'Lời nhắn thử nghiệm bằng tiếng Việt.',
    followUpSuggested: true,
    amendsSummaryId: null,
    publishedAt: '2026-10-08T03:10:00Z',
    reuseConsent: null,
    agreedNextSteps: [
      {
        id: id(631),
        type: 'JOURNAL',
        title: 'Ghi lại giờ ngủ đã thống nhất',
        details: 'Không phải dữ liệu tiến độ do hệ thống suy đoán.',
        resourceId: null,
        resourceVersion: null,
        resourceProposalReasonCode: null,
        state: null,
        hidden: false,
        stateVersion: null,
        stateUpdatedAt: null,
      },
    ],
  }
  const latest = {
    ...original,
    id: id(532),
    version: 4,
    amendsSummaryId: original.id,
    progressSummary: 'Nội dung bản đính chính mới nhất cho đúng phiên.',
    publishedAt: '2026-10-08T04:10:00Z',
  }
  let denyList = false
  let denyDetail = false
  await page.route(
    '**/api/consultation/specialist/appointments**',
    async (route) => {
      expect(route.request().method()).toBe('GET')
      const pathname = new URL(route.request().url()).pathname
      if (pathname.endsWith('/session-summaries')) {
        if (denyDetail)
          return route.fulfill({
            status: 403,
            json: {
              error: { code: 'FORBIDDEN', message: 'permission revoked' },
            },
          })
        const summaries = pathname.includes(first.id) ? [original, latest] : []
        return route.fulfill({
          json: { items: summaries, count: summaries.length, generatedAt },
        })
      }
      if (denyList)
        return route.fulfill({
          status: 403,
          json: { error: { code: 'FORBIDDEN', message: 'permission revoked' } },
        })
      return route.fulfill({
        json: { items, count: items.length, generatedAt },
      })
    },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await page.goto(`/specialist/follow-up?appointmentId=${first.id}`)
  const root = page.locator('[data-specialist-journey="follow-up"]')
  const detail = root.getByRole('region', { name: 'Nội dung phiên đã chọn' })
  await expect(detail.getByText(latest.progressSummary!)).toBeVisible()
  await expect(detail.getByText('Bản đính chính · Bản 4')).toBeVisible()
  await expect(
    detail.getByRole('link', { name: 'Xem lại hội thoại' }),
  ).toHaveAttribute('href', `/specialist/messages?appointmentId=${first.id}`)
  const manage = detail.getByRole('link', { name: 'Quản lý trong lịch hẹn' })
  await expect(manage).toHaveAttribute(
    'href',
    `/specialist/appointments?appointmentId=${first.id}`,
  )
  await capture(page, info, 'follow-up-01-latest-desktop', 'follow-up')
  await root.getByRole('tab', { name: 'Mới nhất · Bản 4' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(root.getByRole('tab', { name: 'Bản 3' })).toBeFocused()
  await expect(detail.getByText(original.progressSummary!)).toBeVisible()
  await root.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(root.getByRole('tab', { name: 'Bản 3' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(detail.getByText(original.progressSummary!)).toBeVisible()
  await capture(page, info, 'follow-up-02-original-version', 'follow-up')
  await manage.click()
  await expect(page.locator(`#appointment-${first.id}`)).toBeFocused()
  await expect(
    page.getByRole('button', { name: 'Xuất bản bản tóm tắt', exact: true }),
  ).toHaveCount(0)
  await page.goto(`/specialist/follow-up?appointmentId=${first.id}`)
  await expect(detail.getByText(latest.progressSummary!)).toBeVisible()
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await capture(page, info, `follow-up-03-detail-${width}`, 'follow-up')
  }
  await root.getByRole('button', { name: 'Quay lại danh sách phiên' }).click()
  const selectedRow = root.getByRole('button', { name: /08\/10\/2026/ })
  await expect(selectedRow).toBeFocused()
  await expect(
    root.getByRole('heading', { name: 'Đã hoàn thành', exact: true }),
  ).toBeVisible()
  await capture(page, info, 'follow-up-04-mobile-list', 'follow-up')
  await selectedRow.click()
  await expect(detail.getByText(latest.progressSummary!)).toBeVisible()
  await root.getByRole('button', { name: 'Quay lại danh sách phiên' }).click()
  await root.getByRole('button', { name: /07\/10\/2026/ }).click()
  await expect(detail.getByText('Chưa có bản tóm tắt sau phiên')).toBeVisible()
  await expect(
    detail.getByRole('link', { name: 'Mở lịch hẹn' }),
  ).toHaveAttribute(
    'href',
    `/specialist/appointments?appointmentId=${second.id}`,
  )
  await capture(page, info, 'follow-up-05-missing-summary', 'follow-up')
  await root.getByRole('button', { name: 'Quay lại danh sách phiên' }).click()
  await root.getByRole('button', { name: /08\/10\/2026/ }).click()
  await expect(detail.getByText(latest.progressSummary!)).toBeVisible()
  denyDetail = true
  await root.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(detail.getByRole('alert')).toContainText(
    'Bản tóm tắt này không còn khả dụng',
  )
  await expect(root.getByText(latest.progressSummary!)).toHaveCount(0)
  await capture(page, info, 'follow-up-06-detail-denied', 'follow-up')
  denyDetail = false
  await detail.getByRole('button', { name: 'Thử lại' }).click()
  await expect(detail.getByText(latest.progressSummary!)).toBeVisible()
  denyList = true
  await root.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(root.getByRole('alert')).toContainText(
    'không có quyền xem lịch hẹn',
  )
  await expect(root.getByText(latest.progressSummary!)).toHaveCount(0)
  await capture(page, info, 'follow-up-07-list-denied', 'follow-up')
  denyList = false
  items = []
  await root.getByRole('button', { name: 'Thử lại' }).click()
  await expect(
    root.getByText('Chưa có phiên tư vấn đã hoàn thành'),
  ).toBeVisible()
  await capture(page, info, 'follow-up-08-source-empty', 'follow-up')
  items = [first]
  await page.goto(`/specialist/follow-up?appointmentId=${id(999)}`)
  await expect(detail.getByText('Chọn một phiên đã hoàn thành')).toBeVisible()
  await expect(root.getByText(latest.progressSummary!)).toHaveCount(0)
  await capture(page, info, 'follow-up-09-missing-deep-link', 'follow-up')
  await root.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(
    root.getByRole('button', { name: 'Tải lại', exact: true }),
  ).toBeEnabled()
  await expect(detail.getByText('Chọn một phiên đã hoàn thành')).toBeVisible()
  await expect(root.getByText(latest.progressSummary!)).toHaveCount(0)
  expect(errors).toEqual([])
})
