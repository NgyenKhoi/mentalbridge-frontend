import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// MB-781: the gate loads the host only where Mầm shows, and a host that is slow
// or fails to load changes nothing on the page but the reserved bottom space.

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const host = vi.hoisted(() => ({
  loads: 0,
  outcome: 'ready' as 'ready' | 'pending' | 'fail',
}))
async function renderGate(slotted: boolean) {
  // Each test gets a fresh lazy boundary, slot store and host outcome.
  vi.resetModules()
  vi.doMock('./MamDockHost', () => {
    host.loads += 1
    if (host.outcome === 'fail') throw new Error('chunk failed')
    if (host.outcome === 'pending') return new Promise(() => {})
    return {
      MamDockHost: ({ pathname }: { pathname: string }) => (
        <div data-mam-dock="shown" data-pathname={pathname} />
      ),
    }
  })
  const { MamDock } = await import('./MamDock')
  const { MamDockSlot } = await import('./MamDockSlot')
  return render(
    <>
      {slotted ? <MamDockSlot /> : null}
      <MamDock />
    </>,
  )
}

const space = () => document.querySelector('div[hidden]')
const dock = () => document.querySelector('[data-mam-dock]')

describe('MamDock lazy host', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    host.loads = 0
    host.outcome = 'ready'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('never loads the host without a USER layout slot (flag off)', async () => {
    await renderGate(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(host.loads).toBe(0)
    expect(space()).toBeNull()
    expect(dock()).toBeNull()
  })

  it('never loads the host on a route outside the surface matrix', async () => {
    navigation.pathname = '/support-plan/today'
    await renderGate(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(host.loads).toBe(0)
    expect(space()).toBeNull()
  })

  it('reserves the bottom space at once and shows the host when it loads', async () => {
    await renderGate(true)
    expect(space()).not.toBeNull()
    await waitFor(() => expect(dock()).not.toBeNull())
    expect(dock()).toHaveAttribute('data-pathname', '/dashboard')
    expect(host.loads).toBe(1)
  })

  it('keeps only the reserved space while the host is still loading', async () => {
    host.outcome = 'pending'
    await renderGate(true)
    await waitFor(() => expect(host.loads).toBe(1))
    expect(space()).not.toBeNull()
    expect(space()).not.toBeVisible()
    expect(dock()).toBeNull()
  })

  it('leaves the page alone when the host fails to load, with no retry', async () => {
    host.outcome = 'fail'
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => errors.push(event.error)
    window.addEventListener('error', onError)
    const view = await renderGate(true)
    await waitFor(() => expect(host.loads).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    // An eligible navigation and a remount keep the cached failure: no retry.
    const { MamDock } = await import('./MamDock')
    const { MamDockSlot } = await import('./MamDockSlot')
    navigation.pathname = '/resources'
    view.rerender(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(space()).not.toBeNull()
    view.rerender(<MamDockSlot />)
    view.rerender(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
    expect(host.loads).toBe(1)
    expect(dock()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    // A card's Mầm button no longer pretends to work.
    const { MamCardButton } = await import('./MamCardButton')
    view.rerender(
      <section data-mam="">
        <MamCardButton label="Mầm giải thích: Thở chậm" />
      </section>,
    )
    expect(
      screen.getByRole('button', { name: 'Mầm giải thích: Thở chậm' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })
})
