import type { Config, Driver, PopoverDOM } from 'driver.js'

import { ONBOARDING_STEPS, type OnboardingStep } from './tour-steps'
import type { TourOutcome } from './tour-storage'

function isolateBackground(allowed: Element[]) {
  const changed: { element: HTMLElement; inert: boolean }[] = []
  const visit = (parent: Element) => {
    for (const child of parent.children) {
      if (!(child instanceof HTMLElement)) continue
      if (
        allowed.some((element) => element === child || element.contains(child))
      )
        continue
      if (allowed.some((element) => child.contains(element))) visit(child)
      else {
        changed.push({ element: child, inert: child.inert })
        child.inert = true
      }
    }
  }
  visit(document.body)
  return () => {
    for (const { element, inert } of changed) element.inert = inert
  }
}

const afterLayout = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

export function createOnboardingTour(
  createDriver: (config: Config) => Driver,
  options: Readonly<{
    prepareStep: (inSidebar: boolean) => void
    onEnd: () => void
    onResult: (outcome: TourOutcome) => void
    steps?: readonly OnboardingStep[]
    focusFallbackSelectors?: readonly string[]
    popoverClass?: string
  }>,
) {
  const steps = options.steps ?? ONBOARDING_STEPS
  const launcher = document.activeElement
  let alive = true
  let index = 0
  let transition = 0
  let outcome: TourOutcome | undefined
  let popover: PopoverDOM | undefined
  let releaseBackground = () => {}
  let resizeFrame = 0

  const cleanup = () => {
    if (!alive) return
    alive = false
    transition++
    cancelAnimationFrame(resizeFrame)
    releaseBackground()
    document.body.classList.remove('mb-onboarding-active')
    document.removeEventListener('keydown', keyboard, true)
    document.removeEventListener('focusin', containFocus, true)
    document.removeEventListener('pointerdown', blockOutside, true)
    document.removeEventListener('click', blockOutside, true)
    window.removeEventListener('resize', resize)
    options.onEnd()
    if (outcome) options.onResult(outcome)
    requestAnimationFrame(() => {
      const fallback = (
        options.focusFallbackSelectors ?? [
          '.ref-mobile',
          '[data-onboarding="profile"]',
        ]
      )
        .map((selector) => document.querySelector(selector))
        .find(
          (element) =>
            element instanceof HTMLElement && element.getClientRects().length,
        )
      const target =
        launcher instanceof HTMLElement &&
        launcher !== document.body &&
        launcher.isConnected &&
        launcher.getClientRects().length
          ? launcher
          : fallback
      if (target instanceof HTMLElement) target.focus({ preventScroll: true })
    })
  }

  const finish = (result: TourOutcome) => {
    outcome = result
    if (tour.isActive()) tour.destroy()
    else cleanup()
  }

  const show = async (next: number) => {
    if (!alive || next < 0) return
    if (next >= steps.length) {
      finish('completed')
      return
    }
    const ticket = ++transition
    options.prepareStep(steps[next].inSidebar)
    await afterLayout()
    if (!alive || ticket !== transition) return
    index = next
    document
      .querySelector<HTMLElement>(`[data-onboarding="${steps[index].target}"]`)
      ?.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      })
    if (tour.isActive()) tour.moveTo(index)
    else tour.drive(index)
  }

  const isAllowed = (target: EventTarget | null) =>
    target instanceof Node &&
    (popover?.wrapper.contains(target) ||
      tour.getActiveElement()?.contains(target))

  const blockOutside = (event: Event) => {
    if (!tour.isActive() || isAllowed(event.target)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const containFocus = (event: FocusEvent) => {
    if (tour.isActive() && !isAllowed(event.target)) popover?.nextButton.focus()
  }

  const keyboard = (event: KeyboardEvent) => {
    if (!tour.isActive() || event.isComposing) return
    if (!['Enter', 'ArrowRight', 'ArrowLeft', 'Escape'].includes(event.key))
      return
    if (
      event.key === 'Enter' &&
      event.target instanceof Element &&
      event.target.closest(
        '.driver-popover-prev-btn, .driver-popover-close-btn',
      )
    )
      return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.repeat) return
    if (event.key === 'Escape') finish('skipped')
    else void show(index + (event.key === 'ArrowLeft' ? -1 : 1))
  }

  const resize = () => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      if (!alive) return
      options.prepareStep(steps[index].inSidebar)
      void afterLayout().then(() => {
        if (alive) tour.refresh()
      })
    })
  }

  const tour = createDriver({
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: 220,
    smoothScroll: false,
    allowScroll: false,
    overlayColor: '#203b32',
    overlayOpacity: 0.55,
    overlayClickBehavior: 'none',
    allowKeyboardControl: false,
    disableActiveInteraction: false,
    advanceOnClick: false,
    stagePadding: 6,
    stageRadius: 12,
    popoverOffset: 12,
    popoverClass: options.popoverClass ?? 'mb-onboarding-popover',
    showProgress: true,
    progressText: 'Bước {{current}}/{{total}}',
    nextBtnText: 'Tiếp tục',
    prevBtnText: 'Quay lại',
    doneBtnText: 'Hoàn thành',
    closeBtnLabel: 'Bỏ qua hướng dẫn',
    onNextClick: () => void show(index + 1),
    onPrevClick: () => void show(index - 1),
    onCloseClick: () => finish('skipped'),
    onDoneClick: () => finish('completed'),
    onDestroyed: cleanup,
    onPopoverRender: (dom) => {
      releaseBackground()
      popover = dom
      dom.title.id = 'mb-onboarding-title'
      dom.description.id = 'mb-onboarding-description'
      dom.wrapper.setAttribute('role', 'dialog')
      dom.wrapper.setAttribute('aria-modal', 'true')
      dom.wrapper.setAttribute('aria-labelledby', dom.title.id)
      dom.wrapper.setAttribute('aria-describedby', dom.description.id)
      dom.wrapper.dataset.onboardingStep = String(index + 1)
      dom.progress.setAttribute('aria-live', 'polite')
      dom.closeButton.textContent = 'Bỏ qua hướng dẫn'
      dom.footer.append(dom.closeButton)
      const content = document.createElement('div')
      content.className = 'mb-onboarding-content'
      content.append(dom.title, dom.description, dom.footer)
      dom.wrapper.append(content)
      const target = document.querySelector(
        `[data-onboarding="${steps[index].target}"]`,
      )
      releaseBackground = isolateBackground([
        dom.wrapper,
        ...(target ? [target] : []),
      ])
    },
    steps: steps.map((step) => ({
      element: `[data-onboarding="${step.target}"]`,
      popover: {
        title: step.title,
        description: step.description,
        side: step.inSidebar ? 'right' : 'bottom',
        align: 'center',
      },
    })),
  })

  document.body.classList.add('mb-onboarding-active')
  document.addEventListener('keydown', keyboard, true)
  document.addEventListener('focusin', containFocus, true)
  document.addEventListener('pointerdown', blockOutside, true)
  document.addEventListener('click', blockOutside, true)
  window.addEventListener('resize', resize)

  return {
    start: () => show(0),
    isActive: () => alive,
    destroy: () => {
      outcome = undefined
      if (tour.isActive()) tour.destroy()
      else cleanup()
    },
  }
}
