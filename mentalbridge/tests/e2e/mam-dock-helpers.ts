import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { expect, type Locator, type Page } from '@playwright/test'

// Shared by the Mầm dock and release-gate specs (MB-768, MB-775).

// MB-781: built chunks only the dock host, its character or Rive need, found by
// content in the build the E2E servers run (hashes change per build).
export function mamExclusiveChunks() {
  const directory = resolve('.next', 'static', 'chunks')
  const chunks = readdirSync(directory)
    .filter(
      (name) =>
        name.endsWith('.js') &&
        /data-mam-dock|data-mam-status|@rive-app/.test(
          readFileSync(join(directory, name), 'utf8'),
        ),
    )
    .map((name) => `/_next/static/chunks/${name}`)
  // The host and the Rive runtime are separate chunks; fewer means the markers broke.
  expect(chunks.length).toBeGreaterThanOrEqual(2)
  return new Set(chunks)
}

export const dock = (page: Page) =>
  page.getByRole('button', { name: 'Mầm', exact: true })
export const menu = (page: Page) => page.getByRole('group', { name: 'Mầm' })
export const crisis = (page: Page) =>
  page.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' })

export async function box(locator: Locator) {
  const value = await locator.boundingBox()
  if (!value) throw new Error('element has no box')
  return value
}

export function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

export async function expectPageActionsClickable(page: Page) {
  let overlapping: string[] = []
  await expect(async () => {
    const dockBox = await box(dock(page))
    expect(overlaps(dockBox, await box(crisis(page)))).toBe(false)
    const result = await page.evaluate((rect) => {
      const hits: string[] = []
      const blocked: object[] = []
      const content = document.querySelector('.ref-content')
      for (const element of content?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
      ) ?? []) {
        if (element.closest('[data-mam-dock]')) continue
        const r = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        if (
          r.width === 0 ||
          r.height === 0 ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          style.opacity === '0' ||
          // Native emotion radios use a fully clipped 1px box; the visible
          // label is their pointer target, so these are not visible actions.
          (style.clipPath === 'inset(50%)' && r.width <= 1 && r.height <= 1)
        )
          continue
        const left = Math.max(r.left, rect.x, 0)
        const right = Math.min(r.right, rect.x + rect.width, innerWidth)
        const top = Math.max(r.top, rect.y, 0)
        const bottom = Math.min(r.bottom, rect.y + rect.height, innerHeight)
        if (left >= right || top >= bottom) continue
        const label =
          element.getAttribute('aria-label') ||
          element.textContent?.trim() ||
          element.tagName
        hits.push(label)
        const point = { x: (left + right) / 2, y: (top + bottom) / 2 }
        const target = document.elementFromPoint(point.x, point.y)
        if (!target || !element.contains(target))
          blocked.push({
            label,
            hit: target
              ? `${target.tagName}.${target.getAttribute('class') ?? ''}`
              : null,
            point,
            elementRect: r.toJSON(),
            dockRect: rect,
            pointerEvents: style.pointerEvents,
            borderRadius: style.borderRadius,
            yielding: document
              .querySelector('[data-mam-dock]')
              ?.getAttribute('data-yield'),
          })
      }
      return {
        hits,
        blocked,
        yielding: document
          .querySelector('[data-mam-dock]')
          ?.getAttribute('data-yield'),
      }
    }, dockBox)
    expect(result.blocked).toEqual([])
    if (result.hits.length > 0) expect(result.yielding).toBe('true')
    overlapping = result.hits
  }).toPass()
  return overlapping
}

export async function expectNothingCoveredAtBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  expect(await expectPageActionsClickable(page)).toEqual([])
}
