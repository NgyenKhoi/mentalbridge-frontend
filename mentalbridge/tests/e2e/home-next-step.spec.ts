import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import {
  homeWorld,
  installHomeMocks,
  keyboardActivate,
  keyboardFocus,
  planEmotionHomeHref,
  setHomeHour,
  v2HomeWorld,
  type HomeAcceptanceState,
} from './home-next-step-mocks'

test.describe('MB-672 Home next step', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Home decisions use browser-owned fixtures only.',
  )

  for (const width of [1440, 375]) {
    test(`keyboard resource completion returns through Today to a fresh Home decision at ${width}`, async ({
      page,
    }) => {
      const world = homeWorld('do-today')
      await installHomeMocks(page, world)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      const next = page.getByRole('region', {
        name: 'Bước tiếp theo',
        exact: true,
      })
      await keyboardActivate(
        page,
        next.getByRole('link', {
          name: 'Bắt đầu ngay',
          exact: true,
        }),
      )
      await expect(page).toHaveURL(/\/resources\/.*from=support-plan/)
      for (const name of [
        /gọi tên cảm xúc hiện tại/i,
        /viết tự do/i,
        /điều dịu dàng/i,
      ]) {
        const checkbox = page.getByRole('checkbox', { name })
        await keyboardActivate(page, checkbox, 'Space')
        await expect(checkbox).toBeChecked()
      }
      await keyboardActivate(
        page,
        page.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }),
      )
      await keyboardActivate(
        page,
        page.getByRole('link', { name: 'Quay lại kế hoạch', exact: true }),
      )
      await expect(page).toHaveURL(/\/support-plan\?.*source=resource/)
      await expect(
        page.getByRole('region', { name: 'Đã ghi nhận hôm nay' }),
      ).toContainText('Viết vài dòng dịu dàng')
      const readsBeforeReturn = world.homeReads
      if (width === 375)
        await keyboardActivate(
          page,
          page.getByRole('button', { name: 'Mở menu', exact: true }),
        )
      await keyboardActivate(
        page,
        page
          .getByRole('navigation', { name: 'Điều hướng chính', exact: true })
          .getByRole('link', { name: 'Tổng quan', exact: true }),
      )
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(next).toContainText('Bạn đã xong việc hôm nay')
      expect(world.homeReads).toBeGreaterThan(readsBeforeReturn)
      expect(world.occurrences[0].state).toBe('COMPLETED')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    })

    test(`keyboard plan emotion origin saves and returns Home at ${width}`, async ({
      page,
    }) => {
      const world = homeWorld('plan-emotion-origin')
      await installHomeMocks(page, world)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      await keyboardActivate(
        page,
        page
          .getByRole('region', { name: 'Bước tiếp theo', exact: true })
          .getByRole('link', {
            name: 'Bắt đầu ngay',
            exact: true,
          }),
      )
      await expect(page).toHaveURL(
        new RegExp(
          planEmotionHomeHref(world).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        ),
      )
      await expect(
        page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
      ).toHaveCount(0)
      await expect(
        page
          .locator('#emotion-check-in')
          .getByRole('radio', { name: 'Tốt', exact: true }),
      ).toBeVisible()
      await keyboardActivate(
        page,
        page.getByRole('radio', { name: 'Rất tốt', exact: true }),
        'ArrowRight',
      )
      await expect(
        page.getByRole('radio', { name: 'Tốt', exact: true }),
      ).toBeChecked()
      await keyboardActivate(
        page,
        page.getByRole('radio', { name: '1', exact: true }),
        'ArrowRight',
      )
      await keyboardActivate(
        page,
        page.getByRole('button', { name: 'Lưu ghi nhận', exact: true }),
      )
      await expect(
        page.getByText('Đã lưu ghi nhận hôm nay.', { exact: true }),
      ).toBeVisible()
      expect(world.emotionSaves).toBe(1)
      await keyboardActivate(
        page,
        page.getByRole('link', { name: 'Về trang chính', exact: true }),
      )
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(
        page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Cảm xúc hôm nay', exact: true }),
      ).toBeVisible()
    })
  }

  const cases: Array<[HomeAcceptanceState, string, string]> = [
    ['first-use', 'Bắt đầu kiểm tra ban đầu', '/initial-check'],
    ['assessment-in-progress', 'Tiếp tục kiểm tra ban đầu', '/initial-check'],
    ['guide-required', 'Xem kết quả và hướng dẫn của bạn', '/support-guides'],
    ['free-resources', 'Mở tài nguyên được gợi ý', '/support-guides/'],
    ['plus-proposal', 'Xem đề xuất kế hoạch 14 ngày', '/support-plan'],
    ['paused', 'Xem và tiếp tục kế hoạch', '/support-plan'],
    ['review-due', 'Xem lại kế hoạch', '/support-plan?review=open'],
  ]
  for (const width of [1440, 375])
    for (const [state, label, href] of cases) {
      test(`${state} exposes a keyboard-accessible next step and useful Home sections at ${width}`, async ({
        page,
      }) => {
        const world = homeWorld(state)
        await installHomeMocks(page, world)
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/dashboard')
        const next = page.getByRole('region', {
          name: 'Bước tiếp theo',
          exact: true,
        })
        const primary = next.getByRole('link', { name: label, exact: true })
        await expect(primary).toBeVisible()
        await keyboardFocus(page, primary)
        await expect(primary).toBeFocused()
        expect(await primary.getAttribute('href')).toContain(href)
        await expect(
          page.locator(
            '.ref-panel-result, .ref-panel-progress, .ref-journal-streak',
          ),
        ).toHaveCount(0)
        await expect(
          page.getByRole('heading', { name: 'Cảm xúc hôm nay', exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'Hành động nhanh', exact: true }),
        ).toBeVisible()
        await expect(
          page.getByTestId('home-upcoming-appointment'),
        ).toBeVisible()
      })
    }

  test('safety help is tappable and still, even with a plan', async ({
    page,
  }) => {
    const world = homeWorld('safety-with-plan')
    await installHomeMocks(page, world)
    await installSafetyEntranceProbe(page)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const next = page.getByRole('region', {
      name: 'Bước tiếp theo',
      exact: true,
    })
    await expect(next.locator('a[href^="tel:"]').first()).toBeVisible()
    await expect(
      next.getByRole('link', { name: 'Xem nơi hỗ trợ', exact: true }),
    ).toBeVisible()
    await expect(
      next.getByRole('link', { name: 'Mở kế hoạch', exact: true }),
    ).toHaveAttribute('href', '/support-plan')
    await expect(page.getByTestId('home-resources')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.homeSafetyMotion),
      )
      .toBe('still')
  })

  test('professional support stays ahead of an open plan activity', async ({
    page,
  }) => {
    const world = homeWorld('do-today')
    world.journey.nextAction = 'FIND_SPECIALIST'
    await installHomeMocks(page, world)
    await page.goto('/dashboard')
    const next = page.getByRole('region', {
      name: 'Bước tiếp theo',
      exact: true,
    })
    await expect(
      next.getByRole('link', { name: 'Tìm chuyên gia phù hợp', exact: true }),
    ).toHaveAttribute(
      'href',
      /\/specialists\?from=support-guide&supportGuideId=/,
    )
    await expect(next.getByRole('link', { name: /^Bắt đầu:/ })).toHaveCount(0)
  })

  for (const width of [1440, 375]) {
    for (const invalidOrigin of [false, true]) {
      test(`safety stays primary over a ${invalidOrigin ? 'invalid' : 'valid'} plan emotion URL at ${width}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        const world = homeWorld('plan-emotion-origin')
        world.journey.nextAction = 'REVIEW_SAFETY_SUPPORT'
        await installHomeMocks(page, world)
        await installSafetyEntranceProbe(page)
        await page.goto(
          invalidOrigin
            ? '/dashboard?occurrenceId=invalid'
            : planEmotionHomeHref(world),
        )
        const next = page.getByRole('region', {
          name: 'Bước tiếp theo',
          exact: true,
        })
        await expect(next.locator('a[href^="tel:"]').first()).toBeVisible()
        await expect(
          next.getByRole('link', { name: 'Xem nơi hỗ trợ', exact: true }),
        ).toHaveAttribute('href', '/safety-directory')
        await expect(
          page.getByRole('region', { name: 'Cảm xúc trong kế hoạch' }),
        ).toHaveCount(0)
        await expect(page.getByTestId('home-resources')).toHaveCount(0)
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.dataset.homeSafetyMotion,
            ),
          )
          .toBe('still')
      })
    }
    for (const stage of ['ASSESSMENT_REQUIRED', 'GUIDE_REQUIRED'] as const) {
      test(`${stage} remains primary with an existing plan at ${width}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        const world = homeWorld('do-today')
        world.journey = {
          ...world.journey,
          ...homeWorld(
            stage === 'ASSESSMENT_REQUIRED' ? 'first-use' : 'guide-required',
          ).journey,
        }
        await installHomeMocks(page, world)
        await page.goto('/dashboard')
        const next = page.getByRole('region', {
          name: 'Bước tiếp theo',
          exact: true,
        })
        await expect(
          next.getByRole('link', {
            name:
              stage === 'ASSESSMENT_REQUIRED'
                ? 'Bắt đầu kiểm tra ban đầu'
                : 'Xem kết quả và hướng dẫn của bạn',
            exact: true,
          }),
        ).toHaveAttribute(
          'href',
          stage === 'ASSESSMENT_REQUIRED'
            ? '/initial-check'
            : '/support-guides',
        )
        await expect(
          next.getByRole('link', { name: 'Bắt đầu ngay', exact: true }),
        ).toHaveCount(0)
        await expect(next.locator('[data-home-art]')).toHaveAttribute(
          'data-home-art',
          stage === 'ASSESSMENT_REQUIRED' ? 'questionnaire' : 'book',
        )
      })
    }
  }

  test('503 retries while exploration and navigation remain usable', async ({
    page,
  }) => {
    const world = homeWorld('unavailable')
    await installHomeMocks(page, world)
    await page.goto('/dashboard')
    await expect(page.getByText('Chưa tải được bước tiếp theo.')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Tài nguyên', exact: true }).last(),
    ).toHaveAttribute('href', '/resources')
    world.state = 'first-use'
    world.journey = homeWorld('first-use').journey
    await keyboardActivate(
      page,
      page
        .getByRole('region', { name: 'Bước tiếp theo', exact: true })
        .getByRole('button', { name: 'Thử lại', exact: true }),
    )
    await expect(
      page.getByRole('link', { name: 'Bắt đầu kiểm tra ban đầu', exact: true }),
    ).toBeVisible()
    expect(world.homeReads).toBe(2)
  })

  for (const width of [1440, 375]) {
    for (const [state, heading, count, tag] of [
      ['resources-plan-three', 'Dành cho bạn', 3, 'Trong kế hoạch'],
      ['resources-plan-one', 'Dành cho bạn', 1, 'Trong kế hoạch'],
      ['resources-guide', 'Dành cho bạn', 3, 'Từ hướng dẫn của bạn'],
      ['resources-library', 'Từ thư viện MentalBridge', 3, null],
    ] as const) {
      test(`${state} renders truthful resource sources at ${width}`, async ({
        page,
      }) => {
        const world = v2HomeWorld(state)
        await installHomeMocks(page, world)
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/dashboard')
        const resources = page.getByTestId('home-resources')
        await expect(
          resources.getByRole('heading', { name: heading, exact: true }),
        ).toBeVisible()
        await expect(
          resources.locator('[data-testid^="home-resource-"]'),
        ).toHaveCount(count)
        if (tag)
          await expect(resources.getByText(tag, { exact: true })).toHaveCount(
            count,
          )
        const first = resources.getByTestId('home-resource-0')
        if (state.startsWith('resources-plan'))
          await expect(first).toHaveAttribute('href', /from=support-plan/)
        if (state.startsWith('resources-plan'))
          await expect(
            resources.getByRole('heading', {
              name: 'Viết vài dòng dịu dàng',
              exact: true,
            }),
          ).toHaveCount(0)
        if (state === 'resources-library')
          await expect(
            resources.getByText('Dành cho bạn', { exact: true }),
          ).toHaveCount(0)
      })
    }

    test(`section-local errors retry independently at ${width}`, async ({
      page,
    }) => {
      const world = v2HomeWorld('resources-content-error')
      world.appointmentState = 'error'
      world.week = 'error'
      await installHomeMocks(page, world)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      const resources = page.getByTestId('home-resources')
      const appointment = page.getByTestId('home-upcoming-appointment')
      await expect(
        resources.getByRole('button', { name: 'Thử lại', exact: true }),
      ).toBeVisible()
      await expect(appointment).toContainText('Chưa tải được lịch hẹn.')
      world.contentError = false
      await keyboardActivate(
        page,
        resources.getByRole('button', { name: 'Thử lại', exact: true }),
      )
      await expect(resources.getByTestId('home-resource-0')).toBeVisible()
      await expect(appointment).toContainText('Chưa tải được lịch hẹn.')
      world.appointmentState = 'upcoming'
      await keyboardActivate(
        page,
        appointment.getByRole('button', { name: 'Thử lại', exact: true }),
      )
      await expect(appointment).toContainText('Nguyễn Minh An')
      await expect(appointment).toContainText('09:00')
      await expect(appointment).toContainText('còn 2 ngày')
      await expect(
        appointment.getByRole('link', { name: /Xem chi tiết buổi hẹn/ }),
      ).toHaveAttribute('href', /appointments/)
      await expect(
        page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
      ).toBeVisible()
    })

    test(`mood selection reveals intensity and save updates the week at ${width}`, async ({
      page,
    }) => {
      const world = v2HomeWorld('check-in-idle')
      world.week = 'none'
      await installHomeMocks(page, world)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      const mood = page.locator('#emotion-check-in')
      await expect(
        mood.getByRole('radiogroup', { name: /Mức độ/ }),
      ).toHaveCount(0)
      await keyboardActivate(
        page,
        mood.getByRole('radio', { name: 'Rất tốt', exact: true }),
        'ArrowRight',
      )
      await expect(
        mood.getByRole('radio', { name: 'Tốt', exact: true }),
      ).toBeChecked()
      await expect(
        mood.getByRole('radio', { name: '3', exact: true }),
      ).toBeVisible()
      await keyboardActivate(
        page,
        mood.getByRole('radio', { name: '1', exact: true }),
        'ArrowRight',
      )
      await page.keyboard.press('ArrowRight')
      await keyboardActivate(
        page,
        mood.getByRole('button', { name: 'Lưu ghi nhận', exact: true }),
      )
      await expect(mood).toContainText('Đã ghi nhận: Tốt')
      await expect(
        page
          .getByRole('list', { name: 'Cảm xúc 7 ngày gần đây', exact: true })
          .getByRole('listitem'),
      ).toHaveCount(7)
      expect(world.emotionSaves).toBe(1)
    })
  }

  for (const [state, hour, greeting, plan] of [
    ['hero-morning-plan', 8, 'Chào buổi sáng', true],
    ['hero-afternoon-plan', 14, 'Chào buổi chiều', true],
    ['hero-evening-plan', 20, 'Chào buổi tối', true],
    ['hero-morning-no-plan', 8, 'Chào buổi sáng', false],
  ] as const) {
    test(`${state} shows a local greeting and authoritative plan day`, async ({
      page,
    }) => {
      await setHomeHour(page, hour)
      await installHomeMocks(page, v2HomeWorld(state))
      await page.goto('/dashboard')
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        greeting,
      )
      await expect(
        page.getByText(/Bạn đang ở ngày 6 của kế hoạch 14 ngày/),
      ).toHaveCount(plan ? 1 : 0)
      const quick = page.getByRole('region', {
        name: 'Hành động nhanh',
        exact: true,
      })
      await expect(
        quick.getByRole('link', { name: /Viết nhật ký/ }),
      ).toHaveAttribute('href', /journal/)
      await expect(
        quick.getByRole('link', { name: /Kiểm tra ban đầu/ }),
      ).toHaveAttribute('href', '/initial-check')
      await expect(
        quick.getByRole('link', { name: /Tìm chuyên gia/ }),
      ).toHaveAttribute('href', '/specialists')
      await expect(
        quick.getByRole('link', { name: /Cộng đồng/ }),
      ).toHaveAttribute('href', '/community')
      await expect(
        quick.getByRole('link', { name: /Tài nguyên/ }),
      ).toHaveAttribute('href', '/resources')
    })
  }

  for (const week of ['all', 'mixed', 'none'] as const) {
    test(`week ${week} keeps seven factual days and neutral gaps`, async ({
      page,
    }) => {
      const world = homeWorld('first-use')
      world.week = week
      await installHomeMocks(page, world)
      await page.goto('/dashboard')
      await expect(
        page
          .getByRole('list', { name: 'Cảm xúc 7 ngày gần đây', exact: true })
          .getByRole('listitem'),
      ).toHaveCount(7)
      await expect(
        page.getByRole('link', { name: /Xem tiến độ/ }),
      ).toHaveAttribute('href', '/analytics')
      await expect(page.getByText(/chuỗi|streak|điểm thưởng/i)).toHaveCount(0)
    })
  }

  test('reduced motion keeps arriving Home content readable without movement or loops', async ({
    page,
  }) => {
    const world = homeWorld('do-today')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installHomeMocks(page, world)
    await page.goto('/dashboard')
    const band = page.getByRole('region', {
      name: 'Bước tiếp theo',
      exact: true,
    })
    await expect(band).toBeVisible()
    const moving = await page.locator('.home-hub').evaluate(
      (element) =>
        [...element.getAnimations({ subtree: true })].filter((animation) => {
          const effect = animation.effect
          if (!(effect instanceof KeyframeEffect)) return false
          return (
            effect
              .getKeyframes()
              .some((frame) => frame.transform && frame.transform !== 'none') ||
            effect.getTiming().iterations === Infinity
          )
        }).length,
    )
    expect(moving).toBe(0)
  })
})

async function installSafetyEntranceProbe(
  page: import('@playwright/test').Page,
) {
  await page.addInitScript(() => {
    let firstSeen = 0
    let sampleCount = 0
    let moving = false
    function sample(now: number) {
      const card = document.querySelector('.home-next-step--safety')
      if (card) {
        if (!firstSeen) firstSeen = now
        sampleCount++
        for (let node: Element | null = card; node; node = node.parentElement) {
          if (
            node
              .getAnimations()
              .some((animation) => animation.playState === 'running')
          )
            moving = true
          if (node.matches('main')) break
        }
        if (now - firstSeen >= 350) {
          document.documentElement.dataset.homeSafetyMotion =
            !moving && sampleCount > 2 ? 'still' : 'moving'
          return
        }
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}
