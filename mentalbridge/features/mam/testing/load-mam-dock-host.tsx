import { render, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { MamDock } from '../MamDock'
import { MamDockSlot } from '../MamDockSlot'

/**
 * The dock host is lazy (MB-781). Load it once before a suite, so its tests
 * render it in the same commit as the gate, as the app does after the first
 * load. Needs the suite's `next/navigation` mock on a dock route.
 */
export async function loadMamDockHost() {
  // Suites stub these per test; the host needs them to mount here too.
  vi.stubGlobal(
    'matchMedia',
    (media: string) =>
      ({
        matches: false,
        media,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const { container, unmount } = render(
    <>
      <MamDockSlot />
      <MamDock />
    </>,
  )
  try {
    await waitFor(
      () => {
        if (!container.querySelector('[data-mam-dock]'))
          throw new Error('The Mầm host has not loaded.')
      },
      { timeout: 15_000 },
    )
  } finally {
    unmount()
    vi.unstubAllGlobals()
  }
}
