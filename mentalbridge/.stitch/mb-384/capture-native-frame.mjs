import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const role of ['specialist', 'user']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:3194/?role=${role}`)
    await page.getByText(role === 'user' ? 'Lịch hẹn của bạn' : 'Chuẩn bị và tiếp nối phiên tư vấn', { exact: true }).waitFor()
    if (role === 'user') await page.getByRole('button', { name: /^Xem lịch / }).click()
    if (role === 'specialist') await page.getByText('Thông tin chuẩn bị được chia sẻ', { exact: true }).waitFor()
    await page.screenshot({ path: new URL(`./baseline-native-${role}-375.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true })
    const source = await readFile(new URL('./video-specialist-desktop-prototype.html', import.meta.url), 'utf8')
    const adapted = source.replace('</body>', `<style>#app-root${role === 'user' ? ',#open-end-session-modal-btn' : ''}{display:none!important}body{background:transparent!important;display:block!important;margin:0!important}#video-room-container{margin:0}</style><script>document.body.prepend(document.getElementById('video-room-container'));</script></body>`)
    await page.evaluate(({ srcdoc, role }) => {
      const context = role === 'user' ? document.querySelector('[data-testid="appointment-detail"]')
        : [...document.querySelectorAll('div')].find(el => el.textContent === 'Thông tin chuẩn bị được chia sẻ')?.parentElement?.parentElement
      const iframe = document.createElement('iframe')
      iframe.title = 'Prototype video trong khung ứng dụng gốc'
      iframe.style.cssText = 'display:block;width:100%;height:650px;border:0;margin-top:16px'
      iframe.srcdoc = srcdoc
      if (!context) throw new Error('Native route context not found')
      if (role === 'user') context.append(iframe)
      else context.after(iframe)
    }, { srcdoc: adapted, role })
    const frame = page.frameLocator('iframe')
    await frame.locator('#join-room-btn').click()
    await frame.locator('#room-status-text').filter({ hasText: 'Đang chờ' }).waitFor()
    await frame.locator('#toggle-cam-btn').click()
    await frame.locator('#temporary-leave-btn').click()
    await frame.locator('#join-room-btn').waitFor()
    await page.locator('iframe').evaluate(async iframe => {
      await iframe.contentDocument.fonts.ready
      iframe.style.height = `${iframe.contentDocument.querySelector('#video-room-container').getBoundingClientRect().height + 8}px`
    })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Native route overflow')
    if (errors.length) throw new Error(errors.join('\n'))
    await page.screenshot({ path: new URL(`./prototype-native-${role}-375.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true })
    await page.close()
  }
  console.log('Native route full-frame composites: USER + SPECIALIST, join/camera/leave, no overflow or render exceptions. RN Web visual proxy only; not Android execution.')
} finally { await browser.close() }
