'use client'

import { lazy, Suspense, type ComponentType } from 'react'
import { usePathname } from 'next/navigation'

import { useMamDockSlotted } from './MamDockSlot'
import { markMamHostUnavailable } from './mam-summon-request'
import styles from './MamDockSpace.module.css'
import { isMamDockRoute } from './mam-routes'

// MB-781: the host, its character and reward watcher load only where Mầm shows,
// so flag-off and undocked pages never request them. A host that fails to load
// leaves the page as it is: no dock, no error screen, no retry.
const MamDockHost = lazy<ComponentType<{ pathname: string }>>(() =>
  import('./MamDockHost')
    .then((module) => ({ default: module.MamDockHost }))
    .catch(() => {
      markMamHostUnavailable()
      return { default: () => null }
    }),
)

/** The one Mầm per tab. Mounted once in the root providers. */
export function MamDock() {
  const pathname = usePathname()
  const slotted = useMamDockSlotted()
  if (!slotted || !isMamDockRoute(pathname)) return null
  return (
    <>
      {/* Reserves the dock's bottom space before the host arrives. */}
      <div className={styles.space} hidden />
      <Suspense fallback={null}>
        <MamDockHost pathname={pathname} />
      </Suspense>
    </>
  )
}
