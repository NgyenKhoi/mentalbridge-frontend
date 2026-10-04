import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { createQueryClient } from './query-client'
import { bindQueryLifecycle } from './query-lifecycle'

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createQueryClient)

  useEffect(() => bindQueryLifecycle(), [])

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
