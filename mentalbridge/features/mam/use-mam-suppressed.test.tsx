import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMamAway, useMamCompanionDialog } from './use-mam-suppressed'

// MB-895: a modal that opts in with `data-mam-companion="quiet"` keeps Mầm on a desktop screen;
// every other modal, and a narrow screen, still remove her.

const stubScreen = (desktop: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: desktop && query === '(min-width: 901px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )

const openDialog = (attributes: Record<string, string> = {}) => {
  const dialog = document.createElement('dialog')
  dialog.setAttribute('open', '')
  for (const [name, value] of Object.entries(attributes))
    dialog.setAttribute(name, value)
  document.body.append(dialog)
  return dialog
}

describe('companion-friendly modals', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'showPopover', {
      value: vi.fn(),
      configurable: true,
    })
    stubScreen(true)
  })
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('another modal still removes Mầm', () => {
    openDialog()
    expect(renderHook(() => useMamAway()).result.current).toBe(true)
    expect(renderHook(() => useMamCompanionDialog()).result.current).toBeNull()
  })

  it('the opted-in dialog keeps her on a desktop screen and is reported', () => {
    const dialog = openDialog({ 'data-mam-companion': 'quiet' })
    expect(renderHook(() => useMamAway()).result.current).toBe(false)
    expect(renderHook(() => useMamCompanionDialog()).result.current).toBe(
      dialog,
    )
  })

  it('a second, ordinary modal over it removes her again', () => {
    openDialog({ 'data-mam-companion': 'quiet' })
    openDialog()
    expect(renderHook(() => useMamAway()).result.current).toBe(true)
  })

  it('at 900 px or less the dialog covers the screen: she stays away', () => {
    stubScreen(false)
    openDialog({ 'data-mam-companion': 'quiet' })
    expect(renderHook(() => useMamAway()).result.current).toBe(true)
    expect(renderHook(() => useMamCompanionDialog()).result.current).toBeNull()
  })

  it('a browser without the Popover API cannot draw her above the backdrop: away', () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
    openDialog({ 'data-mam-companion': 'quiet' })
    expect(renderHook(() => useMamAway()).result.current).toBe(true)
  })
})
