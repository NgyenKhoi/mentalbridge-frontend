'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useCommunityPresence } from './useCommunityPresence'

const PresenceContext = createContext<ReturnType<
  typeof useCommunityPresence
> | null>(null)

export function CommunityPresenceProvider({
  children,
}: {
  children: ReactNode
}) {
  const presence = useCommunityPresence()
  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  )
}

export function useCommunityPresenceContext() {
  return useContext(PresenceContext)
}
