import { createContext, type ReactNode, useContext } from 'react'

import type { RuntimeConfig } from './runtime-config'

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null)

export function RuntimeConfigProvider({
  children,
  value,
}: Readonly<{ children: ReactNode; value: RuntimeConfig }>) {
  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  )
}

export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(RuntimeConfigContext)

  if (!config) {
    throw new Error('RuntimeConfigProvider is missing')
  }

  return config
}
