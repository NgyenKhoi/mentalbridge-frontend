import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const prototypeMode = process.argv.includes('--prototype')
const productionMode = process.argv.includes('--production')

// Captures the existing real route, not a replacement application shell.
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: productionMode ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] : [] })
try {
  const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })
  const page = await context.newPage()
  const renderErrors = []
  page.on('pageerror', error => renderErrors.push(error.message))
  const id = '123e4567-e89b-42d3-a456-426614174003'
  const appointment = {
    id, slotId: '123e4567-e89b-42d3-a456-426614174004',
    specialistAccountId: '10000000-0000-4000-8000-000000000003',
    specialistDisplayName: 'Chuyên gia An', status: 'CONFIRMED', modality: 'IN_APP_VIDEO',
    scheduledStartAt: '2099-01-03T04:00:00Z', scheduledEndAt: '2099-01-03T05:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh', requestedAt: '2099-01-01T00:00:00Z',
    decisionDeadlineAt: '2099-01-01T05:00:00Z', heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
    replacesAppointmentId: null, replacedByAppointmentId: null, originatingPlanActionId: null,
    decidedAt: '2099-01-01T01:00:00Z', decisionReason: 'SPECIALIST_ACCEPTED',
    cancelledAt: null, cancellationReason: null, cancellationActor: null, cancellationCreditOutcome: null,
    sessionOutcome: null, sessionOutcomeReason: null, sessionPolicyVersion: null,
    sessionEndedAt: null, sessionSettledAt: null, completionFactId: null,
    creditState: 'HELD', history: [], version: 1,
  }
  await page.route('**/api/consultation/appointments', route => route.fulfill({ json: { items: [appointment], count: 1, generatedAt: '2026-10-12T10:00:00Z' } }))
  await page.route('**/api/consultation/bookable-slots', route => route.fulfill({ json: { items: [], count: 0, generatedAt: '2026-10-12T10:00:00Z', videoEnabled: true } }))
  if (productionMode) await page.route('**/api/consultation/appointments/*/video-session', route => route.fulfill({ json: {
    appointmentId: id, phase: 'WAITING', previewAllowed: true, joinAllowed: false,
    startsAt: appointment.scheduledStartAt, endsAt: appointment.scheduledEndAt,
    serverTime: '2099-01-03T03:57:00Z', version: 1, completion: null,
  } }))
  await page.goto('http://127.0.0.1:3100/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL(/\/dashboard$/)
  await page.goto(`http://127.0.0.1:3100/appointments/${id}`)
  await page.getByRole('heading', { name: 'Chi tiết lịch hẹn', exact: true }).waitFor()
  await page.getByText('Chuyên gia An', { exact: true }).first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  if (productionMode) {
    await page.getByRole('button', { name: 'Phiên tư vấn video', exact: true }).click()
    await page.getByRole('button', { name: 'Kiểm tra camera và micro', exact: true }).click()
    await page.getByText('Đã mở thiết bị trên máy. Chưa kết nối với người còn lại.').waitFor()
    if (await page.getByRole('button', { name: 'Tham gia phiên tư vấn' }).isEnabled()) throw new Error('Waiting room must not join')
    if (await page.getByRole('button', { name: 'Xác nhận kết thúc buổi tư vấn' }).count()) throw new Error('USER completion action leaked')
    await page.getByRole('button', { name: 'Dừng kiểm tra thiết bị' }).click()
  }
  if (prototypeMode) {
    const source = await readFile(new URL('./video-specialist-desktop-prototype.html', import.meta.url), 'utf8')
    const adapted = source.replace('</body>', `<style>#app-root,#open-end-session-modal-btn{display:none!important}body{background:transparent!important;display:block!important;margin:0!important}#video-room-container{min-height:520px;margin:0}</style><script>document.body.prepend(document.getElementById('video-room-container'));</script></body>`)
    await page.evaluate(srcdoc => {
      const iframe = document.createElement('iframe')
      iframe.title = 'Prototype phiên video trong chi tiết lịch hẹn'
      iframe.style.cssText = 'display:block;width:100%;height:650px;border:0;margin-top:24px'
      iframe.srcdoc = srcdoc
      document.querySelector('main').append(iframe)
    }, adapted)
    const frame = page.frameLocator('iframe[title="Prototype phiên video trong chi tiết lịch hẹn"]')
    await frame.locator('#join-room-btn').click()
    await frame.locator('#room-status-text').filter({ hasText: 'Đang chờ' }).waitFor()
    await frame.locator('#temporary-leave-btn').click()
    await frame.locator('#join-room-btn').waitFor()
    if (await frame.locator('#open-end-session-modal-btn').isVisible()) throw new Error('USER sees specialist completion action')
  }
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 })
    if (prototypeMode) await page.locator('iframe').evaluate(async iframe => {
      await iframe.contentDocument.fonts.ready
      iframe.style.height = `${iframe.contentDocument.querySelector('#video-room-container').getBoundingClientRect().height + 8}px`
    })
    // Interactions auto-scroll. Reset before full-page capture so fixed shell chrome
    // is photographed at the viewport origin, not at the previous scroll offset.
    await page.evaluate(async () => {
      window.scrollTo({ top: 0, behavior: 'instant' })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.screenshot({ path: new URL(`./${productionMode ? 'production' : prototypeMode ? 'prototype' : 'baseline'}-user-appointment-${width}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true, animations: 'disabled' })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('USER route overflow')
  }
  if (renderErrors.length) throw new Error(renderErrors.join('\n'))
  console.log(`Captured real USER appointment detail ${prototypeMode ? 'with interactive Stitch panel' : 'baseline'} at 1440 and 375px.`)
} finally {
  await browser.close()
}
