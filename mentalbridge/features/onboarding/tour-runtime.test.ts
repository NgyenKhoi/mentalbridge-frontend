import { fireEvent, screen } from '@testing-library/react'
import { driver } from 'driver.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createOnboardingTour } from './tour-runtime'
import { ONBOARDING_STEPS } from './tour-steps'
import { SPECIALIST_ONBOARDING_STEPS } from './specialist-tour-steps'

let controller: ReturnType<typeof createOnboardingTour> | undefined
const onEnd = vi.fn()
const onResult = vi.fn()
const prepareStep = vi.fn()

async function tick() {
  await vi.advanceTimersByTimeAsync(60)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => {
    const rect = new DOMRect(30, 60, 180, 44)
    return Object.assign([rect], { item: () => rect })
  })
  document.body.innerHTML = `
    <button id="launcher">Launcher</button>
    <aside>${[...new Set([...ONBOARDING_STEPS, ...SPECIALIST_ONBOARDING_STEPS].map((step) => step.target))].map((target) => `<a href="#${target}" data-onboarding="${target}">${target}</a>`).join('')}</aside>
    <main><button id="outside">Outside action</button></main>
    <div id="already-inert">Previously blocked</div>`
  document.getElementById('already-inert')!.inert = true
  document.getElementById('launcher')!.focus()
  onEnd.mockClear()
  onResult.mockClear()
  prepareStep.mockClear()
})

afterEach(async () => {
  controller?.destroy()
  controller = undefined
  await tick()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function start(steps = ONBOARDING_STEPS) {
  controller = createOnboardingTour(driver, {
    prepareStep,
    onEnd,
    onResult,
    steps,
  })
  const started = controller.start()
  await tick()
  await started
}

describe('onboarding interactions', () => {
  it('runs all configured specialist targets instead of USER destinations', async () => {
    await start(SPECIALIST_ONBOARDING_STEPS)
    for (let index = 0; index < SPECIALIST_ONBOARDING_STEPS.length; index++) {
      const step = SPECIALIST_ONBOARDING_STEPS[index]
      expect(screen.getByRole('dialog')).toHaveAccessibleName(step.title)
      expect(document.querySelector('.driver-active-element')).toHaveAttribute(
        'data-onboarding',
        step.target,
      )
      if (index < SPECIALIST_ONBOARDING_STEPS.length - 1) {
        fireEvent.keyDown(document, { key: 'ArrowRight' })
        await tick()
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }))
    await tick()
    expect(onResult).toHaveBeenCalledExactlyOnceWith('completed')
  })

  it('advances only explicitly and supports next/back keyboard controls', async () => {
    await start()
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 1/6')
    fireEvent.click(document.querySelector('.driver-overlay path')!)
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 1/6')
    fireEvent.keyDown(document, { key: 'Enter' })
    await tick()
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 2/6')
    expect(prepareStep).toHaveBeenLastCalledWith(true)
    fireEvent.click(document.querySelector('[data-onboarding="journal"]')!)
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 2/6')
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    await tick()
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 1/6')
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    await tick()
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 1/6')
    expect(onResult).not.toHaveBeenCalled()
  })

  it('blocks background actions and focus, while allowing the highlighted target', async () => {
    await start()
    const outside = document.getElementById('outside')!
    const clicked = vi.fn()
    outside.addEventListener('click', clicked)
    fireEvent.click(outside)
    expect(clicked).not.toHaveBeenCalled()
    expect(outside.closest('main')!.inert).toBe(true)
    outside.focus()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Tiếp tục' }),
    )
    const target = document.querySelector<HTMLElement>(
      '[data-onboarding="welcome"]',
    )!
    target.focus()
    expect(document.activeElement).toBe(target)
  })

  it('records skip on Escape, restores inert state and returns focus to the launcher', async () => {
    await start()
    fireEvent.keyDown(document, { key: 'Escape' })
    await tick()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith('skipped')
    expect(onEnd).toHaveBeenCalledOnce()
    expect(document.querySelector('main')!.inert).not.toBe(true)
    expect(document.getElementById('already-inert')!.inert).toBe(true)
    expect(document.activeElement).toBe(document.getElementById('launcher'))
    expect(document.body).not.toHaveClass('mb-onboarding-active')
  })

  it('finishes the sixth step with a distinct completed outcome', async () => {
    await start()
    for (let index = 1; index < 6; index++) {
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      await tick()
    }
    expect(screen.getByRole('dialog')).toHaveTextContent('Bước 6/6')
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }))
    await tick()
    expect(onResult).toHaveBeenCalledExactlyOnceWith('completed')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cleans up unmount without marking an unfinished tour as seen', async () => {
    await start()
    controller!.destroy()
    await tick()
    expect(onResult).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledOnce()
    const clicked = vi.fn()
    document.getElementById('outside')!.addEventListener('click', clicked)
    fireEvent.click(document.getElementById('outside')!)
    expect(clicked).toHaveBeenCalledOnce()
  })
})
